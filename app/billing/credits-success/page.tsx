'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';

export default function CreditsSuccessPage() {
  const router = useRouter();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const user = await getFrontEndUser();
        if (!user) return;
        const { data: accounts } = await client.models.UserAccount.list({
          filter: { owner: { eq: user.userId } },
        });
        if (accounts.length > 0) {
          setCredits(accounts[0].credits ?? 0);
        }
      } catch (err) {
        console.error('Error fetching credits:', err);
      }
    };
    fetchCredits();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-green-500 text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Credits Added!</h2>
        <p className="text-gray-600 mb-6">
          Your skip tracing credits have been added to your account.
        </p>
        {credits !== null && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-semibold">
              Current Balance: {credits} credits
            </p>
          </div>
        )}
        <button
          onClick={() => router.push('/dashboard')}
          className="bg-purple-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-600"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
