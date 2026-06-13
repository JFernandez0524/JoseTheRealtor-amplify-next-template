'use client';

import { useEffect, useState } from 'react';

interface Contact {
  contactId: string;
  locationId: string;
  contactName: string | null;
  contactEmail: string | null;
  propertyAddress: string | null;
  propertyCity: string | null;
  leadType: string | null;
  touch: number;
  emailStatus: string;
  queueStatus: string;
  sentAt: string;
  nextEmailDate: string | null;
}

interface DayLog {
  date: string;
  count: number;
  contacts: Contact[];
}

interface Summary {
  sentToday: number;
  sentThisWeek: number;
  totalSent: number;
  pendingQueue: number;
  replies: number;
  bounced: number;
}

interface ReportData {
  summary: Summary;
  dailyLog: DayLog[];
}

const EMAIL_STATUS_STYLES: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-800',
  SENT:      'bg-blue-100 text-blue-800',
  REPLIED:   'bg-green-100 text-green-800',
  BOUNCED:   'bg-red-100 text-red-800',
  FAILED:    'bg-red-100 text-red-800',
  OPTED_OUT: 'bg-gray-100 text-gray-700',
};

const LEAD_TYPE_LABELS: Record<string, string> = {
  PREFORECLOSURE: 'Pre-FC',
  PROBATE: 'Probate',
};

function formatDateHeading(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function ghlContactUrl(locationId: string, contactId: string) {
  return `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${contactId}`;
}

function SummaryCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className='bg-white rounded-xl border border-slate-200 p-5'>
      <p className='text-sm text-slate-500'>{label}</p>
      <p className='text-3xl font-black text-slate-900 mt-1'>{value.toLocaleString()}</p>
      {sub && <p className='text-xs text-slate-400 mt-1'>{sub}</p>}
    </div>
  );
}

export default function EmailOutreachReport() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/v1/reports/email-activity?days=${days}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        // Auto-expand today and yesterday
        if (d.dailyLog?.length > 0) {
          setExpandedDates(new Set(d.dailyLog.slice(0, 2).map((l: DayLog) => l.date)));
        }
      })
      .catch(() => setError('Failed to load report data.'))
      .finally(() => setLoading(false));
  }, [days]);

  function toggleDate(date: string) {
    setExpandedDates(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  }

  return (
    <div className='mt-6 space-y-6'>
      {/* Summary Cards */}
      {data && (
        <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4'>
          <SummaryCard label='Sent Today' value={data.summary.sentToday} />
          <SummaryCard label='Sent This Week' value={data.summary.sentThisWeek} />
          <SummaryCard label='Total Sent' value={data.summary.totalSent} sub='all time' />
          <SummaryCard label='Pending Queue' value={data.summary.pendingQueue} sub='never contacted' />
          <SummaryCard label='Replies' value={data.summary.replies} sub='all time' />
          <SummaryCard label='Bounced' value={data.summary.bounced} sub='all time' />
        </div>
      )}

      {/* Date Range Toggle */}
      <div className='flex items-center gap-2'>
        <span className='text-sm text-slate-500 font-medium'>Show last:</span>
        {[7, 14, 30].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
              days === d
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
            }`}
          >
            {d} days
          </button>
        ))}
      </div>

      {/* Daily Log */}
      {loading && (
        <div className='text-center py-16 text-slate-400'>Loading report...</div>
      )}
      {error && (
        <div className='text-center py-16 text-red-500'>{error}</div>
      )}
      {!loading && !error && data?.dailyLog.length === 0 && (
        <div className='text-center py-16 text-slate-400'>No emails sent in the last {days} days.</div>
      )}
      {!loading && !error && data?.dailyLog.map(day => (
        <div key={day.date} className='bg-white rounded-xl border border-slate-200 overflow-hidden'>
          {/* Day Header */}
          <button
            onClick={() => toggleDate(day.date)}
            className='w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors'
          >
            <div className='flex items-center gap-3'>
              <span className='font-bold text-slate-800'>{formatDateHeading(day.date)}</span>
              <span className='bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full'>
                {day.count} email{day.count !== 1 ? 's' : ''} sent
              </span>
            </div>
            <span className='text-slate-400 text-lg'>{expandedDates.has(day.date) ? '▲' : '▼'}</span>
          </button>

          {/* Contact Table */}
          {expandedDates.has(day.date) && (
            <div className='overflow-x-auto border-t border-slate-100'>
              <table className='w-full text-sm'>
                <thead className='bg-slate-50 text-slate-500 text-xs uppercase tracking-wide'>
                  <tr>
                    <th className='px-4 py-3 text-left'>Time (EST)</th>
                    <th className='px-4 py-3 text-left'>Name</th>
                    <th className='px-4 py-3 text-left'>Email</th>
                    <th className='px-4 py-3 text-left'>Property</th>
                    <th className='px-4 py-3 text-left'>Type</th>
                    <th className='px-4 py-3 text-left'>Touch</th>
                    <th className='px-4 py-3 text-left'>Status</th>
                    <th className='px-4 py-3 text-left'>Next Email</th>
                    <th className='px-4 py-3 text-left'>Laynch AI</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-100'>
                  {day.contacts.map((c, i) => (
                    <tr key={`${c.contactId}-${i}`} className='hover:bg-slate-50'>
                      <td className='px-4 py-3 text-slate-500 whitespace-nowrap'>{formatTime(c.sentAt)}</td>
                      <td className='px-4 py-3 font-medium text-slate-800 whitespace-nowrap'>
                        {c.contactName || <span className='text-slate-400 italic'>Unknown</span>}
                      </td>
                      <td className='px-4 py-3 text-slate-600 max-w-[200px] truncate'>{c.contactEmail || '—'}</td>
                      <td className='px-4 py-3 text-slate-600 whitespace-nowrap'>
                        {[c.propertyAddress, c.propertyCity].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap'>
                        {c.leadType ? (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            c.leadType === 'PREFORECLOSURE'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {LEAD_TYPE_LABELS[c.leadType] ?? c.leadType}
                          </span>
                        ) : '—'}
                      </td>
                      <td className='px-4 py-3 text-center'>
                        <span className='bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full'>
                          #{c.touch}
                        </span>
                      </td>
                      <td className='px-4 py-3'>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${EMAIL_STATUS_STYLES[c.emailStatus] ?? 'bg-gray-100 text-gray-700'}`}>
                          {c.emailStatus}
                        </span>
                      </td>
                      <td className='px-4 py-3 text-slate-500 whitespace-nowrap text-xs'>
                        {c.nextEmailDate
                          ? new Date(c.nextEmailDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '—'}
                      </td>
                      <td className='px-4 py-3'>
                        {c.locationId && c.contactId ? (
                          <a
                            href={ghlContactUrl(c.locationId, c.contactId)}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-blue-600 hover:text-blue-800 text-xs font-semibold underline whitespace-nowrap'
                          >
                            View in Laynch AI →
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
