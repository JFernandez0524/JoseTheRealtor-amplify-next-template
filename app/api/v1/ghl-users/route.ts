import { NextResponse } from 'next/server';
import { createGhlClient } from '../../../../amplify/functions/shared/ghlClient';
import { AuthGetCurrentUserServer, cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { getValidGhlToken } from '@/app/utils/aws/data/ghlIntegration.server';

/**
 * GET GHL USERS
 *
 * Fetches the users in the connected GHL sub-account.
 * Used in profile settings to pick the user that synced/callable contacts are assigned to.
 */
export async function GET(req: Request) {
  console.log('👥 [GHL_USERS] Fetching users...');

  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: integrations } = await cookiesClient.models.GhlIntegration.list({
      filter: { userId: { eq: user.userId }, isActive: { eq: true } },
    });

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ error: 'GHL not connected' }, { status: 404 });
    }

    const integration = integrations[0];
    const token = await getValidGhlToken(user.userId);
    if (!token) {
      return NextResponse.json({ error: 'Failed to get access token' }, { status: 500 });
    }

    const ghl = createGhlClient(token);
    const response = await ghl.get('/users/', { params: { locationId: integration.locationId } });
    const users = response.data?.users || [];
    console.log(`✅ [GHL_USERS] Found ${users.length} users`);

    return NextResponse.json({
      success: true,
      users: users.map((u: any) => ({
        id: u.id,
        name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unnamed user',
        email: u.email || '',
      })),
    });
  } catch (error: any) {
    console.error('❌ [GHL_USERS] Error:', error.response?.data || error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
