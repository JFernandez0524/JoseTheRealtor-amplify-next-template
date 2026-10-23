'use client';

import { useState } from 'react';
import EmailOutreachReport from './EmailOutreachReport';
import SkipTraceReport from './SkipTraceReport';
import GhlSyncReport from './GhlSyncReport';
import BatchDataJobsReport from './BatchDataJobsReport';
import { HiOutlineArrowTopRightOnSquare, HiOutlineEnvelope, HiOutlineQrCode, HiOutlineTruck } from 'react-icons/hi2';

type Tab = 'email' | 'skiptrace' | 'jobs' | 'ghl' | 'directmail';

const TABS: { id: Tab; label: string }[] = [
  { id: 'email',      label: 'Email Outreach' },
  { id: 'skiptrace',  label: 'Skip Trace' },
  { id: 'jobs',       label: 'Job Reports' },
  { id: 'ghl',        label: 'Launch AI Sync' },
  { id: 'directmail', label: '📬 Direct Mail' },
];

export default function ReportsTabs() {
  const [active, setActive] = useState<Tab>('email');

  return (
    <div className='mt-6'>
      {/* Tab Bar */}
      <div className='flex gap-1 border-b border-slate-200 overflow-x-auto'>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors whitespace-nowrap ${
              active === tab.id
                ? 'bg-white border border-b-white border-slate-200 text-blue-600 -mb-px'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {active === 'email'      && <EmailOutreachReport />}
      {active === 'skiptrace'  && <SkipTraceReport />}
      {active === 'jobs'       && <BatchDataJobsReport />}
      {active === 'ghl'        && <GhlSyncReport />}
      {active === 'directmail' && (
        <div className='mt-6 max-w-4xl space-y-6'>
          <div className='bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6'>
            <div className='flex items-start justify-between gap-4'>
              <div className='space-y-1'>
                <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 mb-2'>
                  <HiOutlineEnvelope className='text-sm' />
                  Thanks.io Postal Tracking
                </span>
                <h2 className='text-xl font-bold text-slate-900'>Direct Mail Orders &amp; USPS Delivery Reports</h2>
                <p className='text-sm text-slate-600 max-w-2xl'>
                  Because print and postage are billed directly at wholesale rates through your personal Thanks.io account, full mail proofs, USPS tracking scans, and postage billing receipts are hosted in your Thanks.io portal.
                </p>
              </div>

              <a
                href='https://dashboard.thanks.io/orders'
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition shadow-sm whitespace-nowrap'
              >
                <span>Open Thanks.io Orders</span>
                <HiOutlineArrowTopRightOnSquare className='text-sm text-slate-400' />
              </a>
            </div>

            <div className='grid sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100'>
              <div className='bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5'>
                <div className='flex items-center gap-2 text-slate-800 font-semibold text-xs'>
                  <HiOutlineTruck className='text-base text-blue-600' />
                  <span>USPS Postal Scans</span>
                </div>
                <p className='text-xs text-slate-500'>
                  Track every mailer as it moves through USPS distribution centers to destination zip codes.
                </p>
              </div>

              <div className='bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5'>
                <div className='flex items-center gap-2 text-slate-800 font-semibold text-xs'>
                  <HiOutlineQrCode className='text-base text-emerald-600' />
                  <span>QR Engagement Webhooks</span>
                </div>
                <p className='text-xs text-slate-500'>
                  QR scans trigger instant hot-lead alerts and update your CRM contacts in real time.
                </p>
              </div>

              <div className='bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5'>
                <div className='flex items-center gap-2 text-slate-800 font-semibold text-xs'>
                  <HiOutlineEnvelope className='text-base text-amber-600' />
                  <span>Print Proofs &amp; Receipts</span>
                </div>
                <p className='text-xs text-slate-500'>
                  View high-resolution PDF proofs of printed mail pieces and download postage receipts.
                </p>
              </div>
            </div>

            <div className='bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-1.5'>
              <p className='font-bold text-blue-950'>
                💡 Important Setup Reminder: QR Code Landing Page
              </p>
              <p>
                Our app automates lead data and delivery webhooks, but we do not host a public website for your leads. In your Thanks.io postcard or letter templates, make sure to set the <strong>QR Code destination URL</strong> to your own website, landing page, or GoHighLevel booking calendar.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
