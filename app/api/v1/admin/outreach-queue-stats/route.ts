import { NextResponse } from 'next/server';
import {
  AuthGetUserGroupsServer,
  AuthIsUserAuthenticatedServer,
  cookiesClient,
} from '@/app/utils/aws/auth/amplifyServerUtils.server';

export async function GET() {
  try {
    const isAuthenticated = await AuthIsUserAuthenticatedServer();
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const groups = await AuthGetUserGroupsServer();
    if (!groups.includes('ADMINS')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const byStatus: Record<string, number> = {
      PENDING: 0, SENT: 0, REPLIED: 0, BOUNCED: 0, FAILED: 0, OPTED_OUT: 0,
    };

    let cursor: string | undefined = undefined;
    let total = 0;
    let addedToday = 0;
    const todayPrefix = new Date().toISOString().slice(0, 10);

    while (true) {
      const page: Awaited<ReturnType<typeof cookiesClient.models.OutreachQueue.list>> =
        await cookiesClient.models.OutreachQueue.list({
          limit: 1000,
          ...(cursor ? { nextToken: cursor } : {}),
        });

      for (const item of page.data) {
        total++;
        const status = item.emailStatus as string | null;
        if (status && status in byStatus) byStatus[status]++;
        if (item.createdAt?.startsWith(todayPrefix)) addedToday++;
      }

      if (!page.nextToken) break;
      cursor = page.nextToken;
    }

    return NextResponse.json({ total, addedToday, byStatus });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
