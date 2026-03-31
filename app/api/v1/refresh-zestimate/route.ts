import { NextRequest, NextResponse } from 'next/server';
import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';

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
    const { leadId, street, city, state, zip, latitude, longitude, zillowUrl } = await request.json();

    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 });
    }

    let searchStreet = street;
    let searchCity = city;
    let searchState = state;
    let searchZip = zip;
    let resolvedZpid: string | undefined;
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
    });

    if (!result.valuation) {
      if (zillowUrl && resolvedZpid) {
        await cookiesClient.models.PropertyLead.update({
          id: leadId,
          zillowZpid: resolvedZpid,
          zillowUrl: resolvedZillowUrl,
        });
        return NextResponse.json({ success: true, partial: true, message: 'Zillow link saved. Enter the value manually using $ Manual.' });
      }
      return NextResponse.json({ error: 'No Zestimate data found' }, { status: 404 });
    }

    const v = result.valuation;
    const zillowData = {
      zestimate: v.zestimate,
      zpid: resolvedZpid || v.zpid,
      zillowUrl: resolvedZillowUrl || v.zillowUrl || `https://www.zillow.com/homes/${v.zpid}_zpid/`,
      address: v.address,
      rentalZestimate: v.rentalZestimate,
    };

    const { errors } = await cookiesClient.models.PropertyLead.update({
      id: leadId,
      zestimate: zillowData.zestimate,
      zillowZpid: zillowData.zpid,
      zillowUrl: zillowData.zillowUrl,
      zillowAddress: zillowData.address,
      rentZestimate: zillowData.rentalZestimate,
      zillowLastUpdated: new Date().toISOString(),
    });

    if (errors) throw new Error(errors.map((e: any) => e.message).join(', '));

    return NextResponse.json({ success: true, zillowData });
  } catch (error: any) {
    console.error('Refresh Zestimate error:', error);
    return NextResponse.json({ error: error.message || 'Failed to refresh Zestimate' }, { status: 500 });
  }
}
