'use client';

import { HiClock, HiCheckCircle, HiXCircle, HiExclamationCircle, HiInformationCircle } from 'react-icons/hi2';

interface SkipTraceAttempt {
  timestamp: string;
  status: 'COMPLETED' | 'FAILED' | 'NO_MATCH' | 'NO_QUALITY_CONTACTS';
  phonesFound: number;
  emailsFound: number;
  reason?: string | null;
  batchRequestId?: string | null;
  responseTime?: number | null;
}

interface SkipTraceHistoryProps {
  history: any;
}

const STATUS_META: Record<string, { icon: React.ReactNode; badge: string; description: string }> = {
  COMPLETED: {
    icon: <HiCheckCircle className="text-green-500" />,
    badge: 'bg-green-100 text-green-800',
    description: 'Owner found with qualifying contacts.',
  },
  NO_QUALITY_CONTACTS: {
    icon: <HiInformationCircle className="text-orange-500" />,
    badge: 'bg-orange-100 text-orange-800',
    description: 'Owner found but no mobile numbers (score 90+) or verified emails. Marked for direct mail.',
  },
  NO_MATCH: {
    icon: <HiExclamationCircle className="text-yellow-500" />,
    badge: 'bg-yellow-100 text-yellow-800',
    description: 'No owner records found at this address. The address may be incorrect.',
  },
  FAILED: {
    icon: <HiXCircle className="text-red-500" />,
    badge: 'bg-red-100 text-red-800',
    description: 'Skip trace could not be processed. Try again or contact support.',
  },
};

export function SkipTraceHistory({ history }: SkipTraceHistoryProps) {
  if (!history) return null;

  const attempts: SkipTraceAttempt[] = typeof history === 'string'
    ? JSON.parse(history)
    : history;

  if (!attempts || attempts.length === 0) return null;

  const formatDate = (timestamp: string) =>
    new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

  return (
    <div className="border-t pt-6 mt-6">
      <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
        <HiClock className="text-lg text-indigo-500" />
        Skip Trace History ({attempts.length} {attempts.length === 1 ? 'Attempt' : 'Attempts'})
      </h4>

      <div className="space-y-3">
        {attempts.map((attempt, idx) => {
          const meta = STATUS_META[attempt.status] ?? {
            icon: <HiClock className="text-gray-500" />,
            badge: 'bg-gray-100 text-gray-800',
            description: '',
          };

          return (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100"
            >
              <div className="mt-0.5 text-xl">{meta.icon}</div>

              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${meta.badge}`}>
                    {attempt.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-slate-500">{formatDate(attempt.timestamp)}</span>
                </div>

                <p className="text-xs text-slate-500 mt-1">
                  {attempt.reason ?? meta.description}
                </p>

                {(attempt.phonesFound > 0 || attempt.emailsFound > 0) && (
                  <div className="flex gap-4 mt-2 text-xs text-slate-600">
                    {attempt.phonesFound > 0 && (
                      <span>📞 {attempt.phonesFound} phone{attempt.phonesFound !== 1 ? 's' : ''} found</span>
                    )}
                    {attempt.emailsFound > 0 && (
                      <span>📧 {attempt.emailsFound} email{attempt.emailsFound !== 1 ? 's' : ''} found</span>
                    )}
                  </div>
                )}

                {(attempt.batchRequestId || attempt.responseTime) && (
                  <div className="flex gap-4 mt-2 text-[10px] text-slate-400">
                    {attempt.responseTime && <span>⏱ {attempt.responseTime}ms</span>}
                    {attempt.batchRequestId && (
                      <span title="BatchData support ID">ID: {attempt.batchRequestId}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
