'use client';

interface SyncCategory {
  icon: string;
  label: string;
  count: number;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

interface SyncConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  totalCount: number;
  callingCount: number;
  emailOnlyCount: number;
  digitalOnlyCount: number;
  alreadySyncedCount?: number;
}

export function SyncConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  totalCount,
  callingCount,
  emailOnlyCount,
  digitalOnlyCount,
  alreadySyncedCount = 0,
}: SyncConfirmModalProps) {
  if (!isOpen) return null;

  const newCount = totalCount - alreadySyncedCount;

  const categories: SyncCategory[] = [
    {
      icon: '📞',
      label: 'Cold Calling',
      count: callingCount,
      description: 'Leads with qualified phone numbers',
      color: 'text-green-800',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      icon: '📬',
      label: 'Direct Mail / Email',
      count: emailOnlyCount,
      description: 'No phone · estimated value $300k–$850k',
      color: 'text-blue-800',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    {
      icon: '📱',
      label: 'Digital Only',
      count: digitalOnlyCount,
      description: 'Value outside $300k–$850k range',
      color: 'text-purple-800',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
    },
  ].filter(c => c.count > 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Sync to CRM</h2>
          <p className="text-gray-500 mt-1 text-sm">
            {totalCount} lead{totalCount !== 1 ? 's' : ''} selected
          </p>
        </div>

        {/* Already-synced warning */}
        {alreadySyncedCount > 0 && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">{alreadySyncedCount} lead{alreadySyncedCount !== 1 ? 's' : ''}</span> already synced — {alreadySyncedCount !== 1 ? 'they' : 'it'} will be updated in GHL.{' '}
              Only <span className="font-semibold">{newCount}</span> {newCount !== 1 ? 'are' : 'is'} new.
            </p>
          </div>
        )}

        {/* Breakdown */}
        <div className="space-y-3 mb-6">
          {categories.map(cat => (
            <div
              key={cat.label}
              className={`flex items-center gap-4 rounded-lg px-4 py-3 border ${cat.bgColor} ${cat.borderColor}`}
            >
              <span className="text-2xl leading-none">{cat.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${cat.color}`}>{cat.label}</p>
                <p className={`text-xs ${cat.color} opacity-75 truncate`}>{cat.description}</p>
              </div>
              <span className={`text-lg font-bold ${cat.color} shrink-0`}>{cat.count}</span>
            </div>
          ))}
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
