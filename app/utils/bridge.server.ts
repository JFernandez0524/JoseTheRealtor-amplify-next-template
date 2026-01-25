// app/utils/bridge.server.ts
import axios from 'axios';

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
  return city.replace(/\b(city|town|borough|township|village)\s+of\s+/i, '').trim();
};

const generateAddressVariations = (street: string) => {
  if (!street) return [street];
  const variations = new Set<string>();
  variations.add(street);

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
    variations.add(transform(street, config));
    variations.add(transform(street, { ...config, unitStyle: 'abbreviated' }));
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
}): Promise<{
  success: boolean;
  valuation?: any;
  assessment?: any;
  parcel?: any;
  history?: any[];
  debug?: any;
  error?: string;
}> {
  const { street: rawStreet, city: rawCity, state, zip, lat, lng } = params;
  const city = cleanCityName(rawCity || '');
  const streetVariations = generateAddressVariations(rawStreet || '');

  console.log('🔍 Bridge API search params:', { rawStreet, city, state, zip, lat, lng });
  console.log('📝 Street variations:', streetVariations);

  let valuation = null;
  let successfulVariation = null;

  // Try address variations
  for (const street of streetVariations) {
    try {
      const res = await bridgeClient.get('/zestimates_v2/zestimates', {
        params: { limit: 10, address: street, city, state, postalCode: zip },
      });
      console.log(`🔎 Trying: ${street}, ${city}, ${state} ${zip}`);
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
      console.log(`❌ API error for: ${street}`);
    }
  }

  // If no valuation found by address, try coordinate search as fallback
  if (!valuation && lat && lng) {
    console.log('🌍 Trying coordinate-based search as fallback...');
    const radii = ['0.01', '0.05', '0.1'];
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
        console.log(`❌ Coordinate search failed for radius ${radius}`);
      }
    }
  }

  if (!valuation) {
    console.log('❌ No property found for address');
    console.log('🔍 Search details:', { rawStreet, city, state, zip, lat, lng });
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
    } catch (err) {}
  }

  if (!assessment && streetVariations.length > 0) {
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
      } catch (err) {}
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

/**
 * Simplified wrapper for CSV upload - returns just the Zestimate data
 */
export async function fetchBestZestimate(params: {
  lat?: number;
  lng?: number;
  street: string;
  city: string;
  state: string;
  zip: string;
}): Promise<{
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
} | null> {
  const result = await analyzeBridgeProperty(params);
  
  if (!result.success || !result.valuation) {
    return null;
  }

  const best = result.valuation;
  return {
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
  };
}
