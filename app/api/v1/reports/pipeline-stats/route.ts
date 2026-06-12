import { NextResponse } from 'next/server';
import { cookiesClient, AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { fetchAllLeads } from '@/app/utils/aws/data/pagination';

export async function GET() {
  const user = await AuthGetCurrentUserServer();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: leads } = await fetchAllLeads((params) =>
    cookiesClient.models.PropertyLead.list({
      ...params,
      filter: { owner: { eq: user.userId } },
    })
  );

  // ── Skip Trace ──────────────────────────────────────────────────────────────
  const skipped = leads.filter(l => l.skipTraceStatus);
  const completed = leads.filter(l =>
    l.skipTraceStatus === 'COMPLETED' &&
    ((l.phones?.length ?? 0) > 0 || (l.emails?.length ?? 0) > 0)
  );
  const failed     = leads.filter(l => l.skipTraceStatus === 'FAILED');
  const noMatch    = leads.filter(l => l.skipTraceStatus === 'NO_MATCH');
  const noQuality  = leads.filter(l => l.skipTraceStatus === 'NO_QUALITY_CONTACTS');
  const withPhones = leads.filter(l => (l.phones?.length ?? 0) > 0);
  const withEmails = leads.filter(l => (l.emails?.length ?? 0) > 0);
  const withBoth   = leads.filter(l => (l.phones?.length ?? 0) > 0 && (l.emails?.length ?? 0) > 0);

  const getLastHistory = (lead: any) => {
    if (!lead.skipTraceHistory) return null;
    const h = typeof lead.skipTraceHistory === 'string'
      ? JSON.parse(lead.skipTraceHistory)
      : lead.skipTraceHistory;
    return Array.isArray(h) ? h[h.length - 1] : null;
  };

  const toSkipRow = (lead: any) => {
    const last = getLastHistory(lead);
    const displayAddr = lead.type === 'PROBATE'
      ? [lead.adminAddress || lead.mailingAddress, lead.mailingCity, lead.mailingState].filter(Boolean).join(', ')
      : [lead.ownerAddress, lead.ownerCity, lead.ownerState].filter(Boolean).join(', ');
    return {
      id: lead.id,
      address: displayAddr,
      type: lead.type,
      skipTraceStatus: lead.skipTraceStatus,
      phones: lead.phones?.length ?? 0,
      emails: lead.emails?.length ?? 0,
      date: lead.skipTraceCompletedAt || last?.timestamp || null,
      reason: last?.reason || null,
      attempts: Array.isArray(lead.skipTraceHistory)
        ? lead.skipTraceHistory.length
        : (typeof lead.skipTraceHistory === 'string' ? JSON.parse(lead.skipTraceHistory).length : 0),
    };
  };

  // Recent activity: last 20 leads touched by skip trace
  const recentActivity = leads
    .filter(l => l.skipTraceCompletedAt || l.skipTraceHistory)
    .sort((a, b) => {
      const da = a.skipTraceCompletedAt || getLastHistory(a)?.timestamp || '';
      const db = b.skipTraceCompletedAt || getLastHistory(b)?.timestamp || '';
      return new Date(db).getTime() - new Date(da).getTime();
    })
    .slice(0, 20)
    .map(toSkipRow);

  // ── GHL Sync ────────────────────────────────────────────────────────────────
  const synced   = leads.filter(l => l.ghlSyncStatus === 'SUCCESS');
  const syncFail = leads.filter(l => l.ghlSyncStatus === 'FAILED');
  const syncSkip = leads.filter(l => l.ghlSyncStatus === 'SKIPPED');
  const syncPend = leads.filter(l => l.ghlSyncStatus === 'PENDING');

  const toGhlRow = (lead: any) => ({
    id: lead.id,
    address: [lead.ownerAddress, lead.ownerCity, lead.ownerState].filter(Boolean).join(', '),
    type: lead.type,
    ghlSyncStatus: lead.ghlSyncStatus,
    ghlContactId: lead.ghlContactId ?? null,
    syncDate: lead.ghlSyncDate ?? null,
  });

  const recentSyncs = synced
    .filter(l => l.ghlSyncDate)
    .sort((a, b) => new Date(b.ghlSyncDate!).getTime() - new Date(a.ghlSyncDate!).getTime())
    .slice(0, 20)
    .map(toGhlRow);

  const failedSyncs = syncFail.slice(0, 20).map(toGhlRow);

  return NextResponse.json({
    skipTrace: {
      completed:       completed.length,
      failed:          failed.length,
      noMatch:         noMatch.length,
      noQualityContacts: noQuality.length,
      withPhones:      withPhones.length,
      withEmails:      withEmails.length,
      withBoth:        withBoth.length,
      successRate:     skipped.length > 0 ? Math.round((completed.length / skipped.length) * 100) : 0,
      recentActivity,
      failedLeads:     [...failed, ...noMatch].slice(0, 20).map(toSkipRow),
      noQualityLeads:  noQuality.slice(0, 20).map(toSkipRow),
    },
    ghlSync: {
      success: synced.length,
      failed:  syncFail.length,
      skipped: syncSkip.length,
      pending: syncPend.length,
      recentSyncs,
      failedSyncs,
    },
  });
}
