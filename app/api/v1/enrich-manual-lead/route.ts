import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { validateAddressWithGoogle } from '@/app/utils/google.server';
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';

export async function POST(request: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { address, city, state, zip } = await request.json();

    if (!address || !city || !state || !zip) {
      return NextResponse.json(
        { error: 'Address fields are required' },
        { status: 400 }
      );
    }

    // 1. Validate and standardize address
    const fullAddress = `${address}, ${city}, ${state} ${zip}`;
    const validation = await validateAddressWithGoogle(fullAddress);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid address',
        validation,
      });
    }

    // 2. Fetch Zestimate
    let zestimate = null;
    let zpid = null;

    try {
      const propertyData = await analyzeBridgeProperty({
        street: address,
        city,
        state,
        zip,
        lat: validation.location.lat,
        lng: validation.location.lng
      });

      if (propertyData.success && propertyData.valuation) {
        zestimate = propertyData.valuation.zestimate;
        zpid = propertyData.valuation.zpid;
      }
    } catch (error) {
      console.error('Zestimate fetch failed:', error);
      // Continue without Zestimate
    }

    return NextResponse.json({
      success: true,
      standardizedAddress: validation.formattedAddress,
      latitude: validation.location.lat,
      longitude: validation.location.lng,
      components: validation.components,
      zestimate,
      zpid,
    });
  } catch (error) {
    console.error('Enrich lead error:', error);
    return NextResponse.json(
      {
        error: 'Failed to enrich lead data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
