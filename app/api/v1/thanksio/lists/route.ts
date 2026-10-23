import { NextResponse } from 'next/server';
import { AuthGetCurrentUserServer, AuthGetUserGroupsServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { getThanksIoSettings } from '@/app/utils/aws/data/thanksIoIntegration.server';
import { THANKS_IO_API_BASE, THANKS_IO_LISTS } from '@/amplify/functions/shared/thanksIoRecipients';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/thanksio/lists
 * Fetches the user's mailing lists directly from their Thanks.io account.
 */
export async function GET() {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getThanksIoSettings(user.userId);
    let apiKey = settings.apiKey;

    // Admin fallback for testing if no personal key is set
    if (!apiKey) {
      const groups = await AuthGetUserGroupsServer();
      if (groups.includes('ADMINS') && process.env.THANKS_IO_API) {
        apiKey = process.env.THANKS_IO_API;
      }
    }

    if (!apiKey) {
      return NextResponse.json({
        connected: false,
        lists: [],
      });
    }

    // Call Thanks.io API with the user's key
    const res = await fetch(`${THANKS_IO_API_BASE}/mailing-lists`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({
          connected: false,
          error: 'Invalid Thanks.io API Key. Please update your key in Settings.',
          lists: [],
        });
      }
      throw new Error(`Thanks.io returned status ${res.status}`);
    }

    const json = await res.json();
    const rawLists = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

    // Map the user's real Thanks.io mailing lists
    const userLists = rawLists.map((item: any) => ({
      id: Number(item.id),
      label: item.name || item.title || `Mailing List #${item.id}`,
      totalRecipients: item.total_recipients ?? item.recipients_count ?? 0,
    }));

    // If their account is new and has no lists yet, provide fallback recommendations
    const lists = userLists.length > 0 ? userLists : Object.values(THANKS_IO_LISTS);

    return NextResponse.json({
      connected: true,
      lists,
      accountEmail: settings.accountEmail,
    });
  } catch (error: any) {
    console.error('❌ [THANKS.IO] Failed to fetch mailing lists:', error.message);
    return NextResponse.json(
      {
        connected: false,
        error: error.message || 'Failed to fetch mailing lists',
        lists: [],
      },
      { status: 500 },
    );
  }
}
