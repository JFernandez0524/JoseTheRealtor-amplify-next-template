'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BillingSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/dashboard');
    }, 4000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-green-500 text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to PRO!</h2>
        <p className="text-gray-600 mb-6">
          Your subscription has been activated. You now have access to all Sync Plan features
          including Launch AI integration.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            Redirecting to your dashboard...
          </p>
        </div>
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
