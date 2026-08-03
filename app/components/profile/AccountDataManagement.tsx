'use client';

import { useState } from 'react';
import { deleteUser } from 'aws-amplify/auth';
import {
  HiOutlineArrowDownTray,
  HiOutlineExclamationTriangle,
  HiOutlineTrash,
  HiOutlineShieldCheck,
  HiOutlineXMark,
  HiOutlineInformationCircle,
  HiOutlineCalendarDays,
} from 'react-icons/hi2';

export default function AccountDataManagement() {
  const [isExporting, setIsExporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calculate current monthly billing cycle end date
  const now = new Date();
  const cycleEndDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const formattedCycleEndDate = cycleEndDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      setErrorMsg(null);

      const response = await fetch('/api/v1/account/export');
      if (!response.ok) {
        throw new Error('Failed to generate export file.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'account-data-export.csv';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export error:', err);
      setErrorMsg(err?.message || 'Failed to download user data.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmInput.trim().toUpperCase() !== 'DELETE') {
      return;
    }

    try {
      setIsDeleting(true);
      setErrorMsg(null);

      // 1. Trigger server-side data erasure (deletes DynamoDB records across all models)
      const res = await fetch('/api/v1/account/delete', {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || 'Database cleanup failed.');
      }

      // 2. Client-side Cognito User Pool deletion
      await deleteUser();

      // 3. Redirect to login
      window.location.href = '/login';
    } catch (err: any) {
      console.error('Account deletion error:', err);
      setErrorMsg(err?.message || 'Failed to delete account. Please try again or contact support.');
      setIsDeleting(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* DATA EXPORT CARD */}
      <div className='bg-white border border-slate-200 rounded-[2rem] p-6 sm:p-8 shadow-sm'>
        <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4'>
          <div>
            <div className='flex items-center gap-2 mb-2'>
              <HiOutlineShieldCheck className='text-xl text-indigo-600' />
              <h3 className='text-lg font-black text-slate-900'>Data Privacy & Export</h3>
            </div>
            <p className='text-sm text-slate-500 font-medium leading-relaxed max-w-xl'>
              Under GDPR and CCPA data portability guidelines, you can download a complete copy of all your leads, contacts, outreach queues, and account details at any time as a standard CSV file (.csv).
            </p>
          </div>
          <button
            onClick={handleExportData}
            disabled={isExporting}
            className='px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 w-full sm:w-auto shrink-0 disabled:opacity-50'
          >
            <HiOutlineArrowDownTray className='text-base' />
            {isExporting ? 'Preparing CSV...' : 'Download Data (CSV)'}
          </button>
        </div>
      </div>

      {/* DANGER ZONE / ACCOUNT DELETION */}
      <div className='bg-rose-50/50 border border-rose-200 rounded-[2rem] p-6 sm:p-8 shadow-sm'>
        <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4'>
          <div>
            <div className='flex items-center gap-2 mb-2 text-rose-700'>
              <HiOutlineExclamationTriangle className='text-xl' />
              <h3 className='text-lg font-black'>Danger Zone: Account Deletion</h3>
            </div>
            <p className='text-sm text-rose-600/80 font-medium leading-relaxed max-w-xl'>
              Permanently delete your account and all associated property leads, integration settings, and history. This action is irreversible and erases all data from our servers.
            </p>
          </div>
          <button
            onClick={() => {
              setConfirmInput('');
              setErrorMsg(null);
              setIsModalOpen(true);
            }}
            className='px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 w-full sm:w-auto shrink-0 shadow-sm shadow-rose-200'
          >
            <HiOutlineTrash className='text-base' />
            Delete Account
          </button>
        </div>
      </div>

      {/* CONFIRMATION & EXPORT MODAL */}
      {isModalOpen && (
        <div className='fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4'>
          <div className='bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto'>
            <button
              onClick={() => !isDeleting && setIsModalOpen(false)}
              className='absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors'
              disabled={isDeleting}
            >
              <HiOutlineXMark className='text-2xl' />
            </button>

            <div className='flex items-center gap-3 mb-4 text-rose-600'>
              <div className='w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0'>
                <HiOutlineExclamationTriangle className='text-2xl text-rose-600' />
              </div>
              <div>
                <h3 className='text-xl font-black text-slate-900'>Delete Account & Erase Data</h3>
                <p className='text-xs text-rose-600 font-semibold'>Irreversible Action</p>
              </div>
            </div>

            <div className='space-y-4 my-6 text-sm text-slate-600'>
              <p>
                Deleting your account will permanently purge all your leads, contacts, integration settings, and history from our servers and permanently deactivate your login account.
              </p>

              {/* STRICT NO REFUNDS & BILLING RENEWAL CYCLE NOTICE */}
              <div className='p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-2'>
                <div className='flex items-center gap-1.5 font-extrabold text-amber-950 uppercase tracking-wider text-[11px]'>
                  <HiOutlineInformationCircle className='text-base text-amber-700 shrink-0' />
                  <span>Strict Refund & Subscription Renewal Terms</span>
                </div>
                
                <ul className='list-disc pl-5 space-y-1.5 text-amber-900 font-medium leading-relaxed'>
                  <li>
                    <strong className='text-amber-950 font-black'>NO REFUNDS OF ANY KIND:</strong> All purchases, subscription fees, skip trace charges, and wallet credit top-ups are strictly non-refundable under any circumstances. No full, partial, or credit refunds will be issued.
                  </li>
                  <li>
                    <strong className='text-amber-950 font-black'>NO PRORATED REFUNDS:</strong> If you delete your account or cancel mid-month, no prorated refunds will be granted for remaining days in the billing period.
                  </li>
                  <li className='flex items-start gap-1 pt-1 border-t border-amber-200/60'>
                    <HiOutlineCalendarDays className='text-amber-800 text-base shrink-0 mt-0.5' />
                    <span>
                      <strong className='text-amber-950 font-black'>Subscription Renewal Cycle:</strong> Your current monthly billing cycle ends on <span className='underline font-bold text-amber-950'>{formattedCycleEndDate}</span>. To avoid being charged for a new subscription month, you must cancel or delete your account <strong>before {formattedCycleEndDate}</strong>. Account deletion immediately terminates your access.
                    </span>
                  </li>
                </ul>
              </div>

              {/* DATA DOWNLOAD PROMPT IN MODAL */}
              <div className='p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between gap-3'>
                <div>
                  <p className='font-bold text-slate-800 text-xs'>Want a CSV backup first?</p>
                  <p className='text-[11px] text-slate-500'>Download all your data as a CSV file before deleting.</p>
                </div>
                <button
                  type='button'
                  onClick={handleExportData}
                  disabled={isExporting || isDeleting}
                  className='px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shrink-0'
                >
                  <HiOutlineArrowDownTray />
                  {isExporting ? 'Exporting CSV...' : 'Save CSV Copy'}
                </button>
              </div>

              <div>
                <label className='block font-bold text-slate-800 text-xs mb-2'>
                  Type <span className='text-rose-600 font-black'>DELETE</span> below to confirm:
                </label>
                <input
                  type='text'
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder='DELETE'
                  disabled={isDeleting}
                  className='w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-mono text-sm uppercase'
                />
              </div>

              {errorMsg && (
                <div className='p-3 bg-rose-100 border border-rose-300 rounded-xl text-rose-800 text-xs font-semibold'>
                  {errorMsg}
                </div>
              )}
            </div>

            <div className='flex items-center justify-end gap-3 pt-2'>
              <button
                type='button'
                onClick={() => setIsModalOpen(false)}
                disabled={isDeleting}
                className='px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleDeleteAccount}
                disabled={confirmInput.trim().toUpperCase() !== 'DELETE' || isDeleting}
                className='px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-rose-200 flex items-center gap-2'
              >
                <HiOutlineTrash />
                {isDeleting ? 'Erasing & Deleting...' : 'Confirm Account Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
