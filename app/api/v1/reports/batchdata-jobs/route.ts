/**
 * GET /api/v1/reports/batchdata-jobs
 *
 * Returns the authenticated user's BatchData job runs (Skip Trace + Enrichment), newest first, plus
 * summary totals per job type for reconciliation. One record is written per batch the user runs
 * (skiptraceLeads Lambda / enrich-leads route). Clients are billed only for matched leads.
 *
 * AUTH: Required (Cognito JWT via cookies)
 * REQUEST: No params
 * RESPONSE: { jobs: [...], summary: { skipTrace: {...}, enrichment: {...}, all: {...} } }
 *
 * CALLED BY: Reports → "Job Reports" tab (BatchDataJobsReport)
 */
import { NextResponse } from 'next/server';
import { cookiesClient, AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

type JobType = 'SKIP_TRACE' | 'ENRICHMENT';

function emptyTotals() {
  return { jobs: 0, leadsSent: 0, matched: 0, noMatch: 0, creditsCharged: 0, dollarsCharged: 0 };
}

export async function GET() {
  const user = await AuthGetCurrentUserServer();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Job records are low-volume (one per batch run); a single high-limit list covers all realistic
  // history without pagination. Owner-scoped by the model's auth rules.
  // `beginsWith` (not `eq`) because the owner field is stored two ways depending on the writer: the
  // skip-trace Lambda writes the bare Cognito `sub`, while the enrich route (Amplify Data client) stamps
  // the `sub::identity` composite. The bare sub is a UUID prefix of both, so beginsWith matches both with
  // no cross-user collision.
  const { data: jobsRaw } = await cookiesClient.models.BatchDataJob.list({
    filter: { owner: { beginsWith: user.userId } },
    limit: 1000,
  });

  const jobs = [...jobsRaw].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const summary: Record<'skipTrace' | 'enrichment' | 'all', ReturnType<typeof emptyTotals>> = {
    skipTrace: emptyTotals(),
    enrichment: emptyTotals(),
    all: emptyTotals(),
  };
  const add = (t: ReturnType<typeof emptyTotals>, j: any) => {
    t.jobs += 1;
    t.leadsSent += j.leadsSent || 0;
    t.matched += j.matched || 0;
    t.noMatch += j.noMatch || 0;
    t.creditsCharged += j.creditsCharged || 0;
    t.dollarsCharged += j.dollarsCharged || 0;
  };
  for (const j of jobs) {
    const bucket = (j.jobType as JobType) === 'ENRICHMENT' ? summary.enrichment : summary.skipTrace;
    add(bucket, j);
    add(summary.all, j);
  }
  // Round accumulated dollars to cents.
  for (const k of ['skipTrace', 'enrichment', 'all'] as const) {
    summary[k].dollarsCharged = Math.round(summary[k].dollarsCharged * 100) / 100;
  }

  return NextResponse.json({ jobs, summary });
}
