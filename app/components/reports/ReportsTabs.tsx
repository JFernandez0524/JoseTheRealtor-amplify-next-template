'use client';

import { useState } from 'react';
import EmailOutreachReport from './EmailOutreachReport';
import SkipTraceReport from './SkipTraceReport';
import GhlSyncReport from './GhlSyncReport';

type Tab = 'email' | 'skiptrace' | 'ghl';

const TABS: { id: Tab; label: string }[] = [
  { id: 'email',     label: 'Email Outreach' },
  { id: 'skiptrace', label: 'Skip Trace' },
  { id: 'ghl',       label: 'Laynch AI Sync' },
];

export default function ReportsTabs() {
  const [active, setActive] = useState<Tab>('email');

  return (
    <div className='mt-6'>
      {/* Tab Bar */}
      <div className='flex gap-1 border-b border-slate-200'>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
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
      {active === 'email'     && <EmailOutreachReport />}
      {active === 'skiptrace' && <SkipTraceReport />}
      {active === 'ghl'       && <GhlSyncReport />}
    </div>
  );
}
