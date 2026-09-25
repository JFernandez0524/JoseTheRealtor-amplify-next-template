/**
 * POST /api/v1/update-lead-address
 *
 * Dedicated server-side API endpoint for updating a PropertyLead's address.
 * Updates address fields, standardizes the address, clears the INVALID validation status,
 * and proactively triggers valuation & market intelligence (Bridge API + Serper SERP)
 * to refresh Zestimate, listing status, and property details in a single atomic flow.
 *
 * AUTH: Required (Cognito JWT via cookies)
 * REQUEST BODY:
 *   {
 *     leadId: string,
 *     street: string,
 *     city: string,
 *     state: string,
 *     zip?: string,
 *     county?: string,
 *     latitude?: number | null,
 *     longitude?: number | null,
 *   }
 * RESPONSE:
 *   { success: true, lead: DBLead }
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer, cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';
import { resolvePropertyWithSerp } from '@/app/utils/serpPropertyResolver.server';

export async function POST(request: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required' }, { status: 401 });
    }

    const body = await request.json();
    const { leadId, street, city, state, zip, county, latitude, longitude } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 });
    }

    const cleanStreet = (street || '').trim();
    const cleanCity = (city || '').trim();
    const cleanState = (state || '').trim();
    const cleanZip = (zip || '').trim();

    if (!cleanStreet || !cleanCity || !cleanState) {
      return NextResponse.json({ error: 'Street, city, and state are required.' }, { status: 400 });
    }

    // 1. Fetch current lead to verify existence and preserve existing labels
    let existingLead: any = null;
    try {
      const getRes = await cookiesClient.models.PropertyLead.get({ id: leadId });
      existingLead = getRes.data;
    } catch (getErr: any) {
      console.warn(`⚠️ [UPDATE_LEAD_ADDRESS] Failed to fetch existing lead ${leadId}:`, getErr.message);
    }

    if (!existingLead) {
      return NextResponse.json({ error: `Lead with ID ${leadId} not found` }, { status: 404 });
    }

    const cleanCounty = county?.trim() || existingLead.ownerCounty || null;

    const stdAddrObj = {
      street: cleanStreet,
      city: cleanCity,
      state: cleanState,
      zip: cleanZip,
      county: cleanCounty,
    };

    // 2. Base payload: updated address fields + mark as VALID
    const updatePayload: Record<string, any> = {
      id: leadId,
      ownerAddress: cleanStreet,
      ownerCity: cleanCity,
      ownerState: cleanState,
      ownerZip: cleanZip,
      ownerCounty: cleanCounty,
      validationStatus: 'VALID',
      validationErrors: [],
      standardizedAddress: JSON.stringify(stdAddrObj),
    };

    if (latitude !== undefined && latitude !== null) {
      updatePayload.latitude = Number(latitude);
    }
    if (longitude !== undefined && longitude !== null) {
      updatePayload.longitude = Number(longitude);
    }

    // 3. Proactively refresh valuation & market intel for the newly saved address
    try {
      const bridgeRes = await analyzeBridgeProperty({
        street: cleanStreet,
        city: cleanCity,
        state: cleanState,
        zip: cleanZip,
        lat: updatePayload.latitude ?? existingLead.latitude ?? undefined,
        lng: updatePayload.longitude ?? existingLead.longitude ?? undefined,
      });

      let v = bridgeRes.valuation;
      let serpData: any = null;

      try {
        const serpRes = await resolvePropertyWithSerp({
          address: cleanStreet,
          city: cleanCity,
          state: cleanState,
          zip: cleanZip,
          useAi: true,
        });

        if (serpRes.success && serpRes.data) {
          serpData = serpRes.data;
          if (!v) {
            if (serpRes.bridgeValuation) {
              v = serpRes.bridgeValuation;
            } else if (serpData.zpid) {
              const retryBridge = await analyzeBridgeProperty({
                street: cleanStreet,
                city: cleanCity,
                state: cleanState,
                zip: cleanZip,
                zpid: serpData.zpid,
              });
              if (retryBridge.success && retryBridge.valuation) {
                v = retryBridge.valuation;
              }
            }
          }
        }
      } catch (serpErr: any) {
        console.warn('⚠️ [UPDATE_LEAD_ADDRESS] SERP resolution note:', serpErr.message);
      }

      if (!v && (serpData?.zestimate || serpData?.listPrice)) {
        v = {
          zestimate: serpData.zestimate || serpData.listPrice,
          zpid: serpData.zpid,
          zillowUrl: serpData.zillowUrl,
          address: `${cleanStreet}, ${cleanCity}, ${cleanState} ${cleanZip}`.trim(),
          rentalZestimate: null,
        };
      }

      if (v) {
        updatePayload.zestimate = v.zestimate;
        updatePayload.zillowZpid = v.zpid || serpData?.zpid || null;
        updatePayload.zillowUrl =
          v.zillowUrl ||
          (v.zpid ? `https://www.zillow.com/homes/${v.zpid}_zpid/` : null) ||
          serpData?.zillowUrl ||
          null;
        updatePayload.zillowAddress = v.address || `${cleanStreet}, ${cleanCity}, ${cleanState} ${cleanZip}`.trim();
        updatePayload.rentZestimate = v.rentalZestimate ?? null;
        updatePayload.zillowLastUpdated = new Date().toISOString();
        updatePayload.zestimateDate = new Date().toISOString();
        updatePayload.zestimateSource = 'ZILLOW';
      }

      if (serpData?.listingStatus) {
        updatePayload.listingStatus = serpData.listingStatus;
      }
      if (serpData?.lastSaleAmount) {
        updatePayload.lastSaleAmount = serpData.lastSaleAmount;
      }
      if (serpData?.lastSaleDate) {
        updatePayload.lastSaleDate = serpData.lastSaleDate;
      }
      if (serpData) {
        updatePayload.homeDetails = JSON.stringify({
          beds: serpData.beds,
          baths: serpData.baths,
          sqft: serpData.sqft,
          yearBuilt: serpData.yearBuilt,
          propertyType: serpData.propertyType,
          hoaFee: serpData.hoaFee,
          annualTaxes: serpData.annualTaxes,
          mlsNumber: serpData.mlsNumber,
          community: serpData.community,
          aiReasoning: serpData.aiReasoning,
        });
      }

      // Preserve and update lead labels
      let leadLabels = (existingLead.leadLabels || []).filter(Boolean) as string[];
      if (serpData?.is55Plus && !leadLabels.includes('55_PLUS')) leadLabels.push('55_PLUS');
      if (serpData?.hoaFee && !leadLabels.includes('HOA_PROPERTY')) leadLabels.push('HOA_PROPERTY');
      if (serpData?.isCondo && !leadLabels.includes('CONDO')) leadLabels.push('CONDO');
      if (serpData?.listingStatus === 'active' && !leadLabels.includes('ACTIVE_MLS')) leadLabels.push('ACTIVE_MLS');
      if (serpData?.listingStatus === 'sold' && !leadLabels.includes('RECENTLY_SOLD')) leadLabels.push('RECENTLY_SOLD');
      if (serpData?.listingStatus && serpData.listingStatus !== 'active') {
        leadLabels = leadLabels.filter((l) => l !== 'ACTIVE_MLS');
      }
      if (serpData?.listingStatus && serpData.listingStatus !== 'sold') {
        leadLabels = leadLabels.filter((l) => l !== 'RECENTLY_SOLD');
      }
      updatePayload.leadLabels = leadLabels;
    } catch (valErr: any) {
      console.warn('⚠️ [UPDATE_LEAD_ADDRESS] Valuation lookup failed (saving address anyway):', valErr.message);
    }

    // 4. Persist all updates to DynamoDB via cookiesClient
    const { data: updatedLead, errors } = await cookiesClient.models.PropertyLead.update(updatePayload as any);

    if (errors) {
      console.error('❌ [UPDATE_LEAD_ADDRESS] Update error:', errors);
      return NextResponse.json({ error: errors.map((e: any) => e.message).join(', ') }, { status: 500 });
    }

    console.log(`✅ [UPDATE_LEAD_ADDRESS] Address successfully updated for lead ${leadId}:`, {
      ownerAddress: cleanStreet,
      ownerCity: cleanCity,
      ownerState: cleanState,
      ownerZip: cleanZip,
      validationStatus: 'VALID',
    });

    return NextResponse.json({ success: true, lead: updatedLead });
  } catch (error: any) {
    console.error('❌ [UPDATE_LEAD_ADDRESS] Unhandled exception:', error);
    return NextResponse.json({ error: error.message || 'Failed to update lead address' }, { status: 500 });
  }
}
