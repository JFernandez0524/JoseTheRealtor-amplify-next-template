export default function OAuthSuccess({
  searchParams,
}: {
  searchParams: { locationId?: string }
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h3 className="mt-2 text-lg font-medium text-gray-900">Integration Successful!</h3>
          <p className="mt-1 text-sm text-gray-500">
            Your GoHighLevel account has been successfully connected.
          </p>
          {searchParams.locationId && (
            <p className="mt-2 text-xs text-gray-400">
              Location ID: {searchParams.locationId}
            </p>
          )}
          <div className="mt-6">
            <button
              onClick={() => window.close()}
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Close Window
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
