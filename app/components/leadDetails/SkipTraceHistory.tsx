'use client';

import { HiClock, HiCheckCircle, HiXCircle, HiExclamationCircle } from 'react-icons/hi2';

interface SkipTraceAttempt {
  timestamp: string;
  status: 'COMPLETED' | 'FAILED' | 'NO_MATCH' | 'NO_QUALITY_CONTACTS';
  phonesFound: number;
  emailsFound: number;
}

interface SkipTraceHistoryProps {
  history: SkipTraceAttempt[] | string | null;
}

export function SkipTraceHistory({ history }: SkipTraceHistoryProps) {
  if (!history) return null;

  // Parse if string
  const attempts: SkipTraceAttempt[] = typeof history === 'string' 
    ? JSON.parse(history) 
    : history;

  if (!attempts || attempts.length === 0) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <HiCheckCircle className="text-green-500" />;
      case 'FAILED':
        return <HiXCircle className="text-red-500" />;
      case 'NO_MATCH':
        return <HiExclamationCircle className="text-yellow-500" />;
      case 'NO_QUALITY_CONTACTS':
        return <HiExclamationCircle className="text-orange-500" />;
      default:
        return <HiClock className="text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'NO_MATCH':
        return 'bg-yellow-100 text-yellow-800';
      case 'NO_QUALITY_CONTACTS':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="border-t pt-6 mt-6">
      <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
        <HiClock className="text-lg text-indigo-500" />
        Skip Trace History ({attempts.length} {attempts.length === 1 ? 'Attempt' : 'Attempts'})
      </h4>
      
      <div className="space-y-3">
        {attempts.map((attempt, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100"
          >
            <div className="mt-0.5 text-xl">
              {getStatusIcon(attempt.status)}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${getStatusColor(attempt.status)}`}>
                  {attempt.status.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-slate-500">
                  {formatDate(attempt.timestamp)}
                </span>
              </div>
              
              {(attempt.phonesFound > 0 || attempt.emailsFound > 0) && (
                <div className="flex gap-4 mt-2 text-xs text-slate-600">
                  {attempt.phonesFound > 0 && (
                    <span>📞 {attempt.phonesFound} phone{attempt.phonesFound !== 1 ? 's' : ''}</span>
                  )}
                  {attempt.emailsFound > 0 && (
                    <span>📧 {attempt.emailsFound} email{attempt.emailsFound !== 1 ? 's' : ''}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
