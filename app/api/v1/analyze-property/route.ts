// app/api/analyze-property/route.ts
import { NextResponse } from 'next/server';
import { validateAddressWithGoogle } from '@/app/utils/google.server';
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';

export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Address is required' },
        { status: 400 }
      );
    }

    // --- Step 1: Validate Address (Google) ---
    // This ensures we are asking Bridge for a real, formatted address
    // --- Step 1: Validate Address (Google) ---
    const validation = await validateAddressWithGoogle(address);

    // SAFETY TWEAK: Check if validation failed OR if location is missing
    if (!validation || !validation.location) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not validate this address. Please try again.',
        },
        { status: 400 }
      );
    }

    // --- Step 2: Fetch Property Data ---
    // Now valid to access .lat and .lng
    const bridgeData = await analyzeBridgeProperty(
      validation.location.lat,
      validation.location.lng
    );
    // --- Step 3: Calculate Teaser Metrics ---
    // Example: A simple "Instant Cash Offer" estimation (e.g., 75% of Zestimate)
    const zestimate = bridgeData.zestimate || 0;
    const cashOffer = zestimate > 0 ? Math.round(zestimate * 0.75) : null;

    // --- Step 4: Construct Response ---
    const data = bridgeData as any;

    const responsePayload = {
      success: true,
      address: validation.formattedAddress,
      location: validation.location,
      zestimate: data.zestimate,
      rentZestimate: data.rentZestimate,
      lastSoldPrice: data.lastSoldPrice || null,
      cashOffer: cashOffer,
      // FIX: Use data.building if it exists, or try to find fields at the root
      building: data.building || {
        yearBuilt: data.yearBuilt || null,
        squareFeet: data.squareFeet || data.livingArea || null,
        bedrooms: data.bedrooms || null,
        baths: data.baths || data.bathrooms || null,
        description: data.description || null,
      },
    };

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error('Analyze Property Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
