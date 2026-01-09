// app/components/dashboard/GhlConnection.tsx
'use client';

import { useState, useEffect } from 'react';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';

export function GhlConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);

  useEffect(() => {
    checkGhlConnection();
  }, []);

  const checkGhlConnection = async () => {
    try {
      const user = await getFrontEndUser();
      if (!user) return;

      const { data: integrations } = await client.models.GhlIntegration.list({
        filter: { 
          userId: { eq: user.userId },
          isActive: { eq: true }
        }
      });

      if (integrations && integrations.length > 0) {
        const integration = integrations[0];
        const isExpired = new Date(integration.expiresAt) < new Date();
        
        if (isExpired && integration.refreshToken) {
          // Try to refresh the token automatically
          try {
            const refreshResponse = await fetch('/api/v1/oauth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                refreshToken: integration.refreshToken,
                userType: 'Location'
              })
            });

            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json();
              
              // Update the integration with new tokens
              await client.models.GhlIntegration.update({
                id: integration.id,
                accessToken: refreshData.access_token,
                refreshToken: refreshData.refresh_token,
                expiresAt: new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString(),
                updatedAt: new Date().toISOString()
              });

              setIsConnected(true);
              setConnectionInfo({...integration, accessToken: refreshData.access_token});
              return;
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
          }
        }
        
        setIsConnected(!isExpired);
        setConnectionInfo(integration);
      }
    } catch (error) {
      console.error('Error checking GHL connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = () => {
    window.location.href = '/api/v1/oauth/start';
  };

  const handleDisconnect = async () => {
    if (!connectionInfo) return;
    
    try {
      await client.models.GhlIntegration.update({
        id: connectionInfo.id,
        isActive: false
      });
      setIsConnected(false);
      setConnectionInfo(null);
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
              ? `Connected to location: ${connectionInfo?.locationId}`
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
