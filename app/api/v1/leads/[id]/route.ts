// app/api/v1/leads/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getLead } from '@/app/utils/aws/data/lead.server';
import { AuthIsUserAuthenticatedServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
// 1. Import the bridge function
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const isUserAuthenticated = await AuthIsUserAuthenticatedServer();
  if (!isUserAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    // 2. Fetch the Lead from your DB
    const lead = await getLead(id);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // 3. Enrich with Bridge Data
    // We default to null so the UI knows if data is missing
    let bridgeData = null;

    // Check if we have the required fields in the database
    if (lead.ownerAddress && lead.latitude && lead.longitude) {
      try {
        console.log(`Fetching Bridge data for lead ${id}...`);

        // Call the function we created with Axios
        bridgeData = await analyzeBridgeProperty(lead.latitude, lead.longitude);
      } catch (bridgeError) {
        // We catch the error here so we don't block the UI from loading the Lead.
        // We just log it and send the lead without the extra data.
        console.warn(`Bridge Enrichment failed for lead ${id}:`, bridgeError);
      }
    } else {
      console.log('Skipping Bridge API: Missing address, lat, or lng.');
    }

    // 4. Return the combined result
    return NextResponse.json({
      success: true,
      lead,
      marketAnalysis: bridgeData,
    });
  } catch (error: any) {
    console.error(`Error fetching lead ${params.id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Error fetching lead' },
      { status: 500 }
    );
  }
}
