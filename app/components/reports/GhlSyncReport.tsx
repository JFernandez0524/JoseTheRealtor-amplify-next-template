'use client';

import { useEffect, useState } from 'react';

interface GhlRow {
  id: string;
  address: string;
  type: string;
  ghlSyncStatus: string;
  ghlContactId: string | null;
  syncDate: string | null;
}

interface GhlSyncData {
  success: number;
  failed: number;
  skipped: number;
  pending: number;
  recentSyncs: GhlRow[];
  failedSyncs: GhlRow[];
}

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: 'bg-purple-100 text-purple-800',
  FAILED:  'bg-red-100 text-red-800',
  SKIPPED: 'bg-gray-100 text-gray-700',
  PENDING: 'bg-yellow-100 text-yellow-800',
};

function SummaryCard({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: string }) {
  return (
    <div className='bg-white rounded-xl border border-slate-200 p-5'>
      <p className='text-sm text-slate-500'>{label}</p>
      <p className={`text-3xl font-black mt-1 ${accent ?? 'text-slate-900'}`}>{value.toLocaleString()}</p>
      {sub && <p className='text-xs text-slate-400 mt-1'>{sub}</p>}
    </div>
  );
}

export default function GhlSyncReport() {
  const [data, setData] = useState<GhlSyncData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/reports/pipeline-stats')
      .then(r => r.json())
      .then(d => setData(d.ghlSync))
      .catch(() => setError('Failed to load Laynch AI sync data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className='text-center py-16 text-slate-400'>Loading...</div>;
  if (error)   return <div className='text-center py-16 text-red-500'>{error}</div>;
  if (!data)   return null;

  const total = data.success + data.failed + data.skipped + data.pending;
  const syncRate = total > 0 ? Math.round((data.success / total) * 100) : 0;

  return (
    <div className='space-y-6 mt-6'>
      {/* Summary Cards */}
      <div className='grid grid-cols-2 md:grid-cols-5 gap-4'>
        <SummaryCard label='Synced to Laynch AI' value={data.success} accent='text-purple-700' />
        <SummaryCard label='Failed' value={data.failed} accent={data.failed > 0 ? 'text-red-600' : 'text-slate-900'} />
        <SummaryCard label='Skipped' value={data.skipped} sub='already in Laynch AI' />
        <SummaryCard label='Pending' value={data.pending} sub='queued' />
        <SummaryCard label='Sync Rate' value={syncRate} sub={`% of ${total.toLocaleString()} leads`} />
      </div>

      {/* Failed Syncs */}
      {data.failedSyncs.length > 0 && (
        <div className='bg-red-50 border border-red-200 rounded-xl p-5'>
          <h3 className='font-bold text-red-900 mb-1'>
            Failed Syncs — {data.failed} lead{data.failed !== 1 ? 's' : ''}
          </h3>
          <p className='text-sm text-red-700 mb-4'>
            These leads could not be pushed to Laynch AI. Open the lead and retry the sync manually.
          </p>
          <div className='space-y-2 max-h-72 overflow-y-auto'>
            {data.failedSyncs.map(l => (
              <div key={l.id} className='bg-white p-3 rounded border border-red-200 flex justify-between items-center gap-4'>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-semibold text-slate-900 truncate'>{l.address}</p>
                  <div className='flex items-center gap-2 mt-0.5'>
                    <span className='text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-red-100 text-red-800'>FAILED</span>
                    <span className='text-xs text-slate-500'>{l.type}</span>
                    {l.syncDate && <span className='text-[10px] text-slate-400'>{new Date(l.syncDate).toLocaleDateString()}</span>}
                  </div>
                </div>
                <a href={`/lead/${l.id}`} className='text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap font-semibold'>
                  View →
                </a>
              </div>
            ))}
            {data.failed > 20 && (
              <p className='text-xs text-slate-500 text-center pt-2'>Showing 20 of {data.failed}</p>
            )}
          </div>
        </div>
      )}

      {/* Recent Syncs */}
      <div className='bg-white rounded-xl border border-slate-200 overflow-hidden'>
        <div className='px-5 py-4 border-b border-slate-100'>
          <h3 className='font-bold text-slate-800'>Recent Laynch AI Syncs</h3>
        </div>
        {data.recentSyncs.length === 0 ? (
          <p className='text-center py-10 text-slate-400 text-sm'>No syncs yet.</p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead className='bg-slate-50 text-slate-500 text-xs uppercase tracking-wide'>
                <tr>
                  <th className='px-4 py-3 text-left'>Property</th>
                  <th className='px-4 py-3 text-left'>Type</th>
                  <th className='px-4 py-3 text-left'>Status</th>
                  <th className='px-4 py-3 text-left'>Synced On</th>
                  <th className='px-4 py-3 text-left'>Laynch AI Contact</th>
                  <th className='px-4 py-3 text-left'></th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100'>
                {data.recentSyncs.map(l => (
                  <tr key={l.id} className='hover:bg-slate-50'>
                    <td className='px-4 py-3 font-medium text-slate-800'>{l.address}</td>
                    <td className='px-4 py-3 text-slate-500 text-xs'>{l.type}</td>
                    <td className='px-4 py-3'>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[l.ghlSyncStatus] ?? 'bg-gray-100 text-gray-700'}`}>
                        {l.ghlSyncStatus}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-slate-500 text-xs whitespace-nowrap'>
                      {l.syncDate ? new Date(l.syncDate).toLocaleDateString() : '—'}
                    </td>
                    <td className='px-4 py-3 text-xs text-slate-400 font-mono'>
                      {l.ghlContactId ? l.ghlContactId.slice(0, 12) + '…' : '—'}
                    </td>
                    <td className='px-4 py-3'>
                      <a href={`/lead/${l.id}`} className='text-xs text-blue-600 hover:text-blue-800 font-semibold'>View →</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
