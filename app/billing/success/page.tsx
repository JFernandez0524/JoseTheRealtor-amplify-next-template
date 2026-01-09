'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function BillingSuccessPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) {
      // Verify the session and update user status
      verifySession(sessionId);
    } else {
      setStatus('error');
    }
  }, [sessionId]);

  const verifySession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/v1/billing/verify-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (response.ok) {
        setStatus('success');
        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 3000);
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error('Session verification error:', error);
      setStatus('error');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900">Processing your subscription...</h2>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Payment Failed</h2>
          <p className="text-gray-600 mb-6">
            There was an issue processing your payment. Please try again or contact support.
          </p>
          <button
            onClick={() => window.location.href = '/pricing'}
            className="bg-purple-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-600"
          >
            Back to Pricing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-green-500 text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to PRO!</h2>
        <p className="text-gray-600 mb-6">
          Your subscription has been activated successfully. You now have access to all PRO features 
          including unlimited skip tracing and CRM integration.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            🚀 Redirecting to your dashboard in a few seconds...
          </p>
        </div>
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="bg-purple-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-600"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
