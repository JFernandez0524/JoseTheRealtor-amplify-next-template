'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';

interface GhlContextType {
  isConnected: boolean;
  locationId: string | null;
  integrationId: string | null;
  isLoading: boolean;
  refreshConnection: () => Promise<void>;
}

const defaultGhl: GhlContextType = {
  isConnected: false,
  locationId: null,
  integrationId: null,
  isLoading: true,
  refreshConnection: async () => {},
};

const GhlContext = createContext<GhlContextType>(defaultGhl);

export function GhlProvider({ children }: { children: ReactNode }) {
  const [ghl, setGhl] = useState<GhlContextType>(defaultGhl);

  const checkConnection = useCallback(async () => {
    try {
      const user = await getFrontEndUser();
      if (!user) {
        setGhl({ ...defaultGhl, isLoading: false });
        return;
      }

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
          // Auto-refresh expired token
          console.log('🔄 GHL token expired, auto-refreshing...');
          try {
            const refreshResponse = await fetch('/api/v1/oauth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });

            if (refreshResponse.ok) {
              console.log('✅ GHL token refreshed successfully');
              // Re-check connection after refresh
              await checkConnection();
              return;
            } else {
              console.error('❌ GHL token refresh failed');
            }
          } catch (refreshError) {
            console.error('❌ GHL token refresh error:', refreshError);
          }
        }
        
        setGhl({
          isConnected: !isExpired,
          locationId: integration.locationId || null,
          integrationId: integration.id,
          isLoading: false,
          refreshConnection: checkConnection,
        });
      } else {
        setGhl({ ...defaultGhl, isLoading: false, refreshConnection: checkConnection });
      }
    } catch (error) {
      console.error('Error checking GHL connection:', error);
      setGhl({ ...defaultGhl, isLoading: false, refreshConnection: checkConnection });
    }
  }, []);

  useEffect(() => {
    checkConnection();
    
    // Re-check when window regains focus (after OAuth redirect)
    const handleFocus = () => checkConnection();
    window.addEventListener('focus', handleFocus);
    
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkConnection]);

  return <GhlContext.Provider value={ghl}>{children}</GhlContext.Provider>;
}

export function useGhl() {
  const context = useContext(GhlContext);
  if (!context) {
    throw new Error('useGhl must be used within GhlProvider');
  }
  return context;
}
