// app/components/dashboard/GhlConnection.tsx
'use client';

import { useGhl } from '@/app/context/GhlContext';
import { client } from '@/app/utils/aws/data/frontEndClient';

export function GhlConnection() {
  const { isConnected, locationId, integrationId, isLoading } = useGhl();

  const handleConnect = () => {
    window.location.href = '/api/v1/oauth/start';
  };

  const handleDisconnect = async () => {
    if (!integrationId) return;
    
    try {
      await client.models.GhlIntegration.update({
        id: integrationId,
        isActive: false
      });
      window.location.reload(); // Refresh to update context
    } catch (error) {
      console.error('Error disconnecting GHL:', error);
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
          <h3 className="text-sm font-semibold text-gray-900">GoHighLevel Integration</h3>
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
          ) : (
            <button
              onClick={handleConnect}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Connect GHL
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
