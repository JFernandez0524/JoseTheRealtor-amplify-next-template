import { NextRequest, NextResponse } from 'next/server';
import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
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

    // Update the lead using cookiesClient directly
    const { data: updatedLead, errors } = await cookiesClient.models.PropertyLead.update({
      id: leadId,
      zestimate: zillowData.zestimate,
      zillowZpid: zillowData.zpid,
      zillowUrl: zillowData.zillowUrl || `https://www.zillow.com/homes/${zillowData.zpid}_zpid/`,
      zillowAddress: zillowData.address,
      rentZestimate: zillowData.rentalZestimate,
      zillowLastUpdated: new Date().toISOString(),
    });

    if (errors) {
      throw new Error(errors.map((e: any) => e.message).join(', '));
    }

    return NextResponse.json({ success: true, zillowData });
  } catch (error: any) {
    console.error('Refresh Zestimate error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to refresh Zestimate' },
      { status: 500 }
    );
  }
}
