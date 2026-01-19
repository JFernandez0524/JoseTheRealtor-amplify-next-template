import { NextResponse } from 'next/server';
import axios from 'axios';
import { AuthGetCurrentUserServer, cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { getValidGhlToken } from '@/app/utils/aws/data/ghlIntegration.server';

/**
 * GET GHL PHONE NUMBERS
 * 
 * Fetches all available phone numbers from user's GHL account
 * Used in settings page for phone number selection
 */
export async function GET(req: Request) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's GHL integration
    const { data: integrations } = await cookiesClient.models.GhlIntegration.list({
      filter: {
        userId: { eq: user.userId },
        isActive: { eq: true }
      }
    });

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ error: 'GHL not connected' }, { status: 404 });
    }

    const integration = integrations[0];
    const accessToken = await getValidGhlToken(user.userId);

    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to get access token' }, { status: 500 });
    }

    // Fetch phone numbers from GHL
    const response = await axios.get(
      `https://services.leadconnectorhq.com/locations/${integration.locationId}/phoneNumbers`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28'
        }
      }
    );

    const phoneNumbers = response.data.phoneNumbers || [];

    return NextResponse.json({
      success: true,
      phoneNumbers: phoneNumbers.map((p: any) => ({
        number: p.number,
        name: p.name || '',
        isDefault: p.isDefault || false,
        type: p.type || 'unknown'
      }))
    });

  } catch (error: any) {
    console.error('Error fetching phone numbers:', error.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
