import { NextResponse } from 'next/server';
import axios from 'axios';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { getValidGhlToken } from '@/amplify/functions/shared/ghlTokenManager';

/**
 * GET /api/v1/ghl/health
 *
 * Checks connection health for the authenticated user's GHL sub-account.
 * Verifies token validity against GHL API and performs auto-recovery if expired/stale.
 */
export async function GET() {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.userId;

    // 1. Fetch valid token
    let tokenData = await getValidGhlToken(userId);
    let recovered = false;

    if (!tokenData) {
      return NextResponse.json(
        {
          status: 'DISCONNECTED',
          message: 'No active GoHighLevel integration found for this account.',
        },
        { status: 200 }
      );
    }

    // 2. Ping GHL API to verify real-time token health
    try {
      await axios.get(
        `https://services.leadconnectorhq.com/locations/${tokenData.locationId}`,
        {
          headers: {
            Authorization: `Bearer ${tokenData.token}`,
            Version: '2021-07-28',
          },
        }
      );
    } catch (apiError: any) {
      // If GHL returned 401 Unauthorized, attempt forced token auto-recovery
      if (apiError.response?.status === 401) {
        console.warn(
          `⚠️ GHL API returned 401 for user ${userId}. Attempting auto-recovery token refresh...`
        );
        const refreshedData = await getValidGhlToken(userId, true);

        if (refreshedData) {
          tokenData = refreshedData;
          recovered = true;
          console.log(`✅ Token auto-recovered successfully for user ${userId}`);
        } else {
          return NextResponse.json(
            {
              status: 'REAUTH_REQUIRED',
              message:
                'GHL authorization token has expired or been revoked. Please reconnect Launch AI.',
              locationId: tokenData.locationId,
            },
            { status: 200 }
          );
        }
      } else {
        // Non-auth error (e.g. transient 5xx or network issue)
        console.warn(
          `⚠️ GHL health ping warning: ${apiError.message} (status ${apiError.response?.status})`
        );
      }
    }

    return NextResponse.json({
      status: 'HEALTHY',
      locationId: tokenData.locationId,
      integrationId: tokenData.integrationId,
      recovered,
      customFieldsConfigured: Boolean(
        tokenData.customFieldIds && Object.keys(tokenData.customFieldIds).length > 0
      ),
      agentName: tokenData.agentName || null,
      campaignCalendarId: tokenData.campaignCalendarId || null,
      dialerUserId: tokenData.dialerUserId || null,
    });
  } catch (error: any) {
    console.error('Error checking GHL integration health:', error);
    return NextResponse.json(
      { error: 'Failed to check integration health', details: error.message },
      { status: 500 }
    );
  }
}
