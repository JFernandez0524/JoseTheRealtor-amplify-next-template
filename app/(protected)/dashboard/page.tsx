'use client';

import LeadDashboardClient from '@/app/components/dashboard/LeadDashboardClient';
import { UploadProgress } from '@/app/components/dashboard/UploadProgress';
import EmailAnalytics from '@/app/components/profile/EmailAnalytics';

export default function DashboardPage() {
  return (
    <div className='p-6'>
      <div className='mb-6'>
        <h1 className='text-3xl font-black text-slate-900 tracking-tight'>
          Property Leads
        </h1>
        <p className='text-slate-500 font-medium'>
          Manage your pipeline and sync high-equity leads to your CRM.
        </p>
      </div>

      {/* Email Analytics */}
      <div className='mb-6'>
        <EmailAnalytics />
      </div>

      <LeadDashboardClient />
      <UploadProgress />
    </div>
  );
}
