'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const contactId = searchParams.get('contact');
    const email = searchParams.get('email');

    if (!contactId) {
      setStatus('error');
      setMessage('Invalid unsubscribe link');
      return;
    }

    handleUnsubscribe(contactId, email);
  }, [searchParams]);

  const handleUnsubscribe = async (contactId: string, email: string | null) => {
    try {
      const response = await fetch('/api/v1/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, email })
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setMessage('You have been successfully unsubscribed from our email list.');
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to unsubscribe. Please try again.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('An error occurred. Please try again later.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Processing...</h1>
            <p className="text-gray-600">Please wait while we unsubscribe you.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Unsubscribed Successfully</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <p className="text-sm text-gray-500">
              You will no longer receive automated emails from us. If you have any questions, please contact us directly.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-red-600 text-5xl mb-4">✕</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Unsubscribe Failed</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <p className="text-sm text-gray-500">
              If you continue to have issues, please contact us at{' '}
              <a href="mailto:Jose.Fernandez@JoseTheRealtor.com" className="text-blue-600 hover:underline">
                Jose.Fernandez@JoseTheRealtor.com
              </a>
            </p>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            REMAX HOMELAND REALTORS<br />
            83 South St, Suite 302<br />
            Freehold, NJ 07728
          </p>
        </div>
      </div>
    </div>
  );
}
