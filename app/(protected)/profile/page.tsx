import { redirect } from 'next/navigation';
import SignOutButton from '@/app/components/Logout';
import {
  AuthGetCurrentUserServer,
  AuthGetUserAttributesServer,
  AuthGetUserGroupsServer,
  cookiesClient,
} from '@/app/utils/aws/auth/amplifyServerUtils.server';
import GhlSettingsCard from '@/app/components/profile/GhlSettingsCard';
import GhlCampaignSettings from '@/app/components/profile/GhlCampaignSettings';
import AgentProfileSettings from '@/app/components/profile/AgentProfileSettings';
import EmailTemplateSettings from '@/app/components/profile/EmailTemplateSettings';

import {
  HiOutlineUserCircle,
  HiOutlineCreditCard,
  HiOutlineShieldCheck,
  HiOutlineIdentification,
} from 'react-icons/hi2';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  //Check for user
  const user = await AuthGetCurrentUserServer();

  if (!user) {
    redirect('/login');
  }

  // 1. Fetch data in parallel
  const [attributes, groups] = await Promise.all([
    AuthGetUserAttributesServer(),
    AuthGetUserGroupsServer(),
  ]);

  // 2. Fetch User Account (Wallet/Stats) from DB - Filter by current user
  const { data: accountsByOwner } = await cookiesClient.models.UserAccount.list({
    filter: { owner: { eq: user.userId } },
  });

  let userAccount = accountsByOwner?.[0];

  // Fallback: find by email if owner query returned nothing (handles Google login owner mismatch)
  if (!userAccount && attributes?.email) {
    const { data: accountsByEmail } = await cookiesClient.models.UserAccount.list({
      filter: { email: { eq: attributes.email } },
    });
    userAccount = accountsByEmail?.[0];
  }

  // 3. Fetch GHL Integration for email templates
  const { data: ghlIntegrations } = await cookiesClient.models.GhlIntegration.list({
    filter: { userId: { eq: user.userId } },
  });
  const ghlIntegration = ghlIntegrations?.[0];

  // 3. Determine Subscription Level
  // We filter out the system "Google" group to show only app-specific tiers
  const subscriptionTier = groups.includes('ADMINS')
    ? 'Admin (Full Access)'
    : groups.includes('AI_PLAN')
      ? 'AI Outreach Pro'
      : groups.includes('PRO')
        ? 'Sync Pro'
        : 'Free Tier';

  return (
    <main className='max-w-4xl mx-auto py-12 px-6'>
      <div className='mb-8 flex justify-between items-end'>
        <div>
          <h1 className='text-4xl font-black text-slate-900 tracking-tight'>
            Profile
          </h1>
          <p className='text-slate-500 font-medium'>
            Manage your account and subscription
          </p>
        </div>
        <div className='flex items-center gap-3'>
          {groups.includes('ADMINS') && (
            <a
              href='/admin'
              className='px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors flex items-center gap-2'
            >
              <HiOutlineShieldCheck />
              Admin Dashboard
            </a>
          )}
          <SignOutButton />
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        {/* --- LEFT COLUMN: PERSONAL INFO --- */}
        <div className='md:col-span-2 space-y-6'>
          <div className='bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm'>
            <div className='flex items-center gap-4 mb-8'>
              {attributes?.picture ? (
                <img
                  src={attributes.picture.toString()}
                  alt='User profile'
                  className='w-20 h-20 rounded-full border-4 border-indigo-50 shadow-sm'
                />
              ) : (
                <div className='w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center'>
                  <HiOutlineUserCircle className='text-4xl text-slate-400' />
                </div>
              )}
              <div>
                <h2 className='text-2xl font-black text-slate-900'>
                  {attributes?.name || 'Investor'}
                </h2>
                <p className='text-slate-500 text-sm font-semibold'>
                  {attributes?.email}
                </p>
              </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-y-6 text-sm'>
              <div>
                <p className='text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1'>
                  User Identifier
                </p>
                <code className='text-xs bg-slate-50 px-2 py-1 rounded text-slate-600'>
                  {user.userId}
                </code>
              </div>
              <div>
                <p className='text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1'>
                  Account Status
                </p>
                <span className='inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-bold bg-green-100 text-green-700'>
                  <span className='w-1.5 h-1.5 rounded-full bg-green-500' />
                  Active
                </span>
              </div>
              <div>
                <p className='text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1'>
                  Cognito Groups
                </p>
                <div className='flex flex-wrap gap-1'>
                  {groups.map((g) => (
                    <span
                      key={g}
                      className='text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-bold border border-indigo-100'
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* GHL Integration Settings Card */}
          <GhlSettingsCard />
          
          {/* GHL Campaign Settings (Phone, Email, Signature) */}
          <GhlCampaignSettings />

          {/* Agent Profile (name/brokerage for outreach messages) */}
          <AgentProfileSettings />

          {/* Email Template Settings Card */}
          {ghlIntegration && (
            <EmailTemplateSettings 
              integrationId={ghlIntegration.id}
            />
          )}
        </div>

        {/* --- RIGHT COLUMN: SUBSCRIPTION & WALLET --- */}
        <div className='space-y-6'>
          {/* Subscription Card */}
          <div className='bg-indigo-600 text-white rounded-[2rem] p-8 shadow-lg shadow-indigo-100 relative overflow-hidden'>
            <HiOutlineIdentification className='absolute -bottom-6 -right-6 text-9xl text-indigo-500 opacity-30' />
            <div className='relative z-10'>
              <p className='text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200 mb-1'>
                Current Plan
              </p>
              <h3 className='text-2xl font-black mb-6'>{subscriptionTier}</h3>
              {!groups.includes('ADMINS') && (
                <a
                  href='/pricing'
                  className='inline-block bg-white text-indigo-600 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-colors'
                >
                  Upgrade Plan
                </a>
              )}
            </div>
          </div>

          {/* Wallet Card */}
          <div className='bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm'>
            <p className='text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1'>
              Wallet Balance
            </p>
            <div className='flex items-center gap-3 mb-6'>
              <HiOutlineCreditCard className='text-3xl text-indigo-500' />
              <span className='text-4xl font-black text-slate-900'>
                {userAccount?.credits || 0}
              </span>
              <span className='text-slate-400 font-bold text-xs uppercase'>
                Credits
              </span>
            </div>
            {!groups.includes('ADMINS') && (
              <a
                href='/pricing'
                className='block text-center bg-slate-900 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors'
              >
                Add Credits
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
