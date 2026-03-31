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

    let nextToken: string | null | undefined = undefined;
    let total = 0;
    let addedToday = 0;
    const todayPrefix = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

    do {
      const { data: items, nextToken: next } = await cookiesClient.models.OutreachQueue.list({
        limit: 1000,
        ...(nextToken ? { nextToken } : {}),
      });

      for (const item of items) {
        total++;
        const status = item.emailStatus as string | null;
        if (status && status in byStatus) byStatus[status]++;
        if (item.createdAt?.startsWith(todayPrefix)) addedToday++;
      }

      nextToken = next;
    } while (nextToken);

    return NextResponse.json({ total, addedToday, byStatus });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
