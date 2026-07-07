'use client';

import { Fragment, useEffect, useState } from 'react';

interface NoMatchLead {
  id: string;
  address: string;
}

interface Job {
  id: string;
  jobType: 'SKIP_TRACE' | 'ENRICHMENT';
  leadsSent: number;
  matched: number;
  noMatch: number;
  noQuality: number;
  failed: number;
  skipped: number;
  creditsPerMatch: number;
  creditsCharged: number;
  dollarsCharged: number;
  noMatchLeads: NoMatchLead[] | null;
  createdAt: string;
}

interface Totals {
  jobs: number;
  leadsSent: number;
  matched: number;
  noMatch: number;
  creditsCharged: number;
  dollarsCharged: number;
}

interface JobsData {
  jobs: Job[];
  summary: { skipTrace: Totals; enrichment: Totals; all: Totals };
}

const TYPE_LABEL: Record<Job['jobType'], string> = {
  SKIP_TRACE: 'Skip Trace',
  ENRICHMENT: 'Enrichment',
};
const TYPE_STYLE: Record<Job['jobType'], string> = {
  SKIP_TRACE: 'bg-blue-100 text-blue-800',
  ENRICHMENT: 'bg-purple-100 text-purple-800',
};

function SummaryCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className='bg-white rounded-xl border border-slate-200 p-5'>
      <p className='text-sm text-slate-500'>{label}</p>
      <p className={`text-3xl font-black mt-1 ${accent ?? 'text-slate-900'}`}>{value}</p>
      {sub && <p className='text-xs text-slate-400 mt-1'>{sub}</p>}
    </div>
  );
}

const money = (n: number) => `$${(n || 0).toFixed(2)}`;
const perMatchDollars = (creditsPerMatch: number) => creditsPerMatch * 0.1;

/** "4 × $0.30 = $1.20" */
function chargeMath(job: Job): string {
  return `${job.matched} × ${money(perMatchDollars(job.creditsPerMatch))} = ${money(job.dollarsCharged)}`;
}

function toCsv(jobs: Job[]): string {
  const header = ['Date', 'Type', 'Leads Sent', 'Matched', 'No Match', 'No Quality', 'Failed', 'Credits/Match', 'Credits Charged', 'Charged $'];
  const rows = jobs.map(j => [
    new Date(j.createdAt).toLocaleString(),
    TYPE_LABEL[j.jobType],
    j.leadsSent, j.matched, j.noMatch, j.noQuality, j.failed,
    j.creditsPerMatch, j.creditsCharged, j.dollarsCharged.toFixed(2),
  ]);
  return [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
}

export default function BatchDataJobsReport() {
  const [data, setData] = useState<JobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/reports/batchdata-jobs')
      .then(r => r.json())
      .then(setData)
      .catch(() => setError('Failed to load job reports.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className='text-center py-16 text-slate-400'>Loading...</div>;
  if (error)   return <div className='text-center py-16 text-red-500'>{error}</div>;
  if (!data)   return null;

  const { jobs, summary } = data;

  const downloadCsv = () => {
    const blob = new Blob([toCsv(jobs)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batchdata-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className='space-y-6 mt-6'>
      {/* Summary Cards */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <SummaryCard label='Total Jobs' value={summary.all.jobs} sub={`${summary.skipTrace.jobs} skip · ${summary.enrichment.jobs} enrich`} />
        <SummaryCard label='Leads Sent' value={summary.all.leadsSent} sub='to BatchData' />
        <SummaryCard label='Matched' value={summary.all.matched} sub={`${summary.all.noMatch} no match (free)`} accent='text-green-700' />
        <SummaryCard label='Total Charged' value={money(summary.all.dollarsCharged)} sub={`${summary.all.creditsCharged} credits`} accent='text-slate-900' />
      </div>

      <div className='bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800'>
        You are billed only for <strong>matched</strong> leads — no-match &amp; errors are never charged (BatchData bills per match).
        Skip Trace = 1 credit ($0.10)/match · Enrichment = 3 credits ($0.30)/match. 1 credit = $0.10.
      </div>

      {/* Job History */}
      <div className='bg-white rounded-xl border border-slate-200 overflow-hidden'>
        <div className='px-5 py-4 border-b border-slate-100 flex items-center justify-between'>
          <h3 className='font-bold text-slate-800'>Job History</h3>
          {jobs.length > 0 && (
            <button onClick={downloadCsv} className='text-xs font-semibold text-blue-600 hover:text-blue-800'>
              Export CSV
            </button>
          )}
        </div>

        {jobs.length === 0 ? (
          <div className='px-5 py-12 text-center text-slate-400 text-sm'>
            No skip trace or enrichment jobs yet. Runs will appear here with match counts and charges.
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead className='bg-slate-50 text-slate-500 text-xs uppercase tracking-wide'>
                <tr>
                  <th className='px-4 py-3 text-left'>Date</th>
                  <th className='px-4 py-3 text-left'>Type</th>
                  <th className='px-4 py-3 text-right'>Sent</th>
                  <th className='px-4 py-3 text-right'>Matched</th>
                  <th className='px-4 py-3 text-right'>No Match</th>
                  <th className='px-4 py-3 text-right'>No Quality</th>
                  <th className='px-4 py-3 text-left'>Charge</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100'>
                {jobs.map(job => {
                  const noMatchLeads = job.noMatchLeads || [];
                  const isOpen = expanded === job.id;
                  return (
                    <Fragment key={job.id}>
                      <tr
                        className={`hover:bg-slate-50 ${noMatchLeads.length > 0 ? 'cursor-pointer' : ''}`}
                        onClick={() => noMatchLeads.length > 0 && setExpanded(isOpen ? null : job.id)}
                      >
                        <td className='px-4 py-3 text-slate-600 text-xs whitespace-nowrap'>{new Date(job.createdAt).toLocaleString()}</td>
                        <td className='px-4 py-3'>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_STYLE[job.jobType]}`}>{TYPE_LABEL[job.jobType]}</span>
                        </td>
                        <td className='px-4 py-3 text-right text-slate-700'>{job.leadsSent}</td>
                        <td className='px-4 py-3 text-right font-semibold text-green-700'>{job.matched}</td>
                        <td className='px-4 py-3 text-right'>
                          {job.noMatch > 0 ? (
                            <span className='text-yellow-700 font-medium'>
                              {job.noMatch}{noMatchLeads.length > 0 && <span className='text-slate-400 ml-1'>{isOpen ? '▾' : '▸'}</span>}
                            </span>
                          ) : <span className='text-slate-400'>0</span>}
                        </td>
                        <td className='px-4 py-3 text-right text-slate-500'>{job.jobType === 'SKIP_TRACE' ? job.noQuality : '—'}</td>
                        <td className='px-4 py-3 text-slate-800 whitespace-nowrap'>
                          <span className='font-mono text-xs'>{chargeMath(job)}</span>
                          <span className='text-slate-400 text-xs ml-1'>({job.creditsCharged} cr)</span>
                        </td>
                      </tr>
                      {isOpen && noMatchLeads.length > 0 && (
                        <tr className='bg-yellow-50/50'>
                          <td colSpan={7} className='px-4 py-3'>
                            <p className='text-xs font-semibold text-slate-600 mb-2'>Leads BatchData couldn&apos;t match (not charged):</p>
                            <div className='space-y-1'>
                              {noMatchLeads.map(l => (
                                <div key={l.id} className='flex justify-between items-center text-xs bg-white rounded border px-3 py-1.5'>
                                  <span className='text-slate-700 truncate'>{l.address || l.id}</span>
                                  <a href={`/lead/${l.id}`} className='text-blue-600 hover:text-blue-800 font-semibold whitespace-nowrap ml-3'>View →</a>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
