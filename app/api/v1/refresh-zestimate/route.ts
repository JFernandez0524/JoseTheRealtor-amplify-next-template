import { NextRequest, NextResponse } from 'next/server';
import { AuthIsUserAuthenticatedServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { updateLead } from '@/app/utils/aws/data/lead.server';
import { fetchBestZestimate } from '@/amplify/functions/shared/bridgeUtils';

export async function POST(request: NextRequest) {
  try {
    const { leadId, latitude, longitude } = await request.json();

    if (!leadId || !latitude || !longitude) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify authentication
    const isAuthenticated = await AuthIsUserAuthenticatedServer();
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch fresh Zestimate using shared utility
    const zillowData = await fetchBestZestimate({
      lat: latitude,
      lng: longitude,
    });

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
      zillowUrl: zillowData.url,
      rentZestimate: zillowData.rentZestimate,
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
