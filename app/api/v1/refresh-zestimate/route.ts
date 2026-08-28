/**
 * POST /api/v1/refresh-zestimate
 *
 * Re-fetches Zestimate and Zillow link for a PropertyLead using the Bridge API.
 * Accepts either structured address fields or a Zillow property URL (from which
 * address and zpid are parsed automatically).
 *
 * AUTH: Required (Cognito JWT via cookies)
 * REQUEST BODY:
 *   { leadId, street?, city?, state?, zip?, latitude?, longitude?, zillowUrl?, zillowZpid? }
 * RESPONSE: { success: true, zestimate: number, zpid: string, zillowUrl: string }
 *
 * CALLED BY: Lead detail page "Refresh Zestimate" button
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';
import { resolvePropertyWithSerp } from '@/app/utils/serpPropertyResolver.server';

/**
 * Parse a Zillow URL into address components + zpid.
 * e.g. .../homedetails/729A-Mount-Vernon-Rd-Monroe-Township-NJ-08831/61838989_zpid/
 */
function parseZillowUrl(url: string): { street: string; city: string; state: string; zip: string; zpid: string } | null {
  const zpidMatch = url.match(/\/(\d+)_zpid/);
  if (!zpidMatch) return null;
  const zpid = zpidMatch[1];

  const slugMatch = url.match(/\/homedetails\/([^/]+)\//);
  if (!slugMatch) return null;

  const parts = slugMatch[1].split('-');
  const zip = parts[parts.length - 1];
  const state = parts[parts.length - 2];
  const beforeState = parts.slice(0, parts.length - 2).join(' ');

  // Split street from city at last street suffix
  const suffixMatch = beforeState.match(/\b(Rd|St|Ave|Blvd|Dr|Ln|Ct|Cir|Pl|Ter|Pkwy|Way|Hwy|Pike|Trl|Loop|Run|Path|Row|Sq|Xing)\b/i);
  let street = beforeState;
  let city = '';
  if (suffixMatch?.index !== undefined) {
    const idx = suffixMatch.index + suffixMatch[0].length;
    street = beforeState.slice(0, idx).trim();
    city = beforeState.slice(idx).trim();
  }

  return { street, city, state, zip, zpid };
}

export async function POST(request: NextRequest) {
  try {
    const { leadId, street, city, state, zip, latitude, longitude, zillowUrl, zillowZpid } = await request.json();

    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 });
    }

    let searchStreet = street;
    let searchCity = city;
    let searchState = state;
    let searchZip = zip;
    let resolvedZpid: string | undefined = zillowZpid || undefined;
    let resolvedZillowUrl: string | undefined = zillowUrl;

    if (zillowUrl) {
      const parsed = parseZillowUrl(zillowUrl);
      if (!parsed) {
        return NextResponse.json({ error: 'Could not parse address from Zillow URL' }, { status: 400 });
      }
      searchStreet = parsed.street;
      searchCity = parsed.city;
      searchState = parsed.state;
      searchZip = parsed.zip;
      resolvedZpid = parsed.zpid;
    }

    const result = await analyzeBridgeProperty({
      street: searchStreet,
      city: searchCity,
      state: searchState,
      zip: searchZip,
      lat: latitude,
      lng: longitude,
      zpid: resolvedZpid,
    });

    let v = result.valuation;
    let serpData: any = null;

    // 🔎 Proactively query SERP for real-time listing status, MLS active price, and home details
    if (!zillowUrl && searchStreet && searchCity && searchState) {
      try {
        const serpRes = await resolvePropertyWithSerp({
          address: searchStreet,
          city: searchCity,
          state: searchState,
          zip: searchZip,
        });

        if (serpRes.success && serpRes.data) {
          serpData = serpRes.data;
          if (!v) {
            if (serpRes.bridgeValuation) {
              v = serpRes.bridgeValuation;
              resolvedZpid = serpData.zpid;
              resolvedZillowUrl = serpData.zillowUrl;
            } else if (serpData.zpid) {
              resolvedZpid = serpData.zpid;
              resolvedZillowUrl = serpData.zillowUrl;
              const retryBridge = await analyzeBridgeProperty({
                street: searchStreet,
                city: searchCity,
                state: searchState,
                zip: searchZip,
                zpid: resolvedZpid,
              });
              if (retryBridge.success && retryBridge.valuation) {
                v = retryBridge.valuation;
              }
            }
          }
        }
      } catch (serpErr: any) {
        console.warn('⚠️ [REFRESH_ZESTIMATE] Serper resolution failed:', serpErr.message);
      }
    }

    if (!v) {
      if (zillowUrl && resolvedZpid) {
        await cookiesClient.models.PropertyLead.update({
          id: leadId,
          zillowZpid: resolvedZpid,
          zillowUrl: resolvedZillowUrl,
        });
        return NextResponse.json({ success: true, partial: true, message: 'Zillow has no data for this property. It will fill from enrichment, or set the value manually with ✏️.' });
      }
      return NextResponse.json({ error: 'No Zestimate found for this address. Run enrichment or set the value manually with ✏️.' }, { status: 404 });
    }

    const zillowData = {
      zestimate: v.zestimate,
      zpid: resolvedZpid || v.zpid,
      zillowUrl: resolvedZillowUrl || v.zillowUrl || `https://www.zillow.com/homes/${v.zpid}_zpid/`,
      address: v.address,
      rentalZestimate: v.rentalZestimate,
    };

    const updatePayload: Record<string, any> = {
      id: leadId,
      zestimate: zillowData.zestimate,
      zillowZpid: zillowData.zpid,
      zillowUrl: zillowData.zillowUrl,
      zillowAddress: zillowData.address,
      rentZestimate: zillowData.rentalZestimate,
      zillowLastUpdated: new Date().toISOString(),
      zestimateSource: 'ZILLOW',
      zestimateDate: new Date().toISOString(),
    };

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
      });
    }

    const leadLabels: string[] = [];
    if (serpData?.is55Plus) leadLabels.push('55_PLUS');
    if (serpData?.hoaFee) leadLabels.push('HOA_PROPERTY');
    if (serpData?.listingStatus === 'active') leadLabels.push('ACTIVE_MLS');
    if (serpData?.listingStatus === 'sold') leadLabels.push('RECENTLY_SOLD');
    if (leadLabels.length > 0) {
      updatePayload.leadLabels = leadLabels;
    }

    const { errors } = await cookiesClient.models.PropertyLead.update(updatePayload as any);


    if (errors) throw new Error(errors.map((e: any) => e.message).join(', '));

    return NextResponse.json({ success: true, zillowData, serpData });
  } catch (error: any) {
    console.error('Refresh Zestimate error:', error);
    return NextResponse.json({ error: error.message || 'Failed to refresh Zestimate' }, { status: 500 });
  }
}
