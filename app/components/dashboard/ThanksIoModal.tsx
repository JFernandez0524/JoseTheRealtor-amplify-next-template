'use client';

import React, { useEffect, useState } from 'react';
import { THANKS_IO_LISTS } from '@/amplify/functions/shared/thanksIoRecipients';

type MailingListOption = {
  id: number;
  label: string;
  totalRecipients?: number;
  isSuppression?: boolean;
};

type Preview = {
  list: { id: number; label: string };
  eligibleCount: number;
  eligible: { id: string; name: string; address: string; saleDate: string | null; equity: string | null }[];
  excluded: { id: string; name?: string; address: string; reason: string }[];
};

type Props = {
  isOpen: boolean;
  leadIds: string[];
  onClose: () => void;
  /** Called after a confirmed send with the server's result. */
  onSent: (result: { sent: number; sentIds: string[]; failed: any[]; excluded: any[]; list: { label: string } }) => void;
};

const DEFAULT_LISTS: MailingListOption[] = Object.values(THANKS_IO_LISTS).map((l) => ({
  id: l.id,
  label: l.label,
}));

/**
 * Multi-Tenant Thanks.io modal:
 * - Checks if the user is connected to Thanks.io.
 * - If not connected, displays the transparent partner onboarding screen (r/W6R43LEQ).
 * - If connected, dynamically loads the user's real mailing lists and previews eligible leads for ANY lead type.
 */
export function ThanksIoModal({ isOpen, leadIds, onClose, onSent }: Props) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lists, setLists] = useState<MailingListOption[]>(DEFAULT_LISTS);
  const [listId, setListId] = useState<number | ''>('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  // Onboarding form state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');

  // 1. Fetch connection status & mailing lists when opened
  useEffect(() => {
    if (!isOpen) {
      setListId('');
      setPreview(null);
      setError('');
      setConnectError('');
      setApiKeyInput('');
      return;
    }

    let cancelled = false;
    fetch('/api/v1/thanksio/lists')
      .then(async (res) => {
        const data = await res.json();
        if (!cancelled) {
          if (data.connected) {
            setIsConnected(true);
            if (Array.isArray(data.lists) && data.lists.length > 0) {
              setLists(data.lists);
            }
          } else {
            setIsConnected(false);
            if (data.error) setError(data.error);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setIsConnected(false);
          setError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // 2. Fetch preview when listId changes
  useEffect(() => {
    if (!isOpen || !listId || !isConnected) return;
    let cancelled = false;
    setIsLoadingPreview(true);
    setPreview(null);
    setError('');

    const selectedList = lists.find((l) => l.id === listId);

    fetch('/api/v1/thanksio/add-recipients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadIds,
        mailingListId: listId,
        mailingListLabel: selectedList?.label,
        dryRun: true,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || 'Preview failed');
        if (!cancelled) setPreview(data);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setIsLoadingPreview(false));

    return () => {
      cancelled = true;
    };
  }, [isOpen, listId, isConnected, leadIds, lists]);

  if (!isOpen) return null;

  // Handle connecting a new Thanks.io API key
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;

    setIsConnecting(true);
    setConnectError('');

    try {
      const res = await fetch('/api/v1/thanksio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connection failed');

      // Refresh lists
      const listsRes = await fetch('/api/v1/thanksio/lists');
      const listsData = await listsRes.json();

      setIsConnected(true);
      if (Array.isArray(listsData.lists) && listsData.lists.length > 0) {
        setLists(listsData.lists);
      }
    } catch (err: any) {
      setConnectError(err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConfirm = async () => {
    if (!listId || !preview || preview.eligibleCount === 0) return;
    setIsSending(true);
    setError('');

    const selectedList = lists.find((l) => l.id === listId);

    try {
      const res = await fetch('/api/v1/thanksio/add-recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: preview.eligible.map((e) => e.id),
          mailingListId: listId,
          mailingListLabel: selectedList?.label,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Send failed');
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
          <h2 className='text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2'>
            <span>📬</span> Send to Thanks.io Direct Mail
          </h2>
          <p className='text-xs text-slate-500 mt-0.5'>
            {leadIds.length} lead{leadIds.length !== 1 ? 's' : ''} selected. Multi-tenant print &amp; postage integration.
          </p>
        </div>

        {/* LOADING STATE */}
        {isConnected === null && (
          <div className='p-8 text-center text-sm text-slate-500'>
            Checking Thanks.io integration status…
          </div>
        )}

        {/* NOT CONNECTED / ONBOARDING VIEW */}
        {isConnected === false && (
          <div className='px-4 sm:px-6 py-5 overflow-y-auto space-y-4'>
            <div className='bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-2'>
              <p className='font-semibold text-sm text-blue-950'>
                💡 Free Direct Mail Integration (Partner Access)
              </p>
              <p>
                Automated direct mail is included at <strong>$0/month in software fees</strong> when you create your Thanks.io account using our partner link.
              </p>
              <p className='text-blue-800'>
                You only pay Thanks.io directly for actual print and postage (~$0.73/card). No monthly markups or software fees.
              </p>
            </div>

            <div className='space-y-3 pt-1'>
              <h3 className='text-xs font-bold uppercase tracking-wider text-slate-700'>
                Step 1: Create your free partner account
              </h3>
              <a
                href='https://dashboard.thanks.io/r/W6R43LEQ'
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center justify-center gap-2 w-full bg-slate-900 text-white hover:bg-slate-800 font-semibold px-4 py-2.5 rounded-xl text-xs transition shadow-sm'
              >
                <span>Create Account on Thanks.io</span>
                <span className='text-slate-400'>↗</span>
              </a>
            </div>

            <form onSubmit={handleConnect} className='space-y-3 pt-2 border-t border-slate-100'>
              <h3 className='text-xs font-bold uppercase tracking-wider text-slate-700'>
                Step 2: Connect your API Token
              </h3>
              <p className='text-xs text-slate-500'>
                In your Thanks.io dashboard, go to <strong>API &amp; Integrations</strong>, generate a token, and paste it below:
              </p>
              <div>
                <input
                  type='password'
                  placeholder='Paste Thanks.io API Token…'
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className='w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500 font-mono'
                  required
                />
              </div>

              {connectError && (
                <p className='text-xs font-medium text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200'>
                  {connectError}
                </p>
              )}

              <button
                type='submit'
                disabled={isConnecting || !apiKeyInput.trim()}
                className='w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl disabled:opacity-50 transition shadow-sm'
              >
                {isConnecting ? 'Verifying & Connecting…' : 'Connect Account & Continue'}
              </button>
            </form>
          </div>
        )}

        {/* CONNECTED / SEND FLOW */}
        {isConnected === true && (
          <>
            <div className='px-4 sm:px-6 py-3.5 sm:py-4 space-y-4 overflow-y-auto'>
              <div>
                <div className='flex justify-between items-center mb-1'>
                  <label className='text-xs font-semibold text-slate-700 block'>
                    Select Thanks.io Mailing List
                  </label>
                  <span className='text-[11px] text-emerald-600 font-semibold flex items-center gap-1'>
                    <span className='w-1.5 h-1.5 rounded-full bg-emerald-500'></span>
                    Account Connected
                  </span>
                </div>
                <select
                  value={listId}
                  onChange={(e) => setListId(e.target.value ? Number(e.target.value) : '')}
                  className='w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value=''>Choose your mailing list…</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id} disabled={l.isSuppression}>
                      {l.isSuppression
                        ? `🚫 [Suppression List] ${l.label} (#${l.id})`
                        : `${l.label} (#${l.id})${typeof l.totalRecipients === 'number' && l.totalRecipients > 0 ? ` · ${l.totalRecipients.toLocaleString()} recipients` : ''}`}
                    </option>
                  ))}
                </select>
                <p className='text-[11px] text-slate-400 mt-1'>
                  Supports any lead type (Probate, Preforeclosure, Absentee, Tax Delinquent, Vacant, etc.)
                </p>
              </div>

              {isLoadingPreview && <p className='text-sm text-slate-500'>Checking lead eligibility…</p>}
              {error && <p className='text-sm text-red-600'>{error}</p>}

              {preview && (
                <div className='space-y-3'>
                  <div className='grid grid-cols-2 gap-2 sm:gap-3'>
                    <div className='rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 sm:p-3'>
                      <div className='text-xl sm:text-2xl font-bold text-emerald-700'>{preview.eligibleCount}</div>
                      <div className='text-[11px] sm:text-xs text-emerald-800 leading-tight'>
                        Will be added to {preview.list.label}
                      </div>
                    </div>
                    <div className='rounded-xl bg-slate-50 border border-slate-200 p-2.5 sm:p-3'>
                      <div className='text-xl sm:text-2xl font-bold text-slate-700'>{preview.excluded.length}</div>
                      <div className='text-[11px] sm:text-xs text-slate-600 leading-tight'>Excluded</div>
                    </div>
                  </div>

                  {preview.eligible.length > 0 && (
                    <details className='text-xs' open={preview.eligible.length <= 10}>
                      <summary className='font-semibold text-slate-700 cursor-pointer'>
                        Eligible leads ({preview.eligible.length})
                      </summary>
                      <ul className='mt-2 space-y-1.5'>
                        {preview.eligible.map((e) => (
                          <li
                            key={e.id}
                            className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-3 border-b border-slate-100 py-1'
                          >
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
                    <details className='text-xs' open={preview.eligibleCount === 0 || preview.excluded.length <= 10}>
                      <summary className='font-semibold text-slate-700 cursor-pointer'>
                        Excluded leads &amp; reasons ({preview.excluded.length})
                      </summary>
                      <ul className='mt-2 space-y-1.5'>
                        {preview.excluded.map((x) => (
                          <li
                            key={x.id}
                            className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-3 border-b border-slate-100 py-1'
                          >
                            <span className='truncate font-medium text-slate-800'>
                              {x.name ? `${x.name} — ` : ''}{x.address || x.id}
                            </span>
                            <span className='text-[11px] sm:text-xs text-amber-700 font-semibold sm:text-right'>
                              {x.reason}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>

            <div className='px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
              <div className='text-[11px] text-slate-500 flex items-center gap-1.5'>
                <span>USPS postal scans &amp; print proofs appear in your</span>
                <a
                  href='https://dashboard.thanks.io/orders'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-blue-600 hover:underline font-semibold inline-flex items-center gap-0.5'
                >
                  <span>Thanks.io Orders</span>
                  <span>↗</span>
                </a>
              </div>

              <div className='flex flex-col-reverse sm:flex-row gap-2'>
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
          </>
        )}
      </div>
    </div>
  );
}
