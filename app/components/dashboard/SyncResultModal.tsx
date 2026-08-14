'use client';

import {
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineXCircle,
  HiOutlineXMark,
  HiOutlineArrowPath,
} from 'react-icons/hi2';

interface SyncResultSummary {
  successful: number;
  skipped: number;
  failed: number;
  skippedReasons?: Record<string, number>;
  failedReasons?: Record<string, number>;
}

interface SyncResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: SyncResultSummary | null;
  onRetryFailed?: () => void;
}

export function SyncResultModal({
  isOpen,
  onClose,
  summary,
  onRetryFailed,
}: SyncResultModalProps) {
  if (!isOpen || !summary) return null;

  const hasIssues = summary.skipped > 0 || summary.failed > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-5 text-white flex items-center justify-between ${
          summary.failed > 0
            ? 'bg-gradient-to-r from-red-600 to-rose-700'
            : summary.skipped > 0
            ? 'bg-gradient-to-r from-amber-500 to-orange-600'
            : 'bg-gradient-to-r from-emerald-600 to-teal-700'
        }`}>
          <div className="flex items-center gap-3">
            {summary.failed > 0 ? (
              <HiOutlineXCircle className="w-7 h-7 text-white" />
            ) : summary.skipped > 0 ? (
              <HiOutlineExclamationTriangle className="w-7 h-7 text-white" />
            ) : (
              <HiOutlineCheckCircle className="w-7 h-7 text-white" />
            )}
            <div>
              <h3 className="text-lg font-black tracking-tight">
                CRM Sync Results
              </h3>
              <p className="text-xs text-white/90">
                {summary.successful} synced · {summary.skipped} skipped · {summary.failed} failed
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <HiOutlineXMark className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-sm">
          {/* Success summary */}
          {summary.successful > 0 && (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950">
              <HiOutlineCheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-xs font-semibold">
                {summary.successful} lead{summary.successful !== 1 ? 's' : ''} successfully synced to your GoHighLevel account.
              </p>
            </div>
          )}

          {/* Skipped Details */}
          {summary.skipped > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 space-y-2">
              <div className="flex items-center gap-2">
                <HiOutlineExclamationTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  {summary.skipped} Lead{summary.skipped !== 1 ? 's' : ''} Skipped
                </p>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                Leads were skipped because they did not meet CRM prerequisites:
              </p>
              <ul className="text-xs space-y-1 text-amber-800 list-disc list-inside">
                <li><strong>Skip trace required:</strong> Run skip trace first so the contact has verified owner info.</li>
                <li><strong>Active listing:</strong> MLS-listed properties are excluded from cold outreach.</li>
              </ul>
            </div>
          )}

          {/* Failed Details */}
          {summary.failed > 0 && (
            <div className="p-4 rounded-2xl bg-red-50/80 border border-red-200 text-red-950 space-y-2">
              <div className="flex items-center gap-2">
                <HiOutlineXCircle className="w-4 h-4 text-red-600 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-wider text-red-900">
                  {summary.failed} Lead{summary.failed !== 1 ? 's' : ''} Failed to Sync
                </p>
              </div>
              <p className="text-xs text-red-900 leading-relaxed">
                Check that your GoHighLevel integration is active in <strong>Profile Settings</strong> and that the contact has a valid address.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          {summary.failed > 0 && onRetryFailed && (
            <button
              onClick={() => {
                onClose();
                onRetryFailed();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors"
            >
              <HiOutlineArrowPath className="w-3.5 h-3.5" />
              <span>Retry Failed</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
