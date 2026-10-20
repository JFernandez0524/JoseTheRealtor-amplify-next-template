'use client';

import type { ReachabilityBreakdown } from './SkipTraceResultModal';

interface SyncConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  totalCount: number;
  callingCount?: number;
  emailOnlyCount?: number;
  digitalOnlyCount?: number;
  alreadySyncedCount?: number;
  excludedCount?: number;
  breakdown?: ReachabilityBreakdown | null;
}

export function SyncConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  totalCount,
  alreadySyncedCount = 0,
  excludedCount = 0,
  breakdown,
}: SyncConfirmModalProps) {
  if (!isOpen) return null;

  const newCount = totalCount - alreadySyncedCount;

  const rows = breakdown
    ? [
        {
          icon: '📱',
          label: 'Mobile + Email',
          count: breakdown.mobileAndEmail,
          details: 'Mobile dialer + Cold email drip',
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        },
        {
          icon: '📞',
          label: 'Mobile Only',
          count: breakdown.mobileOnly,
          details: `Mobile dialer (${breakdown.totalMobileLeads} total mobile leads / ${breakdown.totalMobileNumbers} numbers)`,
          badgeClass: 'bg-green-50 text-green-800 border-green-200',
        },
        {
          icon: '☎️',
          label: 'Landline + Email',
          count: breakdown.landlineAndEmail,
          details: 'Landline dialer + Cold email drip',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        },
        {
          icon: '☎️',
          label: 'Landline Only',
          count: breakdown.landlineOnly,
          details: `Landline dialer (${breakdown.totalLandlineLeads} total landline leads / ${breakdown.totalLandlineNumbers} numbers)`,
          badgeClass: 'bg-yellow-50 text-yellow-800 border-yellow-200',
        },
        {
          icon: '📧',
          label: 'Email Only',
          count: breakdown.emailOnly,
          details: `Cold email drip (${breakdown.totalEmailLeads} total email leads / ${breakdown.totalEmails} emails)`,
          badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
        },
        {
          icon: '📮',
          label: 'Direct Mail Only',
          count: breakdown.directMailOnlyCount,
          details:
            breakdown.directMailOnlyAddresses.length > 0
              ? `${breakdown.directMailOnlyAddresses.join(', ')} (matched, no usable phone/email)`
              : 'Matched, no usable phone/email (Direct Mail workflow)',
          badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
        },
      ].filter((r) => r.count > 0)
    : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 md:p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Sync to Launch AI</h2>
          <p className="text-gray-500 mt-1 text-sm">
            {totalCount} eligible lead{totalCount !== 1 ? 's' : ''} ready to sync
          </p>
        </div>

        {/* Excluded leads notice */}
        {excludedCount > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-xs text-amber-800">
              <span className="font-semibold">{excludedCount} selected lead{excludedCount !== 1 ? 's were' : ' was'} excluded</span> — only off-market leads with completed skip tracing (<code className="bg-amber-100 px-1 py-0.5 rounded">COMPLETED</code> or Direct Mail Only) can sync to Launch AI. <code className="bg-amber-100 px-1 py-0.5 rounded">NO_MATCH</code> and non-off-market leads are blocked.
            </p>
          </div>
        )}

        {/* Already-synced warning */}
        {alreadySyncedCount > 0 && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">{alreadySyncedCount} lead{alreadySyncedCount !== 1 ? 's' : ''}</span> already synced — {alreadySyncedCount !== 1 ? 'they' : 'it'} will be updated in Launch AI.{' '}
              Only <span className="font-semibold">{newCount}</span> {newCount !== 1 ? 'are' : 'is'} new.
            </p>
          </div>
        )}

        {/* Reachability Breakdown Table */}
        {rows.length > 0 && (
          <div className="overflow-x-auto border border-slate-200 rounded-xl mb-6">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Reachability Channel</th>
                  <th className="px-4 py-2.5 font-bold text-center w-20">Leads</th>
                  <th className="px-4 py-2.5 font-bold">Launch AI Routing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.label} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${row.badgeClass}`}>
                        <span>{row.icon}</span>
                        <span>{row.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold text-slate-900 text-base">
                      {row.count}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs">
                      {row.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Requirements notice */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6 text-xs text-slate-600">
          <p className="font-bold text-slate-800 mb-1">📋 Launch AI Sync Rules:</p>
          <p className="text-[11px] text-slate-500">
            Only off-market leads with a completed skip trace (including Direct Mail Only) can sync. Leads marked <code className="bg-slate-200 px-1 rounded">NO_MATCH</code>, <code className="bg-slate-200 px-1 rounded">active</code>, <code className="bg-slate-200 px-1 rounded">sold</code>, or <code className="bg-slate-200 px-1 rounded">skip</code> are strictly blocked.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors"
          >
            Sync {totalCount} Lead{totalCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
