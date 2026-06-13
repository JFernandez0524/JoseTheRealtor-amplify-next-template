import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { redirect } from 'next/navigation';
import { HiOutlineCreditCard, HiOutlineChartBar, HiOutlineArrowRight } from 'react-icons/hi2';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const currentUser = await AuthGetCurrentUserServer();
  if (!currentUser) redirect('/');

  const { data: userAccounts } = await cookiesClient.models.UserAccount.list({
    filter: { owner: { eq: currentUser.userId } },
  });
  const userAccount = userAccounts?.[0];
  const credits = userAccount?.credits ?? 0;
  const totalSkips = userAccount?.totalSkipsPerformed ?? 0;
  const totalSynced = userAccount?.totalLeadsSynced ?? 0;

  return (
    <div className='p-6 max-w-2xl mx-auto'>
      <div className='mb-6 text-center'>
        <h1 className='text-3xl font-black text-slate-900 tracking-tight'>My Account</h1>
        <p className='text-slate-500 font-medium'>Credits and usage overview.</p>
      </div>

      <div className='space-y-4'>
        {/* Credits Card */}
        <div className='bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <HiOutlineCreditCard className='text-3xl text-indigo-500' />
            <div>
              <p className='text-sm text-slate-500'>Wallet Balance</p>
              <p className='text-4xl font-black text-slate-900'>{credits}</p>
              <p className='text-xs text-slate-400'>credits · $0.10 per skip trace</p>
            </div>
          </div>
          <a
            href='/pricing'
            className='bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors'
          >
            Add Credits
          </a>
        </div>

        {/* Quick Stats */}
        <div className='grid grid-cols-2 gap-4'>
          <div className='bg-white border border-slate-200 rounded-xl p-5'>
            <div className='flex items-center gap-3'>
              <HiOutlineChartBar className='text-2xl text-green-500' />
              <div>
                <p className='text-sm text-slate-500'>Skip Traces Run</p>
                <p className='text-2xl font-black text-slate-900'>{totalSkips.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className='bg-white border border-slate-200 rounded-xl p-5'>
            <div className='flex items-center gap-3'>
              <HiOutlineChartBar className='text-2xl text-purple-500' />
              <div>
                <p className='text-sm text-slate-500'>Laynch AI Syncs</p>
                <p className='text-2xl font-black text-slate-900'>{totalSynced.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Reports Link */}
        <a
          href='/reports'
          className='flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-5 hover:bg-blue-100 transition-colors group'
        >
          <div>
            <p className='font-bold text-blue-800'>View Full Reports</p>
            <p className='text-sm text-blue-600'>Email outreach activity, skip trace results, and Laynch AI sync details.</p>
          </div>
          <HiOutlineArrowRight className='text-blue-500 text-xl group-hover:translate-x-1 transition-transform' />
        </a>
      </div>
    </div>
  );
}
