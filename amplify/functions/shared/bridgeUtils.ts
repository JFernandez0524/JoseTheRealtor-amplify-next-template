// Shared Bridge API utility for fetching Zestimate data
import axios from 'axios';

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_BASE_URL = 'https://api.bridgedataoutput.com/api/v2';

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
 * Fetches the best Zestimate for a property using address or coordinates
 */
export async function fetchBestZestimate(params: {
  lat?: number;
  lng?: number;
  street: string;
  city: string;
  state: string;
  zip: string;
}) {
  const { lat, lng, street: rawStreet, city: rawCity, state, zip } = params;
  const city = cleanCityName(rawCity);
  const streetVariations = generateAddressVariations(rawStreet);

  try {
    let valuation = null;

    // Try address variations
    for (const street of streetVariations) {
      try {
        const res = await bridgeClient.get('/zestimates_v2/zestimates', {
          params: { limit: 3, address: street, city, state, postalCode: zip },
        });
        if (res.data.bundle?.[0]) {
          valuation = res.data.bundle[0];
          break;
        }
      } catch (err) {}
    }

    // Coordinate fallback
    if (!valuation && lat && lng) {
      const radii = ['0.01', '0.05', '0.1', '0.25'];
      for (const radius of radii) {
        try {
          const res = await bridgeClient.get('/zestimates_v2/zestimates', {
            params: { limit: 10, near: `${lng},${lat}`, radius },
          });
          if (res.data.bundle?.[0]) {
            valuation = res.data.bundle[0];
            break;
          }
        } catch (err) {}
      }
    }

    if (!valuation) return null;

    // Sort: Priority 1 = No Unit Number (Main House), Priority 2 = Newest Date
    const bundle = [valuation];
    const sortedBundle = bundle.sort((a: any, b: any) => {
      const aIsMain = !a.unitNumber;
      const bIsMain = !b.unitNumber;
      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA;
    });

    const best = sortedBundle[0];
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
  } catch (error: any) {
    console.error('Bridge API error:', error.message);
    return null;
  }
}
