import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { validateAndStandardizeAddress } from '@/app/utils/google.server';
import { getPropertyDataByAddress } from '@/app/utils/bridge.server';

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
    const validation = await validateAndStandardizeAddress(fullAddress);

    if (!validation.isValid) {
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
      const propertyData = await getPropertyDataByAddress(
        address,
        city,
        state,
        zip,
        validation.latitude,
        validation.longitude
      );

      if (propertyData) {
        zestimate = propertyData.zestimate;
        zpid = propertyData.zpid;
      }
    } catch (error) {
      console.error('Zestimate fetch failed:', error);
      // Continue without Zestimate
    }

    return NextResponse.json({
      success: true,
      validation,
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
