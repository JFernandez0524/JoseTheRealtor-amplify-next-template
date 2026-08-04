'use client';

import { useState, useEffect } from 'react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  count: number;
}

export function DeleteConfirmModal({ isOpen, onClose, onConfirm, count }: DeleteConfirmModalProps) {
  const [confirmText, setConfirmText] = useState('');

  // Reset confirmation text whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setConfirmText('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmed = confirmText.trim() === 'DELETE';

  const handleConfirm = () => {
    if (!isConfirmed) return;
    setConfirmText('');
    onConfirm();
  };

  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Are you sure?</h2>
          <p className="text-gray-500 mt-1 text-sm font-medium">This action cannot be undone.</p>
        </div>

        <div className="bg-red-50/80 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-900 space-y-2">
          <p className="font-semibold text-red-950">
            What will happen when you delete {count === 1 ? 'this lead' : `these ${count} leads`}:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-xs text-red-800 leading-relaxed">
            <li>
              <span className="font-semibold">Permanent Database Removal:</span> {count === 1 ? 'This lead' : `All ${count} leads`} will be permanently erased from your database and dashboard.
            </li>
            <li>
              <span className="font-semibold">Associated Data Lost:</span> All notes, custom tags, door-knocking history, and skip-tracing data linked to {count === 1 ? 'this lead' : 'these leads'} will be deleted.
            </li>
            <li>
              <span className="font-semibold">External CRMs Unaffected:</span> If synced to GoHighLevel (GHL) or exported previously, contacts in external tools will <span className="underline font-semibold">not</span> be deleted automatically.
            </li>
          </ul>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
            Type <span className="font-extrabold text-red-600 select-all">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 text-sm font-mono tracking-widest uppercase transition placeholder:normal-case placeholder:font-sans placeholder:tracking-normal text-gray-900"
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmed}
            className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 ${
              isConfirmed
                ? 'bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-200 cursor-pointer'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
            }`}
          >
            Delete {count} Lead{count !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
