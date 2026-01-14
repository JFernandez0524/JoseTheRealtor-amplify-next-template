// Shared Bridge API utility for fetching Zestimate data
import axios from 'axios';

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_BASE_URL = 'https://api.bridgedataoutput.com/api/v2';

const bridgeClient = axios.create({
  baseURL: BRIDGE_BASE_URL,
  headers: { Authorization: `Bearer ${BRIDGE_API_KEY}` },
});

/**
 * Fetches the best Zestimate for a property using coordinates
 * Handles multi-unit properties by prioritizing main house over apartments
 */
export async function fetchBestZestimate(params: {
  lat: number;
  lng: number;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}) {
  const { lat, lng } = params;

  try {
    // Fetch multiple results to handle multi-unit properties
    const response = await bridgeClient.get('/zestimates_v2/zestimates', {
      params: {
        near: `${lng},${lat}`,
        radius: '0.05mi',
        limit: 5,
      },
    });

    const bundle = response.data.bundle || [];
    if (bundle.length === 0) return null;

    // Sort: Priority 1 = No Unit Number (Main House), Priority 2 = Newest Date
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
      url: best.zillowUrl,
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
