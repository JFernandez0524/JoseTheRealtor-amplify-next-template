// app/utils/bridge.server.ts
import axios from 'axios';
import { classifyBridgeError, describeBridgeError } from './bridgeErrors';

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_BASE_URL = 'https://api.bridgedataoutput.com/api/v2';

if (!BRIDGE_API_KEY) {
  throw new Error('BRIDGE_API_KEY is not set in .env.local');
}

const bridgeClient = axios.create({
  baseURL: BRIDGE_BASE_URL,
  headers: { Authorization: `Bearer ${BRIDGE_API_KEY}` },
});

const cleanCityName = (city: string) => {
  if (!city) return '';
  return city
    .replace(/\b(city|town|borough|township|village)\s+of\s+/i, '')
    .replace(/\s+(beach|township|borough|village)$/i, '')
    .trim();
};

const generateAddressVariations = (street: string) => {
  if (!street) return [street];
  const variations = new Set<string>();
  
  // Handle double lot addresses (e.g., "464-466 Boulevard" → "464 Boulevard", "466 Boulevard")
  const doubleLotMatch = street.match(/^(\d+)-(\d+)\s+(.+)$/);
  if (doubleLotMatch) {
    const [, firstNum, secondNum, restOfAddress] = doubleLotMatch;
    variations.add(`${firstNum} ${restOfAddress}`);
    variations.add(`${secondNum} ${restOfAddress}`);
  }
  
  // Convert to Title Case first (Bridge API prefers this format)
  const toTitleCase = (str: string) => {
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };
  
  const titleCaseStreet = toTitleCase(street);
  variations.add(titleCaseStreet);
  variations.add(street); // Keep original too

  // Convert word ordinals to numeric (First → 1st, Second → 2nd, etc.)
  const ordinalMap: Record<string, string> = {
    'First': '1st', 'Second': '2nd', 'Third': '3rd', 'Fourth': '4th',
    'Fifth': '5th', 'Sixth': '6th', 'Seventh': '7th', 'Eighth': '8th',
    'Ninth': '9th', 'Tenth': '10th'
  };
  
  let withNumericOrdinals = titleCaseStreet;
  Object.entries(ordinalMap).forEach(([word, numeric]) => {
    withNumericOrdinals = withNumericOrdinals.replace(new RegExp(`\\b${word}\\b`, 'gi'), numeric);
  });
  if (withNumericOrdinals !== titleCaseStreet) {
    variations.add(withNumericOrdinals);
  }

  const transform = (addr: string, options: { directionStyle: 'full' | 'usps' | 'zillow'; removeOrdinals?: boolean; unitStyle?: 'abbreviated' | 'full' }) => {
    let result = addr;
    if (options.removeOrdinals) {
      result = result.replace(/^(\d+)(st|nd|rd|th)\b/gi, '$1');
    }
    if (options.directionStyle === 'usps') {
      result = result.replace(/\bNorth\b/gi, 'N').replace(/\bSouth\b/gi, 'S').replace(/\bEast\b/gi, 'E').replace(/\bWest\b/gi, 'W');
    } else if (options.directionStyle === 'zillow') {
      result = result.replace(/\bNorth\b/gi, 'No').replace(/\bSouth\b/gi, 'So').replace(/\bEast\b/gi, 'E').replace(/\bWest\b/gi, 'W');
    }
    result = result.replace(/\bStreet\b/gi, 'St').replace(/\bAvenue\b/gi, 'Ave').replace(/\bBoulevard\b/gi, 'Blvd').replace(/\bDrive\b/gi, 'Dr').replace(/\bRoad\b/gi, 'Rd').replace(/\bLane\b/gi, 'Ln').replace(/\bCourt\b/gi, 'Ct').replace(/\bCircle\b/gi, 'Cir').replace(/\bPlace\b/gi, 'Pl').replace(/\bTerrace\b/gi, 'Ter').replace(/\bParkway\b/gi, 'Pkwy');
    if (options.unitStyle === 'abbreviated') {
      result = result.replace(/\bApartment\b/gi, 'Apt').replace(/\bUnit\b/gi, 'Unit').replace(/\bSuite\b/gi, 'Ste').replace(/\b#\s*/g, '#');
    }
    return result.trim();
  };

  const configs = [
    { directionStyle: 'full' as const, removeOrdinals: false },
    { directionStyle: 'usps' as const, removeOrdinals: false },
    { directionStyle: 'zillow' as const, removeOrdinals: false },
    { directionStyle: 'full' as const, removeOrdinals: true },
    { directionStyle: 'usps' as const, removeOrdinals: true },
    { directionStyle: 'zillow' as const, removeOrdinals: true },
  ];

  configs.forEach((config) => {
    variations.add(transform(titleCaseStreet, config));
    variations.add(transform(titleCaseStreet, { ...config, unitStyle: 'abbreviated' }));
    variations.add(transform(street, config)); // Try original format too
  });

  return Array.from(variations).filter((v) => v);
};

/**
 * Analyzes property using Bridge API - matches /api/v1/analyze-property behavior
 */
export async function analyzeBridgeProperty(params: {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  zpid?: string;
}): Promise<{
  success: boolean;
  valuation?: any;
  assessment?: any;
  parcel?: any;
  history?: any[];
  debug?: any;
  error?: string;
  /** True when Bridge rejected our credentials (401/403) — distinct from "address not found". */
  authFailed?: boolean;
}> {
  const { street: rawStreet, city: rawCity, state, zip, lat, lng, zpid: zpidParam } = params;
  const city = cleanCityName(rawCity || '');
  const streetVariations = generateAddressVariations(rawStreet || '');
  const zip5 = zip?.split('-')[0] || undefined; // Strip ZIP+4; coerce empty string to undefined so Bridge API omits the param

  console.log('🔍 Bridge API search params:', { rawStreet, city, state, zip: zip5, lat, lng });
  console.log('📝 Street variations:', streetVariations);

  let valuation = null;
  let successfulVariation = null;
  // Tripped by the first 401/403. Every fallback below reuses the same credential, so once it is
  // rejected there is nothing left to try — bail instead of firing ~7 more doomed requests.
  let authFailed = false;

  // Try address variations
  for (const street of streetVariations) {
    try {
      const res = await bridgeClient.get('/zestimates_v2/zestimates', {
        params: { limit: 10, address: street, city, state, postalCode: zip5 },
      });
      console.log(`🔎 Trying: ${street}, ${city}, ${state} ${zip5}`);
      console.log(`📦 Bridge returned ${res.data.bundle?.length || 0} results`);
      
      if (res.data.bundle?.length > 0) {
        console.log(`📍 Results:`, res.data.bundle.map((r: any) => ({
          address: r.address,
          city: r.city,
          state: r.state,
          zip: r.postalCode,
          zestimate: r.zestimate
        })));
        
        // Sort: Priority 1 = No Unit Number (Main House), Priority 2 = Newest Date
        const sortedBundle = res.data.bundle.sort((a: any, b: any) => {
          const aIsMain = !a.unitNumber;
          const bIsMain = !b.unitNumber;
          if (aIsMain && !bIsMain) return -1;
          if (!aIsMain && bIsMain) return 1;
          const dateA = new Date(a.timestamp).getTime();
          const dateB = new Date(b.timestamp).getTime();
          return dateB - dateA;
        });
        valuation = sortedBundle[0];
        successfulVariation = street;
        console.log(`✅ Selected Zestimate: $${valuation.zestimate} (${valuation.timestamp}, unitNumber: ${valuation.unitNumber || 'none'})`);
        break;
      }
    } catch (err) {
      console.log(`❌ Bridge API error for "${street}": ${describeBridgeError(err)}`);
      if (classifyBridgeError(err).isAuthFailure) {
        authFailed = true;
        break;
      }
    }
  }

  // If no valuation found by address, try coordinate search as fallback
  if (!valuation && !authFailed && lat && lng) {
    console.log('🌍 Trying coordinate-based search as fallback...');
    const radii = ['0.0005', '0.001', '0.002']; // ~55m, ~110m, ~220m
    for (const radius of radii) {
      try {
        const res = await bridgeClient.get('/zestimates_v2/zestimates', {
          params: { limit: 10, near: `${lng},${lat}`, radius },
        });
        console.log(`📦 Coordinate search (radius ${radius}): ${res.data.bundle?.length || 0} results`);
        
        if (res.data.bundle?.length > 0) {
          console.log(`📍 Nearby properties:`, res.data.bundle.map((r: any) => ({
            address: r.address,
            distance: 'nearby',
            zestimate: r.zestimate
          })));
          
          // Sort and pick best match
          const sortedBundle = res.data.bundle.sort((a: any, b: any) => {
            const aIsMain = !a.unitNumber;
            const bIsMain = !b.unitNumber;
            if (aIsMain && !bIsMain) return -1;
            if (!aIsMain && bIsMain) return 1;
            const dateA = new Date(a.timestamp).getTime();
            const dateB = new Date(b.timestamp).getTime();
            return dateB - dateA;
          });
          valuation = sortedBundle[0];
          successfulVariation = 'coordinate-based';
          console.log(`✅ Found via coordinates: $${valuation.zestimate} at ${valuation.address}`);
          break;
        }
      } catch (err) {
        console.log(`❌ Coordinate search failed for radius ${radius}: ${describeBridgeError(err)}`);
        if (classifyBridgeError(err).isAuthFailure) {
          authFailed = true;
          break;
        }
      }
    }
  }

  // If address and coordinate searches failed but we have a zpid, try direct zpid lookup
  if (!valuation && !authFailed && zpidParam) {
    console.log(`🔗 Trying zpid-based lookup as final fallback: ${zpidParam}`);
    try {
      const res = await bridgeClient.get('/zestimates_v2/zestimates', {
        params: { limit: 1, zpid: zpidParam },
      });
      console.log(`📦 zpid lookup returned ${res.data.bundle?.length || 0} results`);
      if (res.data.bundle?.length > 0) {
        valuation = res.data.bundle[0];
        successfulVariation = `zpid:${zpidParam}`;
        console.log(`✅ Found via zpid: $${valuation.zestimate}`);
      }
    } catch (err) {
      console.log(`❌ zpid-based lookup failed: ${describeBridgeError(err)}`);
      if (classifyBridgeError(err).isAuthFailure) authFailed = true;
    }
  }

  if (!valuation) {
    // Distinguish "this address isn't in Bridge" from "our credential is dead" — the first is
    // normal and per-address, the second means every lead in the run will fail the same way.
    if (authFailed) {
      console.error(
        `🔑 Bridge API credentials rejected — skipping remaining lookups for "${rawStreet}". ` +
          'Zestimates are unavailable until BRIDGE_API_KEY is renewed.'
      );
      return {
        success: false,
        error: 'Bridge API credentials were rejected. Zestimate data is unavailable.',
        authFailed: true,
      };
    }
    console.log('❌ No property found for address');
    console.log('🔍 Search details:', { rawStreet, city, state, zip, lat, lng, zpid: zpidParam });
    console.log('📝 Tried variations:', streetVariations);
    return { success: false, error: 'Property not found. Please verify the address is correct.' };
  }

  const zpid = valuation?.zpid;
  const targetState = valuation?.state || state;

  // Assessment waterfall - only use zpid or address, no coordinates
  let assessment = null;

  if (zpid) {
    try {
      const res = await bridgeClient.get('/pub/assessments', {
        params: { zpid, limit: 1, 'address.state': targetState },
      });
      assessment = res.data.bundle?.[0];
    } catch (err) {
      console.log(`❌ Assessment lookup by zpid ${zpid} failed: ${describeBridgeError(err)}`);
      if (classifyBridgeError(err).isAuthFailure) authFailed = true;
    }
  }

  if (!assessment && !authFailed && streetVariations.length > 0) {
    for (const street of streetVariations) {
      try {
        const res = await bridgeClient.get('/pub/assessments', {
          params: { 'address.full': street, 'address.city': city, 'address.state': targetState, limit: 3 },
        });
        const stateMatch = res.data.bundle?.find((a: any) => a.address?.state === targetState);
        if (stateMatch) {
          assessment = stateMatch;
          break;
        }
      } catch (err) {
        console.log(`❌ Assessment lookup for "${street}" failed: ${describeBridgeError(err)}`);
        if (classifyBridgeError(err).isAuthFailure) {
          authFailed = true;
          break;
        }
      }
    }
  }

  return {
    success: true,
    valuation: valuation || null,
    assessment: assessment || null,
    parcel: assessment || null,
    history: [],
    debug: {
      searched: { originalStreet: rawStreet, variations: streetVariations, successfulVariation, city, state, zip, lat, lng },
      found: { valuation: !!valuation, assessment: !!assessment, zpid: zpid || null },
    },
  };
}

export type ZestimateResult = {
  zpid: string;
  zestimate: number;
  rentZestimate?: number;
  url: string;
  lastUpdated: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
};

/**
 * Fetch a Zestimate, preserving *why* it failed.
 *
 * `fetchBestZestimate` collapses "no match for this address" and "our credential is dead" into the
 * same `null`, which is fine for one-off lookups but not for a bulk import: a caller looping over
 * hundreds of rows needs to stop after the first auth failure instead of retrying each one. Callers
 * that don't care can keep using `fetchBestZestimate`.
 *
 * Used by: uploadCsvHandler (per-invocation circuit breaker).
 */
export async function fetchBestZestimateResult(params: {
  lat?: number;
  lng?: number;
  street: string;
  city: string;
  state: string;
  zip: string;
}): Promise<{ data: ZestimateResult | null; authFailed: boolean }> {
  const result = await analyzeBridgeProperty(params);

  if (!result.success || !result.valuation) {
    return { data: null, authFailed: result.authFailed === true };
  }

  const best = result.valuation;
  return {
    data: {
      zpid: best.zpid,
      zestimate: best.zestimate,
      rentZestimate: best.rentalZestimate,
      url: best.zillowUrl || `https://www.zillow.com/homes/${best.zpid}_zpid/`,
      lastUpdated: best.timestamp,
      address: best.address,
      city: best.city,
      state: best.state,
      postalCode: best.postalCode,
      latitude: best.Latitude,
      longitude: best.Longitude,
    },
    authFailed: false,
  };
}

/**
 * Simplified wrapper — returns just the Zestimate data, or null on any failure.
 *
 * Delegates to `fetchBestZestimateResult` and drops the failure reason. Use that instead when the
 * caller needs to distinguish a credential outage from a per-address miss.
 */
export async function fetchBestZestimate(params: {
  lat?: number;
  lng?: number;
  street: string;
  city: string;
  state: string;
  zip: string;
}): Promise<ZestimateResult | null> {
  const { data } = await fetchBestZestimateResult(params);
  return data;
}
