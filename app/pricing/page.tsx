'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { useAccess } from '@/app/context/AccessContext';
import type { Schema } from '@/amplify/data/resource';

export const dynamic = 'force-dynamic';

// Using only react-icons as requested
import {
  HiCheck,
  HiOutlineDatabase,
  HiOutlineLightningBolt,
} from 'react-icons/hi';
import {
  HiOutlineUserGroup,
  HiOutlineSparkles,
  HiOutlineArrowRight,
} from 'react-icons/hi2';

type UserAccount = Schema['UserAccount']['type'];

const subscriptions = [
  {
    name: 'Sync Plan',
    price: '$49',
    description: 'Essential for manual CRM management.',
    features: [
      'Sync to CRM button',
      'Manual lead management',
      'Standard property data',
    ],
    icon: <HiOutlineUserGroup className='text-3xl text-indigo-500' />,
    tier: 'PRO',
  },
  {
    name: 'AI Outreach Plan',
    price: '$149',
    description: 'Full automation for high-volume investors.',
    features: [
      'All Sync features',
      'AI outreach automation',
      'AI-tier sequences',
      'Priority property insights',
    ],
    icon: <HiOutlineSparkles className='text-3xl text-purple-500' />,
    tier: 'AI_PLAN',
  },
];

const creditPacks = [
  {
    id: 'pack_10',
    name: '$10 Pack',
    price: '$10',
    credits: 100,
    label: 'Starter',
    value: 100,
  },
  {
    id: 'pack_20',
    name: '$20 Pack',
    price: '$20',
    credits: 200,
    label: 'Growth',
    value: 200,
  },
  {
    id: 'pack_50',
    name: '$50 Pack',
    price: '$50',
    credits: 500,
    label: 'Pro',
    value: 500,
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { hasPaidPlan, isAI } = useAccess();
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // 1. Fetch current balance if user is logged in
  // app/pricing/page.tsx

  useEffect(() => {
    async function fetchBalance() {
      try {
        // 🛡️ 1. Check if we even have a user session first
        const user = await getFrontEndUser();
        if (!user) {
          console.log('No user logged in, skipping balance fetch.');
          return;
        }

        // 2. Only fetch if the user exists
        const { data: accounts } = await client.models.UserAccount.list();
        if (accounts && accounts[0]) {
          setUserAccount(accounts[0]);
        }
      } catch (err) {
        // This will now only catch actual API errors, not "Logged Out" errors
        console.error('Error fetching account:', err);
      }
    }
    fetchBalance();
  }, []);

  // 2. Handle Subscription Upgrade (Dev Mode)
  const handleSubscriptionUpgrade = async (tier: string) => {
    setLoading(tier);
    try {
      const user = await getFrontEndUser();
      if (!user) {
        alert('Please log in to upgrade.');
        return router.push('/login');
      }

      await client.mutations.addUserToGroup({
        userId: user.userId,
        groupName: tier,
      });

      alert(`Success! You are now subscribed to the ${tier} plan.`);
      window.location.reload();
    } catch (err: any) {
      alert(`Upgrade Error: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  // 3. Handle Credit Purchase (Dev Mode)
  const handleCreditPurchase = async (packId: string, amount: number) => {
    setLoading(packId);
    try {
      if (!userAccount) {
        alert('Please log in to refill your wallet.');
        return router.push('/login');
      }

      // Direct DynamoDB Update for Dev Mode
      await client.models.UserAccount.update({
        id: userAccount.id,
        credits: (userAccount.credits || 0) + amount,
      });

      alert(`Successfully added ${amount} credits to your wallet!`);
      window.location.reload();
    } catch (err: any) {
      alert(`Refill Error: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className='bg-slate-50 min-h-screen py-16 px-6'>
      <div className='max-w-6xl mx-auto'>
        <div className='text-center mb-16'>
          <h1 className='text-4xl font-black text-slate-900 mb-4 tracking-tight'>
            Membership & Credits
          </h1>
          <p className='text-slate-600 max-w-2xl mx-auto font-medium'>
            Subscribe to a plan to unlock CRM and AI features. Refill your
            skip-trace wallet for pay-as-you-go data enrichment.
          </p>
        </div>

        {/* 1. SUBSCRIPTIONS SECTION */}
        <div className='mb-10 flex items-center gap-4'>
          <h2 className='text-xs font-black uppercase tracking-[0.2em] text-slate-400'>
            Monthly Subscriptions
          </h2>
          <div className='h-px bg-slate-200 flex-grow' />
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-8 mb-24'>
          {subscriptions.map((sub) => {
            const isCurrent =
              (sub.tier === 'PRO' && hasPaidPlan && !isAI) ||
              (sub.tier === 'AI_PLAN' && isAI);

            return (
              <div
                key={sub.name}
                className={`bg-white p-10 rounded-[2.5rem] border ${isCurrent ? 'border-indigo-500 ring-2 ring-indigo-50 shadow-lg' : 'border-slate-200'} shadow-sm flex flex-col hover:border-indigo-300 transition-colors`}
              >
                <div className='mb-6'>{sub.icon}</div>
                <h3 className='text-2xl font-black text-slate-900 mb-2 tracking-tight'>
                  {sub.name}
                </h3>
                <div className='flex items-baseline gap-1 mb-6'>
                  <span className='text-5xl font-black text-slate-900 tracking-tighter'>
                    {sub.price}
                  </span>
                  <span className='text-slate-500 font-bold uppercase text-[10px] tracking-widest'>
                    /mo
                  </span>
                </div>
                <p className='text-slate-500 text-sm mb-8 font-medium'>
                  {sub.description}
                </p>

                <ul className='space-y-4 mb-10 flex-grow'>
                  {sub.features.map((f) => (
                    <li
                      key={f}
                      className='flex gap-3 text-sm text-slate-600 font-semibold items-center'
                    >
                      <HiCheck className='text-indigo-500 text-xl flex-shrink-0' />{' '}
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscriptionUpgrade(sub.tier)}
                  disabled={isCurrent || loading === sub.tier}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 group ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {isCurrent
                    ? 'Current Plan'
                    : loading === sub.tier
                      ? 'Processing...'
                      : `Select ${sub.name}`}{' '}
                  {!isCurrent && (
                    <HiOutlineArrowRight className='text-lg group-hover:translate-x-1 transition-transform' />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* 2. SKIP-TRACE WALLET SECTION */}
        <div className='bg-indigo-600 rounded-[3rem] p-8 md:p-16 text-white shadow-2xl relative overflow-hidden'>
          <HiOutlineDatabase className='absolute -bottom-20 -right-20 text-[25rem] text-indigo-500 opacity-20 pointer-events-none' />

          <div className='relative z-10'>
            <div className='flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12'>
              <div className='max-w-xl'>
                <h2 className='text-3xl font-black mb-4 flex items-center gap-3 tracking-tight'>
                  <HiOutlineLightningBolt className='text-yellow-400' />{' '}
                  Skip-Trace Wallet
                </h2>
                <p className='text-indigo-100 font-medium'>
                  Enrichment data is pay-as-you-go. Each skip-trace costs{' '}
                  <span className='text-white font-bold'>$0.10 (1 credit)</span>
                  . Buy a pack to refill your balance instantly. Credits never
                  expire.
                </p>
              </div>
              <div className='bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20'>
                <p className='text-[10px] font-black uppercase tracking-widest text-indigo-200'>
                  Current Balance
                </p>
                <p className='text-2xl font-black'>
                  {userAccount?.credits || 0} Credits
                </p>
              </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-3 gap-6'>
              {creditPacks.map((pack) => (
                <div
                  key={pack.name}
                  className='bg-white/10 backdrop-blur-lg p-8 rounded-[2rem] border border-white/10 text-center hover:bg-white/20 transition-colors'
                >
                  <p className='text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2'>
                    {pack.label}
                  </p>
                  <p className='text-5xl font-black mb-1 tracking-tighter'>
                    {pack.credits}
                  </p>
                  <p className='text-[10px] font-black text-indigo-300 mb-8 uppercase tracking-widest'>
                    Skips
                  </p>
                  <button
                    onClick={() => handleCreditPurchase(pack.id, pack.value)}
                    disabled={loading === pack.id}
                    className='w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition shadow-xl disabled:opacity-50'
                  >
                    {loading === pack.id
                      ? 'Refilling...'
                      : `Buy for ${pack.price}`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
