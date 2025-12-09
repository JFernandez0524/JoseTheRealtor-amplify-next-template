import React from 'react';

export const StatusBadge = ({
  status,
}: {
  status: string | undefined | null;
}) => {
  const styles =
    status === 'COMPLETED'
      ? 'bg-green-100 text-green-800'
      : status === 'FAILED' || status === 'NO_MATCH' || status === 'INVALID'
        ? 'bg-red-100 text-red-800'
        : status === 'PENDING'
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-gray-100 text-gray-800';

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${styles}`}>
      {status || 'UNKNOWN'}
    </span>
  );
};
