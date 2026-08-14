// app/components/dashboard/GhlConnection.tsx
'use client';

import { useState } from 'react';
import { useGhl } from '@/app/context/GhlContext';
import { useAccess } from '@/app/context/AccessContext';
import { client } from '@/app/utils/aws/data/frontEndClient';

export function GhlConnection() {
  const { isConnected, locationId, integrationId, isLoading } = useGhl();
  const { hasPaidPlan } = useAccess();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = () => {
    setConnecting(true);
    window.location.href = '/api/v1/oauth/start';
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetch('/api/v1/ghl/disconnect', { method: 'POST' });
      if (!res.ok && integrationId) {
        await client.models.GhlIntegration.update({
          id: integrationId,
          isActive: false,
        });
      }
      window.location.reload();
    } catch (error) {
      console.error('Error disconnecting GHL:', error);
      if (integrationId) {
        try {
          await client.models.GhlIntegration.update({
            id: integrationId,
            isActive: false,
          });
        } catch (fallbackError) {
          console.error('Fallback disconnect error:', fallbackError);
        }
      }
      window.location.reload();
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Launch AI Integration</h3>
          <p className="text-xs text-gray-500 mt-1">
            {isConnected 
              ? `Connected to location: ${locationId}`
              : 'Connect to enable automated messaging'
            }
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Disconnect
            </button>
          ) : hasPaidPlan ? (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-75"
            >
              {connecting && (
                <svg className="w-3 h-3 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {connecting ? 'Connecting...' : 'Connect Launch AI'}
            </button>
          ) : (
            <a href="/pricing" className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600">
              Upgrade to Connect
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
