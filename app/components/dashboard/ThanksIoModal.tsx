'use client';

import React, { useEffect, useState } from 'react';
import { THANKS_IO_LISTS } from '@/amplify/functions/shared/thanksIoRecipients';

type Preview = {
  list: { id: number; label: string };
  eligibleCount: number;
  eligible: { id: string; name: string; address: string; saleDate: string | null; equity: string | null }[];
  excluded: { id: string; address: string; reason: string }[];
};

type Props = {
  isOpen: boolean;
  leadIds: string[];
  onClose: () => void;
  /** Called after a confirmed send with the server's result. */
  onSent: (result: { sent: number; sentIds: string[]; failed: any[]; excluded: any[]; list: { label: string } }) => void;
};

const LIST_OPTIONS = Object.values(THANKS_IO_LISTS);

/**
 * Manual Thanks.io send: the user picks the mailing list, previews eligible vs. excluded leads,
 * and nothing is sent until they click Confirm.
 */
export function ThanksIoModal({ isOpen, leadIds, onClose, onSent }: Props) {
  const [listId, setListId] = useState<number | ''>('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setListId('');
      setPreview(null);
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !listId) return;
    let cancelled = false;
    setIsLoadingPreview(true);
    setPreview(null);
    setError('');
    fetch('/api/v1/thanksio/add-recipients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds, mailingListId: listId, dryRun: true }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Preview failed');
        if (!cancelled) setPreview(data);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setIsLoadingPreview(false));
    return () => {
      cancelled = true;
    };
  }, [isOpen, listId, leadIds]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!listId || !preview || preview.eligibleCount === 0) return;
    setIsSending(true);
    setError('');
    try {
      const res = await fetch('/api/v1/thanksio/add-recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: preview.eligible.map((e) => e.id), mailingListId: listId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      onSent(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className='fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-2 sm:p-4' onClick={onClose}>
      <div
        className='bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200'>
          <h2 className='text-base sm:text-lg font-bold text-slate-900'>📬 Send to Thanks.io</h2>
          <p className='text-xs text-slate-500 mt-0.5'>
            {leadIds.length} lead{leadIds.length !== 1 ? 's' : ''} selected. Pick the mailing list — nothing is sent
            until you confirm.
          </p>
        </div>

        <div className='px-4 sm:px-6 py-3.5 sm:py-4 space-y-4 overflow-y-auto'>
          <div>
            <label className='text-xs font-semibold text-slate-700 mb-1 block'>Mailing list</label>
            <select
              value={listId}
              onChange={(e) => setListId(e.target.value ? Number(e.target.value) : '')}
              className='w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>Select a list…</option>
              {LIST_OPTIONS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label} (#{l.id})
                </option>
              ))}
            </select>
          </div>

          {isLoadingPreview && <p className='text-sm text-slate-500'>Checking eligibility…</p>}
          {error && <p className='text-sm text-red-600'>{error}</p>}

          {preview && (
            <div className='space-y-3'>
              <div className='grid grid-cols-2 gap-2 sm:gap-3'>
                <div className='rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 sm:p-3'>
                  <div className='text-xl sm:text-2xl font-bold text-emerald-700'>{preview.eligibleCount}</div>
                  <div className='text-[11px] sm:text-xs text-emerald-800 leading-tight'>Will be added to {preview.list.label}</div>
                </div>
                <div className='rounded-xl bg-slate-50 border border-slate-200 p-2.5 sm:p-3'>
                  <div className='text-xl sm:text-2xl font-bold text-slate-700'>{preview.excluded.length}</div>
                  <div className='text-[11px] sm:text-xs text-slate-600 leading-tight'>Excluded</div>
                </div>
              </div>

              {preview.eligible.length > 0 && (
                <details className='text-xs' open={preview.eligible.length <= 10}>
                  <summary className='font-semibold text-slate-700 cursor-pointer'>Eligible leads</summary>
                  <ul className='mt-2 space-y-1.5'>
                    {preview.eligible.map((e) => (
                      <li key={e.id} className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-3 border-b border-slate-100 py-1'>
                        <span className='truncate font-medium text-slate-800'>
                          {e.name} — {e.address}
                        </span>
                        <span className='text-[11px] sm:text-xs text-slate-500 whitespace-nowrap'>
                          {e.saleDate ? `📅 ${e.saleDate} · ` : ''}
                          {e.equity ? `💰 ${e.equity}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {preview.excluded.length > 0 && (
                <details className='text-xs'>
                  <summary className='font-semibold text-slate-700 cursor-pointer'>Excluded leads &amp; reasons</summary>
                  <ul className='mt-2 space-y-1.5'>
                    {preview.excluded.map((x) => (
                      <li key={x.id} className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-3 border-b border-slate-100 py-1'>
                        <span className='truncate font-medium text-slate-800'>{x.address || x.id}</span>
                        <span className='text-[11px] sm:text-xs text-amber-700 font-semibold sm:text-right'>{x.reason}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <div className='px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2'>
          <button
            onClick={onClose}
            disabled={isSending}
            className='w-full sm:w-auto text-sm font-semibold px-4 py-2.5 sm:py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition text-center'
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!preview || preview.eligibleCount === 0 || isSending || isLoadingPreview}
            className='w-full sm:w-auto text-sm font-semibold px-4 py-2.5 sm:py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-center shadow-sm'
          >
            {isSending
              ? 'Sending…'
              : preview
                ? `Confirm & Add ${preview.eligibleCount} to List`
                : 'Confirm & Add to List'}
          </button>
        </div>
      </div>
    </div>
  );
}
