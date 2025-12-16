// app/components/LeadStatusBadge.tsx

import React from 'react';

type StatusType = 'SKIP_TRACE' | 'GHL_SYNC';

interface LeadStatusBadgeProps {
  type: StatusType;
  status: string | null | undefined;
}

/**
 * Renders a colored badge for lead status (Skip Trace or GHL Sync).
 */
export function LeadStatusBadge({ type, status }: LeadStatusBadgeProps) {
  // Convert status to uppercase string, defaulting to 'N/A'
  const statusString = (status || 'N/A').toUpperCase();
  let colorClasses = '';
  let displayText = statusString;

  if (type === 'SKIP_TRACE') {
    switch (statusString) {
      case 'COMPLETED':
        colorClasses = 'bg-green-100 text-green-800 border border-green-200';
        break;
      case 'FAILED':
      case 'ERROR':
      case 'NOT_AUTHORIZED':
        colorClasses = 'bg-red-100 text-red-800 border border-red-200';
        break;
      case 'NO_MATCH':
      case 'NOT_FOUND':
      case 'INVALID_DATA':
        colorClasses = 'bg-gray-100 text-gray-800 border border-gray-200';
        break;
      case 'PENDING':
      default:
        colorClasses = 'bg-yellow-100 text-yellow-800 border border-yellow-200';
        break;
    }
  } else if (type === 'GHL_SYNC') {
    if (statusString === 'N/A' || statusString === 'SKIPPED') {
      displayText = 'NOT_ATTEMPTED';
    }

    switch (statusString) {
      case 'SUCCESS':
        colorClasses = 'bg-purple-100 text-purple-800 border border-purple-200';
        break;
      case 'PENDING':
        colorClasses = 'bg-yellow-100 text-yellow-800 border border-yellow-200';
        break;
      case 'FAILED':
      case 'ERROR':
        colorClasses = 'bg-red-100 text-red-800 border border-red-200';
        break;
      case 'SKIPPED':
      case 'N/A':
      default:
        colorClasses = 'bg-gray-100 text-gray-700';
        break;
    }
  }

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-bold uppercase whitespace-nowrap ${colorClasses}`}
    >
      {displayText}
    </span>
  );
}
