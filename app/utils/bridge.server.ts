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

/**
 * Enriches Lead Data using ONLY Latitude and Longitude.
 * Uses the 'near' parameter (Long,Lat) to find the closest property.
 */
export async function analyzeBridgeProperty(lat: number, lng: number) {
  // Bridge API format for 'near' is "longitude,latitude"
  const nearParam = `${lng},${lat}`;
  // We use a very small radius (0.05 miles) to ensure we get the specific house
  const radius = '0.05mi';

  // --- 1. Fetch Zestimates & Assessments (Parallel) ---
  const [zestimateResp, assessmentResp] = await Promise.all([
    bridgeClient.get('/zestimates_v2/zestimates', {
      params: { near: nearParam, radius: radius, limit: 1 },
    }),
    bridgeClient.get('/pub/assessments', {
      params: {
        near: nearParam,
        radius: radius,
        limit: 1,
        sortBy: 'year',
        order: 'desc',
      },
    }),
  ]).catch((err) => {
    console.error('Bridge Initial Fetch Error:', err.message);
    return [{ data: { bundle: [] } }, { data: { bundle: [] } }];
  });

  const zestimateData = zestimateResp.data.bundle?.[0];
  const assessmentData = assessmentResp.data.bundle?.[0];

  // --- 2. Fetch Transactions (Requires Parcel ID from Assessment) ---
  // Even though we search by coords, getting the Parcel ID allows us to get the EXACT sales history
  let lastTransaction = null;
  const parcelId = assessmentData?.parcelId || assessmentData?.id;

  if (parcelId) {
    try {
      const transactionResp = await bridgeClient.get(
        `/pub/parcels/${parcelId}/transactions`,
        {
          params: { limit: 1, sortBy: 'recordingDate', order: 'desc' },
        }
      );
      lastTransaction = transactionResp.data.bundle?.[0];
    } catch (error: any) {
      console.warn('Failed to fetch transactions:', error.message);
    }
  }

  // --- 3. Parse Data ---
  const zestimate = zestimateData?.zestimate || 0;
  const rentZestimate = zestimateData?.rentalZestimate || 0;
  const lastSoldPrice =
    lastTransaction?.document?.amount || lastTransaction?.salesPrice || 0;

  // Building/Assessment Data
  const building = assessmentData?.building?.[0] || {};
  const yearBuilt = assessmentData?.yearBuilt || building.yearBuilt;
  const sqFt = assessmentData?.livingArea || building.finishedLivingArea;

  // --- 4. Biz Logic ---
  let fixAndFlipAnalysis = 'N/A: Missing Zestimate or Sold Price';
  if (zestimate > 0 && lastSoldPrice > 0) {
    const estimatedEquity = zestimate - lastSoldPrice;
    fixAndFlipAnalysis = `Potential Gross Equity: $${estimatedEquity.toLocaleString()}`;
  }

  let buyAndHoldAnalysis = 'N/A: Missing Rent or Price data';
  if (rentZestimate > 0 && zestimate > 0) {
    const rentToPriceRatio = (rentZestimate / zestimate) * 100;
    buyAndHoldAnalysis = `Rent/Price Ratio: ${rentToPriceRatio.toFixed(2)}%`;
  }

  let cashOffer = null;
  if (zestimate > 0) {
    cashOffer = zestimate * 0.75;
  }

  return {
    location: { lat, lng },
    zestimate,
    rentZestimate,
    lastSoldPrice,
    lastSoldDate: lastTransaction?.recordingDate || null,
    details: {
      yearBuilt,
      sqFt,
      bedrooms: assessmentData?.bedrooms,
      bathrooms: assessmentData?.bathrooms,
      taxAmount: assessmentData?.taxAmount,
      taxYear: assessmentData?.year,
    },
    fixAndFlipAnalysis,
    buyAndHoldAnalysis,
    cashOffer,
    // Return raw address from Bridge in case you want to verify it matches your DB
    bridgeAddress: assessmentData?.address?.full || zestimateData?.address,
  };
}
