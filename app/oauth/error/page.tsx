export default function OAuthError({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const getErrorMessage = (error?: string) => {
    switch (error) {
      case 'access_denied':
        return 'You denied access to the application.';
      case 'no_code':
        return 'No authorization code was received.';
      case 'invalid_state':
        return 'Invalid state parameter. Please try again.';
      case 'token_exchange_failed':
        return 'Failed to exchange authorization code for tokens.';
      default:
        return 'An unknown error occurred during authorization.';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
          <h3 className="mt-2 text-lg font-medium text-gray-900">Integration Failed</h3>
          <p className="mt-1 text-sm text-gray-500">
            {getErrorMessage(searchParams.error)}
          </p>
          {searchParams.error && (
            <p className="mt-2 text-xs text-gray-400">
              Error: {searchParams.error}
            </p>
          )}
          <div className="mt-6 space-y-2">
            <button
              onClick={() => window.location.href = '/api/v1/oauth/start'}
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Try Again
            </button>
            <br />
            <button
              onClick={() => window.close()}
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Close Window
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
