'use client';

import { useState } from 'react';

export default function GhlOnboardingChoice() {
  const [choice, setChoice] = useState<'existing' | 'new' | null>(null);

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-center mb-6">
        Choose Your GoHighLevel Setup
      </h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Existing GHL Account */}
        <div className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
          choice === 'existing' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
        }`} onClick={() => setChoice('existing')}>
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-3">I Have GoHighLevel</h3>
            <div className="text-3xl mb-4">🔗</div>
            <p className="text-gray-600 mb-4">
              Connect your existing GHL account and sync leads to your current setup.
            </p>
            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              FREE Integration
            </div>
          </div>
        </div>

        {/* New Sub-Account */}
        <div className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
          choice === 'new' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
        }`} onClick={() => setChoice('new')}>
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-3">I Need GoHighLevel</h3>
            <div className="text-3xl mb-4">🚀</div>
            <p className="text-gray-600 mb-4">
              Get a fully managed GHL sub-account with pre-built real estate workflows.
            </p>
            <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
              $97/month
            </div>
          </div>
        </div>
      </div>

      {choice && (
        <div className="mt-8 text-center">
          {choice === 'existing' ? (
            <button 
              onClick={() => window.location.href = '/api/v1/oauth/start'}
              className="bg-blue-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-600"
            >
              Connect My GHL Account
            </button>
          ) : (
            <button 
              onClick={() => window.location.href = '/pricing?plan=ghl-managed'}
              className="bg-purple-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-600"
            >
              Get Managed GHL Account
            </button>
          )}
        </div>
      )}
    </div>
  );
}
