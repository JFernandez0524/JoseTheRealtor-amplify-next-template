import { NextRequest, NextResponse } from 'next/server';
import { AuthIsUserAuthenticatedServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { updateLead } from '@/app/utils/aws/data/lead.server';
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';

export async function POST(request: NextRequest) {
  try {
    const { leadId, street, city, state, zip, latitude, longitude } = await request.json();

    if (!leadId) {
      return NextResponse.json(
        { error: 'Missing leadId' },
        { status: 400 }
      );
    }

    // Verify authentication
    const isAuthenticated = await AuthIsUserAuthenticatedServer();
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch fresh Zestimate using working bridge utility
    const result = await analyzeBridgeProperty({
      street,
      city,
      state,
      zip,
      lat: latitude,
      lng: longitude,
    });

    const zillowData = result.valuation;

    if (!zillowData) {
      return NextResponse.json(
        { error: 'No Zestimate data found' },
        { status: 404 }
      );
    }

    // Update the lead using shared utility
    await updateLead({
      id: leadId,
      zestimate: zillowData.zestimate,
      zillowZpid: zillowData.zpid,
      zillowUrl: zillowData.zillowUrl || `https://www.zillow.com/homes/${zillowData.zpid}_zpid/`,
      rentZestimate: zillowData.rentalZestimate,
      zillowLastUpdated: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, zillowData });
  } catch (error: any) {
    console.error('Refresh Zestimate error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to refresh Zestimate' },
      { status: 500 }
    );
  }
}
