'use client';

import { useSearchParams } from 'next/navigation';

export default function OAuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, { title: string; description: string; action: string }> = {
    token_exchange_failed: {
      title: 'Connection Failed',
      description: 'Unable to connect to your GoHighLevel account. This might be due to incorrect credentials or a temporary issue.',
      action: 'Please try connecting again or contact support if the issue persists.'
    },
    no_code: {
      title: 'Authorization Failed',
      description: 'No authorization code was received from GoHighLevel.',
      action: 'Please try the connection process again.'
    },
    missing_credentials: {
      title: 'Configuration Error',
      description: 'The application is not properly configured for GoHighLevel integration.',
      action: 'Please contact support to resolve this issue.'
    },
    user_not_authenticated: {
      title: 'Authentication Required',
      description: 'You must be logged in to connect your GoHighLevel account.',
      action: 'Please log in and try again.'
    },
    access_denied: {
      title: 'Access Denied',
      description: 'You denied access to your GoHighLevel account.',
      action: 'To use CRM features, you need to grant access to your GHL account.'
    },
    invalid_request: {
      title: 'Invalid Request',
      description: 'The authorization request was invalid or malformed.',
      action: 'Please try connecting again.'
    },
    unauthorized: {
      title: 'Unauthorized',
      description: 'The application is not authorized to access GoHighLevel.',
      action: 'Please contact support to resolve this configuration issue.'
    },
    user_error: {
      title: 'User Authentication Error',
      description: 'There was an issue with your user authentication.',
      action: 'Please log out, log back in, and try connecting again.'
    }
  };

  const errorInfo = errorMessages[error || 'unknown'] || {
    title: 'Connection Error',
    description: 'An unexpected error occurred while connecting to GoHighLevel.',
    action: 'Please try again or contact support.'
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="text-red-500 text-6xl mb-6">⚠️</div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {errorInfo.title}
        </h1>
        
        <p className="text-gray-600 mb-6">
          {errorInfo.description}
        </p>
        
        <p className="text-sm text-gray-500 mb-8">
          {errorInfo.action}
        </p>

        <div className="space-y-3">
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            Back to Dashboard
          </button>
          
          <button
            onClick={() => window.location.href = '/api/v1/oauth/start'}
            className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            Try Again
          </button>
        </div>

        {error && (
          <div className="mt-6 p-3 bg-gray-100 rounded text-xs text-gray-500">
            Error Code: {error}
          </div>
        )}
      </div>
    </div>
  );
}
