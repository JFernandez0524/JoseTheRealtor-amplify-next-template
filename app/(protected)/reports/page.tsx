import ReportsTabs from '@/app/components/reports/ReportsTabs';

export default function ReportsPage() {
  return (
    <div className='p-6'>
      <h1 className='text-3xl font-black text-slate-900'>Reports</h1>
      <p className='text-slate-500 mt-1'>Track your outreach activity, skip trace results, and Launch AI sync status.</p>
      <ReportsTabs />
    </div>
  );
}
