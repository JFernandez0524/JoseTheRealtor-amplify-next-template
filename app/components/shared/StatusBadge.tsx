import React from 'react';

interface StatusBadgeProps {
  status: string | undefined | null;
  hasLandlines?: boolean;
  isDirectMailOnly?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  hasLandlines,
  isDirectMailOnly,
}) => {
  const normalized = status ? status.toUpperCase() : 'UNKNOWN';

  if (normalized === 'COMPLETED') {
    return (
      <span className='px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 flex items-center gap-1 w-fit'>
        ✅ COMPLETED
      </span>
    );
  }

  if (normalized === 'NO_QUALITY_CONTACTS') {
    if (hasLandlines) {
      return (
        <span
          className='px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800 flex items-center gap-1 w-fit'
          title='Callable landline found, but no mobile/SMS phone'
        >
          ☎️ LANDLINE ONLY
        </span>
      );
    }
    return (
      <span
        className='px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800 flex items-center gap-1 w-fit'
        title='No mobile phone found — qualified for direct mail postcard/letter'
      >
        📬 MAIL ONLY
      </span>
    );
  }

  if (normalized === 'FAILED' || normalized === 'NO_MATCH' || normalized === 'INVALID') {
    return (
      <span className='px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 flex items-center gap-1 w-fit'>
        ❌ {normalized === 'NO_MATCH' ? 'NO MATCH' : normalized}
      </span>
    );
  }

  if (normalized === 'PENDING') {
    return (
      <span className='px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800 flex items-center gap-1 w-fit'>
        ⏳ PENDING
      </span>
    );
  }

  return (
    <span className='px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-800 flex items-center gap-1 w-fit'>
      {normalized}
    </span>
  );
};
