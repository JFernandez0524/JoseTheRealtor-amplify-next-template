// app/utils/bridge.server.ts

import { NextResponse } from 'next/server';
import { validateAddressWithGoogle } from './google.server';

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_BASE_URL = 'https://api.bridgedataoutput.com/api/v2';

if (!BRIDGE_API_KEY) {
  throw new Error('BRIDGE_API_KEY is not set in .env.local');
}

/**
 * A generic helper function to make authenticated requests to the Bridge API
 */
async function fetchFromBridge(endpoint: string) {
  // ... (This function is unchanged)
  const url = `${BRIDGE_BASE_URL}/${endpoint}`;
  console.log(`Fetching from Bridge: ${url}`);
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${BRIDGE_API_KEY}` },
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Bridge API error for ${endpoint}:`, errorBody);
    throw new Error(
      `Failed to fetch data from ${endpoint}. Response: ${errorBody}`
    );
  }
  return response.json();
}

/**
 * Fetches and analyzes property data from Google and Bridge.
 */
export async function analyzeBridgeProperty(address: string) {
  // --- 1. Validate Address & Get Coords (Google) ---
  const validation = await validateAddressWithGoogle(address);
  if (!validation.success) {
    throw new Error('Address validation failed.');
  }

  // --- 2. Format Coordinates for Bridge API ---
  const { lat, lng } = validation.location;
  const nearCoordinates = `${lng},${lat}`;

  // --- 3. Make API Calls in Parallel (Bridge) ---
  const [zestimateData, transactionData, assessmentData] = await Promise.all([
    fetchFromBridge(
      `zestimates_v2/zestimates?near=${nearCoordinates}&radius=0.1mi`
    ),
    fetchFromBridge(
      `pub/transactions?near=${nearCoordinates}&radius=0.1mi&sortBy=recordingDate&order=desc&limit=1&category=deed`
    ),
    fetchFromBridge(`pub/assessments?near=${nearCoordinates}&radius=0.1mi`),
  ]);

  // --- 4. Extract Core Data ---
  const property = zestimateData.bundle?.[0];
  const lastTransaction = transactionData.bundle?.[0];
  const assessment = assessmentData.bundle?.[0];

  if (!property || !assessment) {
    throw new Error(
      'Property not found in Zestimates or Assessments. Check the address.'
    );
  }

  const zestimate = property.zestimate;
  const rentZestimate = property.rentalZestimate;
  const lastSoldPrice = lastTransaction?.salesPrice;
  const fipsCode = assessment.fips;
  const building = assessment.building?.[0];
  const area = assessment.areas?.find(
    (a: any) => a.type === 'Living Building Area'
  );
  const buildingData = {
    /* ... (building data) ... */
  };

  // --- 5. Get Market Report (Bridge, using FIPS code) ---
  let marketReport = null;
  if (fipsCode) {
    /* ... (try/catch for market report) ... */
  }

  // --- 6. Perform "Biz Logic" Analysis ---
  let fixAndFlipAnalysis = 'N/A: Zestimate or Last Sold Price missing.';
  if (zestimate && lastSoldPrice) {
    const estimatedEquity = zestimate - lastSoldPrice;
    fixAndFlipAnalysis = `Potential gross equity of $${estimatedEquity.toLocaleString()}.`;
  }
  let buyAndHoldAnalysis = 'N/A: Zestimate or Rent Zestimate missing.';
  if (rentZestimate && zestimate && zestimate > 0) {
    const rentToPriceRatio = (rentZestimate / zestimate) * 100;
    buyAndHoldAnalysis = `Rent/Price ratio: ${rentToPriceRatio.toFixed(2)}%.`;
  }

  // --- 7. ⭐ NEW: Calculate Cash Offer ---
  let cashOffer = null;
  if (zestimate && zestimate > 0) {
    cashOffer = zestimate * 0.75;
  }

  // --- 8. Return Combined Results ---
  return {
    address: validation.formattedAddress || address,
    city: property.city || 'N/A',
    state: property.state || 'N/A',
    zipcode: property.postalCode || 'N/A',
    zestimate,
    lastSoldPrice,
    rentZestimate,
    fixAndFlipAnalysis,
    buyAndHoldAnalysis,
    building: buildingData,
    marketReport: {
      /* ... */
    },
    location: validation.location,
    cashOffer: cashOffer, // ⭐ ADDED THIS
  };
}
