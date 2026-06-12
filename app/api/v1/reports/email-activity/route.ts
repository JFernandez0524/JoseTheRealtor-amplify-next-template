import { NextRequest, NextResponse } from 'next/server';
import { cookiesClient, AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

export async function GET(request: NextRequest) {
  const user = await AuthGetCurrentUserServer();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get('days') || '14'), 90);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  // Paginate through all OutreachQueue entries for this user (owner-scoped automatically)
  let allItems: any[] = [];
  let nextToken: string | undefined | null = null;
  do {
    const params: Parameters<typeof cookiesClient.models.OutreachQueue.list>[0] = { limit: 1000 };
    if (nextToken) params.nextToken = nextToken;
    const result = await cookiesClient.models.OutreachQueue.list(params);
    allItems.push(...(result.data || []));
    nextToken = result.nextToken ?? null;
  } while (nextToken);

  const todayStr = new Date().toISOString().slice(0, 10);
  const weekCutoff = new Date();
  weekCutoff.setDate(weekCutoff.getDate() - 7);

  // Summary stats across all time
  const hasSent = allItems.filter(i => i.lastEmailSent && (i.emailAttempts ?? 0) > 0);
  const summary = {
    sentToday: hasSent.filter(i => i.lastEmailSent!.slice(0, 10) === todayStr).length,
    sentThisWeek: hasSent.filter(i => new Date(i.lastEmailSent!) >= weekCutoff).length,
    totalSent: hasSent.length,
    pendingQueue: allItems.filter(i => i.emailStatus === 'PENDING' && (i.emailAttempts ?? 0) === 0).length,
    replies: allItems.filter(i => i.emailStatus === 'REPLIED').length,
    bounced: allItems.filter(i => i.emailStatus === 'BOUNCED').length,
  };

  // Daily log for the requested window
  const byDate: Record<string, any[]> = {};
  for (const item of hasSent) {
    const date = item.lastEmailSent!.slice(0, 10);
    if (new Date(date) < cutoff) continue;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push({
      contactId: item.contactId,
      locationId: item.locationId,
      contactName: item.contactName ?? null,
      contactEmail: item.contactEmail ?? null,
      propertyAddress: item.propertyAddress ?? null,
      propertyCity: item.propertyCity ?? null,
      leadType: item.leadType ?? null,
      touch: item.emailAttempts ?? 1,
      emailStatus: item.emailStatus,
      queueStatus: item.queueStatus,
      sentAt: item.lastEmailSent,
      nextEmailDate: item.nextEmailDate ?? null,
    });
  }

  const dailyLog = Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, contacts]) => ({
      date,
      count: contacts.length,
      contacts: contacts.sort((a, b) => b.sentAt.localeCompare(a.sentAt)),
    }));

  return NextResponse.json({ summary, dailyLog });
}
