import { NextResponse } from 'next/server';
import { createGhlClient } from '../../../../amplify/functions/shared/ghlClient';
import { AuthGetCurrentUserServer, cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { getValidGhlToken } from '@/app/utils/aws/data/ghlIntegration.server';

/**
 * GET GHL CALENDARS
 *
 * Fetches the calendars in the connected GHL sub-account.
 * Used in profile settings to pick the calendar for AI-booked appointments.
 */
export async function GET(req: Request) {
  console.log('📅 [GHL_CALENDARS] Fetching calendars...');

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
    const response = await ghl.get('/calendars/', { params: { locationId: integration.locationId } });
    const calendars = response.data?.calendars || [];
    console.log(`✅ [GHL_CALENDARS] Found ${calendars.length} calendars`);

    return NextResponse.json({
      success: true,
      calendars: calendars.map((c: any) => ({
        id: c.id,
        name: c.name || c.calendarName || 'Unnamed calendar',
      })),
    });
  } catch (error: any) {
    console.error('❌ [GHL_CALENDARS] Error:', error.response?.data || error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
