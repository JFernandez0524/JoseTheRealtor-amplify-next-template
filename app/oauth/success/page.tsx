'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';

export default function OAuthSuccessPage() {
  const searchParams = useSearchParams();
  const locationId = searchParams.get('locationId');
  const [countdown, setCountdown] = useState(5);
  const [redirectUrl, setRedirectUrl] = useState('/dashboard');

  useEffect(() => {
    checkUserGroups();
  }, []);

  const checkUserGroups = async () => {
    try {
      const session = await fetchAuthSession();
      const groups = session.tokens?.accessToken?.payload['cognito:groups'] as string[] || [];
      
      // If user has AI_PLAN, redirect to settings to configure phone/email
      if (groups.includes('AI_PLAN')) {
        setRedirectUrl('/settings');
      }
    } catch (error) {
      console.error('Error checking user groups:', error);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.location.href = redirectUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [redirectUrl]);

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
        
        {redirectUrl === '/settings' ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm font-semibold text-blue-900 mb-2">⚙️ Configure Campaign Settings</p>
            <p className="text-xs text-blue-700">
              You'll be redirected to configure your campaign phone number and email address for automated outreach.
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-8">
            You can now sync your qualified leads to GoHighLevel automatically.
          </p>
        )}

        <div className="space-y-3">
          <button
            onClick={() => window.location.href = redirectUrl}
            className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            {redirectUrl === '/settings' ? 'Configure Settings' : 'Go to Dashboard'}
          </button>
          
          <p className="text-xs text-gray-400">
            Redirecting automatically in {countdown} seconds...
          </p>
        </div>
      </div>
    </div>
  );
}
