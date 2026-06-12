'use client';

import { useEffect, useState } from 'react';

interface SkipRow {
  id: string;
  address: string;
  type: string;
  skipTraceStatus: string;
  phones: number;
  emails: number;
  date: string | null;
  reason: string | null;
  attempts: number;
}

interface SkipTraceData {
  completed: number;
  failed: number;
  noMatch: number;
  noQualityContacts: number;
  withPhones: number;
  withEmails: number;
  withBoth: number;
  successRate: number;
  recentActivity: SkipRow[];
  failedLeads: SkipRow[];
  noQualityLeads: SkipRow[];
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED:           'bg-green-100 text-green-800',
  FAILED:              'bg-red-100 text-red-800',
  NO_MATCH:            'bg-yellow-100 text-yellow-800',
  NO_QUALITY_CONTACTS: 'bg-orange-100 text-orange-800',
  PENDING:             'bg-gray-100 text-gray-600',
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

function IssueCard({ lead }: { lead: SkipRow }) {
  return (
    <div className='bg-white p-3 rounded border flex justify-between items-start gap-4'>
      <div className='flex-1 min-w-0'>
        <p className='text-sm font-semibold text-slate-900 truncate'>{lead.address}</p>
        <div className='flex items-center gap-2 mt-0.5'>
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${STATUS_STYLES[lead.skipTraceStatus] ?? 'bg-gray-100 text-gray-700'}`}>
            {lead.skipTraceStatus.replace(/_/g, ' ')}
          </span>
          <span className='text-xs text-slate-500'>{lead.type}</span>
          {lead.attempts > 1 && <span className='text-xs text-slate-400'>{lead.attempts} attempts</span>}
        </div>
        {lead.reason && <p className='text-xs text-slate-500 mt-1'>{lead.reason}</p>}
        {lead.phones > 0 && (
          <p className='text-xs text-slate-400 mt-0.5'>{lead.phones} phone{lead.phones !== 1 ? 's' : ''} found — none met quality threshold</p>
        )}
        {lead.date && (
          <p className='text-[10px] text-slate-400 mt-0.5'>{new Date(lead.date).toLocaleString()}</p>
        )}
      </div>
      <a href={`/lead/${lead.id}`} className='text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap font-semibold'>
        View →
      </a>
    </div>
  );
}

export default function SkipTraceReport() {
  const [data, setData] = useState<SkipTraceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/reports/pipeline-stats')
      .then(r => r.json())
      .then(d => setData(d.skipTrace))
      .catch(() => setError('Failed to load skip trace data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className='text-center py-16 text-slate-400'>Loading...</div>;
  if (error)   return <div className='text-center py-16 text-red-500'>{error}</div>;
  if (!data)   return null;

  const totalIssues = data.failed + data.noMatch + data.noQualityContacts;

  return (
    <div className='space-y-6 mt-6'>
      {/* Summary Cards */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <SummaryCard label='Completed' value={data.completed} sub='phones or emails found' accent='text-green-700' />
        <SummaryCard label='Errors / No Match' value={data.failed + data.noMatch} sub='could not process' accent={data.failed + data.noMatch > 0 ? 'text-red-600' : 'text-slate-900'} />
        <SummaryCard label='No Qualifying Contacts' value={data.noQualityContacts} sub='direct mail only' accent={data.noQualityContacts > 0 ? 'text-orange-600' : 'text-slate-900'} />
        <SummaryCard label='Success Rate' value={`${data.successRate}%`} sub={`${data.withPhones} w/ phones · ${data.withEmails} w/ emails`} />
      </div>

      {/* Contact Yield Breakdown */}
      <div className='bg-white rounded-xl border border-slate-200 p-5'>
        <h3 className='font-bold text-slate-800 mb-4'>Contact Yield</h3>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-center'>
          {[
            { label: 'Phones Only', value: data.withPhones - data.withBoth, color: 'text-blue-600' },
            { label: 'Emails Only', value: data.withEmails - data.withBoth, color: 'text-purple-600' },
            { label: 'Both Phone & Email', value: data.withBoth, color: 'text-green-600' },
            { label: 'No Contacts Found', value: data.failed + data.noMatch + data.noQualityContacts, color: 'text-red-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className='bg-slate-50 rounded-lg p-3'>
              <p className={`text-2xl font-black ${color}`}>{value}</p>
              <p className='text-xs text-slate-500 mt-1'>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Issues */}
      {totalIssues > 0 && (
        <div className='space-y-4'>
          {(data.failed + data.noMatch) > 0 && (
            <div className='bg-red-50 border border-red-200 rounded-xl p-5'>
              <h3 className='font-bold text-red-900 mb-1'>
                Errors / No Match — {data.failed + data.noMatch} lead{data.failed + data.noMatch !== 1 ? 's' : ''}
              </h3>
              <p className='text-sm text-red-700 mb-4'>No owner records found or could not be processed. Click a lead to retry.</p>
              <div className='space-y-2 max-h-72 overflow-y-auto'>
                {data.failedLeads.map(l => <IssueCard key={l.id} lead={l} />)}
              </div>
            </div>
          )}
          {data.noQualityContacts > 0 && (
            <div className='bg-orange-50 border border-orange-200 rounded-xl p-5'>
              <h3 className='font-bold text-orange-900 mb-1'>
                No Qualifying Contacts — {data.noQualityContacts} lead{data.noQualityContacts !== 1 ? 's' : ''}
              </h3>
              <p className='text-sm text-orange-700 mb-4'>Owner found but no mobile numbers (score 90+) or verified emails returned. Marked for direct mail only.</p>
              <div className='space-y-2 max-h-72 overflow-y-auto'>
                {data.noQualityLeads.map(l => <IssueCard key={l.id} lead={l} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Activity */}
      <div className='bg-white rounded-xl border border-slate-200 overflow-hidden'>
        <div className='px-5 py-4 border-b border-slate-100'>
          <h3 className='font-bold text-slate-800'>Recent Skip Trace Activity</h3>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead className='bg-slate-50 text-slate-500 text-xs uppercase tracking-wide'>
              <tr>
                <th className='px-4 py-3 text-left'>Property</th>
                <th className='px-4 py-3 text-left'>Type</th>
                <th className='px-4 py-3 text-left'>Status</th>
                <th className='px-4 py-3 text-left'>Contacts Found</th>
                <th className='px-4 py-3 text-left'>Date</th>
                <th className='px-4 py-3 text-left'></th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100'>
              {data.recentActivity.map(l => (
                <tr key={l.id} className='hover:bg-slate-50'>
                  <td className='px-4 py-3 font-medium text-slate-800'>{l.address}</td>
                  <td className='px-4 py-3 text-slate-500 text-xs'>{l.type}</td>
                  <td className='px-4 py-3'>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[l.skipTraceStatus] ?? 'bg-gray-100 text-gray-700'}`}>
                      {l.skipTraceStatus?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className='px-4 py-3 text-slate-600'>{l.phones} phones · {l.emails} emails</td>
                  <td className='px-4 py-3 text-slate-500 text-xs whitespace-nowrap'>
                    {l.date ? new Date(l.date).toLocaleDateString() : '—'}
                  </td>
                  <td className='px-4 py-3'>
                    <a href={`/lead/${l.id}`} className='text-xs text-blue-600 hover:text-blue-800 font-semibold'>View →</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
