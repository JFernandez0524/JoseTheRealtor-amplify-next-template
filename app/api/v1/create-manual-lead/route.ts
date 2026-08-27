/**
 * POST /api/v1/create-manual-lead
 *
 * Creates a single PropertyLead record manually (without CSV upload).
 * Address components must be pre-validated by the Google Places API on the client.
 * Fetches a Zestimate from Bridge API at creation time (non-fatal if it fails).
 *
 * AUTH: Required (Cognito JWT via cookies)
 * REQUEST BODY:
 *   { type, ownerLastName, ownerFirstName?, phone?, ownerAddr, adminFirstName?, adminLastName?, adminAddr? }
 *   ownerAddr / adminAddr: { street, city, state, zip, county?, lat?, lng? }
 *   Probate leads require adminFirstName, adminLastName, adminAddr.
 * RESPONSE: { success: true, lead: PropertyLead }
 *
 * CALLED BY: Manual lead creation form
 */
import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';
import { resolvePropertyWithSerp } from '@/app/utils/serpPropertyResolver.server';
import { createLead } from '@/app/utils/aws/data/lead.server';
import { isValidName, formatPhoneE164 } from '@/app/utils/leadValidation';

export async function POST(request: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      ownerFirstName,
      ownerLastName,
      phone,
      ownerAddr,
      adminFirstName,
      adminLastName,
      adminAddr,
    } = body;

    if (!type || !ownerAddr || !ownerLastName) {
      return NextResponse.json({ error: 'type, ownerLastName, and ownerAddr are required' }, { status: 400 });
    }

    if (type === 'PROBATE' && (!adminFirstName || !adminLastName || !adminAddr)) {
      return NextResponse.json({ error: 'adminFirstName, adminLastName, and adminAddr are required for Probate leads' }, { status: 400 });
    }

    // Field-format validation (defense-in-depth — the client validates too, but
    // direct API callers must not bypass it). Names: letters + spaces only.
    if (ownerFirstName && !isValidName(ownerFirstName)) {
      return NextResponse.json({ error: 'ownerFirstName may only contain letters and spaces (max 50)' }, { status: 400 });
    }
    if (!isValidName(ownerLastName)) {
      return NextResponse.json({ error: 'ownerLastName may only contain letters and spaces (max 50)' }, { status: 400 });
    }
    if (type === 'PROBATE') {
      if (!isValidName(adminFirstName)) {
        return NextResponse.json({ error: 'adminFirstName may only contain letters and spaces (max 50)' }, { status: 400 });
      }
      if (!isValidName(adminLastName)) {
        return NextResponse.json({ error: 'adminLastName may only contain letters and spaces (max 50)' }, { status: 400 });
      }
    }

    // Defensive address component resolution across all US jurisdictions
    const resolveAddrComponents = (addr: any) => {
      if (!addr) return;
      if (!addr.street && addr.formattedAddress) {
        addr.street = addr.formattedAddress.split(',')[0]?.trim() || '';
      }
      if (addr.formattedAddress) {
        const parts = addr.formattedAddress.split(',').map((p: string) => p.trim());
        if (!addr.city && parts.length >= 3) {
          addr.city = parts[1];
        }
        if ((!addr.state || !addr.zip) && parts.length >= 3) {
          for (let i = parts.length - 1; i >= 1; i--) {
            const match = parts[i].match(/\b([A-Z]{2})\b(?:\s+(\d{5}(?:-\d{4})?))?/);
            if (match) {
              if (!addr.state) addr.state = match[1];
              if (!addr.zip && match[2]) addr.zip = match[2];
              break;
            }
          }
        }
      }
    };

    resolveAddrComponents(ownerAddr);
    if (adminAddr) resolveAddrComponents(adminAddr);

    if (!ownerAddr.street && !ownerAddr.formattedAddress) {
      return NextResponse.json({ error: 'Property address is required' }, { status: 400 });
    }
    if (!ownerAddr.city || !ownerAddr.state || !ownerAddr.zip) {
      return NextResponse.json(
        { error: 'Property city, state, and zip are required' },
        { status: 400 }
      );
    }


    // Phone normalization (E.164) — non-fatal if invalid, but reject clearly if malformed
    let normalizedPhone: string | null = null;
    if (phone) {
      normalizedPhone = formatPhoneE164(phone);
      if (!normalizedPhone) {
        return NextResponse.json({ error: 'phone must be a valid 10-digit US phone number' }, { status: 400 });
      }
    }

    // Address components come pre-parsed from Places API on the client — no server re-validation needed
    let zestimate: number | null = null;
    let rentZestimate: number | null = null;
    let zillowZpid: string | null = null;
    let zillowUrl: string | null = null;
    let zillowAddress: string | null = null;
    const latitude: number | null = ownerAddr.lat ?? null;
    const longitude: number | null = ownerAddr.lng ?? null;

    try {
      const propertyData = await analyzeBridgeProperty({
        street: ownerAddr.street,
        city: ownerAddr.city,
        state: ownerAddr.state,
        zip: ownerAddr.zip,
        lat: ownerAddr.lat,
        lng: ownerAddr.lng,
      });

      if (propertyData.success && propertyData.valuation) {
        zestimate = propertyData.valuation.zestimate ?? null;
        rentZestimate = propertyData.valuation.rentalZestimate ?? null;
        zillowZpid = propertyData.valuation.zpid ?? null;
        zillowUrl = propertyData.valuation.zillowUrl ?? null;
        zillowAddress = propertyData.valuation.address ?? null;
      }
    } catch (error) {
      console.error('Zestimate fetch failed (non-fatal):', error);
    }

    // 🔎 Proactive SERP Property & Listing Status Resolution (Serper.dev)
    let serpData: any = null;
    if (process.env.SERPER_API_KEY) {
      try {
        const street = ownerAddr.street || ownerAddr.formattedAddress;
        const serpRes = await resolvePropertyWithSerp({
          address: street,
          city: ownerAddr.city,
          state: ownerAddr.state,
          zip: ownerAddr.zip,
        });

        if (serpRes.success && serpRes.data) {
          serpData = serpRes.data;
          if (!zestimate && serpRes.data.zpid) {
            zestimate = serpRes.bridgeValuation?.zestimate ?? null;
            rentZestimate = serpRes.bridgeValuation?.rentalZestimate ?? null;
            zillowZpid = serpRes.data.zpid;
            zillowUrl = serpRes.data.zillowUrl ?? null;
            zillowAddress = serpRes.bridgeValuation?.address ?? null;
          }
        }
      } catch (serpErr: any) {
        console.warn('⚠️ [CREATE_MANUAL_LEAD] Serper resolution failed:', serpErr.message);
      }
    }

    const leadLabels: string[] = [];
    let listingStatus = serpData?.listingStatus || 'off_market';
    if (serpData?.is55Plus) leadLabels.push('55_PLUS');
    if (serpData?.hoaFee) leadLabels.push('HOA_PROPERTY');
    if (listingStatus === 'active') leadLabels.push('ACTIVE_MLS');
    if (listingStatus === 'sold') leadLabels.push('RECENTLY_SOLD');

    const lead = await createLead({
      type,
      ownerFirstName: ownerFirstName || null,
      ownerLastName,
      ownerAddress: ownerAddr.street || ownerAddr.formattedAddress,
      ownerCity: ownerAddr.city,
      ownerState: ownerAddr.state,
      ownerZip: ownerAddr.zip,
      ownerCounty: ownerAddr.county || null,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      zestimate: zestimate ?? undefined,
      rentZestimate: rentZestimate ?? undefined,
      zillowZpid: zillowZpid ?? undefined,
      zillowUrl: zillowUrl ?? undefined,
      zillowAddress: zillowAddress ?? undefined,
      zestimateSource: zestimate ? 'ZILLOW' : undefined,
      zestimateDate: zestimate ? new Date().toISOString() : undefined,
      phones: normalizedPhone ? [normalizedPhone] : [],
      skipTraceStatus: normalizedPhone ? 'COMPLETED' : 'PENDING',
      ghlSyncStatus: 'PENDING',
      ghlContactId: null,
      listingStatus,
      lastSaleAmount: serpData?.lastSaleAmount ?? undefined,
      lastSaleDate: serpData?.lastSaleDate ?? undefined,
      homeDetails: serpData
        ? JSON.stringify({
            beds: serpData.beds,
            baths: serpData.baths,
            sqft: serpData.sqft,
            yearBuilt: serpData.yearBuilt,
            propertyType: serpData.propertyType,
            hoaFee: serpData.hoaFee,
            annualTaxes: serpData.annualTaxes,
            mlsNumber: serpData.mlsNumber,
            community: serpData.community,
          })
        : undefined,
      leadLabels: leadLabels.length > 0 ? leadLabels : undefined,
      uploadSource: 'manual_entry',
      validationStatus: 'VALID',
      ...(adminAddr && {
        adminFirstName: adminFirstName || null,
        adminLastName: adminLastName || null,
        adminAddress: adminAddr.street,
        adminCity: adminAddr.city,
        adminState: adminAddr.state,
        adminZip: adminAddr.zip,
      }),
    } as any);

    return NextResponse.json({ success: true, lead });
  } catch (error: any) {
    console.error('Create manual lead error:', error);
    return NextResponse.json(
      { error: 'Failed to create lead', details: error.message },
      { status: 500 }
    );
  }
}
