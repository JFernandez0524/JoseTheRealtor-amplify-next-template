import { NextResponse } from 'next/server';
import axios from 'axios';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import {
  getValidGhlToken,
  getGhlIntegration,
  refreshGhlToken,
} from '@/app/utils/aws/data/ghlIntegration.server';

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

    // 1. Fetch user integration record
    const integration = await getGhlIntegration(userId);
    if (!integration) {
      return NextResponse.json(
        {
          status: 'DISCONNECTED',
          message: 'No active GoHighLevel integration found for this account.',
        },
        { status: 200 }
      );
    }

    // 2. Fetch or refresh valid token
    let token = await getValidGhlToken(userId);
    let recovered = false;

    if (!token && integration.refreshToken) {
      token = await refreshGhlToken(integration.id, integration.refreshToken);
      if (token) recovered = true;
    }

    if (!token) {
      return NextResponse.json(
        {
          status: 'REAUTH_REQUIRED',
          message:
            'GHL authorization token has expired or been revoked. Please reconnect Launch AI.',
          locationId: integration.locationId,
        },
        { status: 200 }
      );
    }

    // 3. Ping GHL API to verify real-time token health
    try {
      await axios.get(
        `https://services.leadconnectorhq.com/locations/${integration.locationId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Version: '2021-07-28',
          },
        }
      );
    } catch (apiError: any) {
      // If GHL returned 401 Unauthorized, attempt forced token auto-recovery
      if (apiError.response?.status === 401 && integration.refreshToken) {
        console.warn(
          `⚠️ GHL API returned 401 for user ${userId}. Attempting auto-recovery token refresh...`
        );
        const refreshedToken = await refreshGhlToken(integration.id, integration.refreshToken);

        if (refreshedToken) {
          token = refreshedToken;
          recovered = true;
          console.log(`✅ Token auto-recovered successfully for user ${userId}`);
        } else {
          return NextResponse.json(
            {
              status: 'REAUTH_REQUIRED',
              message:
                'GHL authorization token has expired or been revoked. Please reconnect Launch AI.',
              locationId: integration.locationId,
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

    // Parse customFieldIds if stored as JSON string
    let parsedCustomFieldIds = integration.customFieldIds;
    if (typeof parsedCustomFieldIds === 'string') {
      try {
        parsedCustomFieldIds = JSON.parse(parsedCustomFieldIds);
      } catch {
        parsedCustomFieldIds = null;
      }
    }

    return NextResponse.json({
      status: 'HEALTHY',
      locationId: integration.locationId,
      integrationId: integration.id,
      recovered,
      customFieldsConfigured: Boolean(
        parsedCustomFieldIds && Object.keys(parsedCustomFieldIds).length > 0
      ),
      agentName: integration.agentName || null,
      campaignCalendarId: integration.campaignCalendarId || null,
      dialerUserId: integration.dialerUserId || null,
    });
  } catch (error: any) {
    console.error('Error checking GHL integration health:', error);
    return NextResponse.json(
      { error: 'Failed to check integration health', details: error.message },
      { status: 500 }
    );
  }
}
