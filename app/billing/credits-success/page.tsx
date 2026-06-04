'use client';

export default function CreditsSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-green-500 text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Credits Added!</h2>
        <p className="text-gray-600 mb-6">
          Your skip tracing credits have been added to your account.
        </p>
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
