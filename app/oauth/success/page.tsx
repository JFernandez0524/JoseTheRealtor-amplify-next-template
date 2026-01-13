'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function OAuthSuccessPage() {
  const searchParams = useSearchParams();
  const locationId = searchParams.get('locationId');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.location.href = '/dashboard';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="text-green-500 text-6xl mb-6">✅</div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Connection Successful!
        </h1>
        
        <p className="text-gray-600 mb-6">
          Your GoHighLevel account has been successfully connected.
        </p>

        {locationId && (
          <div className="bg-gray-100 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">Connected Location:</p>
            <p className="font-mono text-sm text-gray-800">{locationId}</p>
          </div>
        )}
        
        <p className="text-sm text-gray-500 mb-8">
          You can now sync your qualified leads to GoHighLevel automatically.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            Go to Dashboard
          </button>
          
          <p className="text-xs text-gray-400">
            Redirecting automatically in {countdown} seconds...
          </p>
        </div>
      </div>
    </div>
  );
}
