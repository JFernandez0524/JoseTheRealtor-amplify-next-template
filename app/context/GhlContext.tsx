'use client';

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { Hub } from 'aws-amplify/utils';
import { fetchAuthSession } from 'aws-amplify/auth';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { resolveGhlConnection } from './ghlConnection';

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
  const requestIdRef = useRef(0);

  const checkConnection = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      const resolved = await resolveGhlConnection({
        getUser: getFrontEndUser,
        ensureSession: async () => {
          try {
            const session = await fetchAuthSession();
            return Boolean(session.tokens);
          } catch {
            return false;
          }
        },
        listIntegrations: async (userId) => {
          const { data, errors } = await client.models.GhlIntegration.list({
            filter: {
              userId: { eq: userId },
              isActive: { eq: true },
            },
          });
          return { data, errors };
        },
        refreshToken: async () => {
          const res = await fetch('/api/v1/oauth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          return { ok: res.ok, status: res.status };
        },
      });

      if (requestId !== requestIdRef.current) return;

      setGhl({
        ...resolved,
        isLoading: false,
        refreshConnection: checkConnection,
      });
    } catch (error) {
      console.error('Error checking GHL connection:', error);
      if (requestId !== requestIdRef.current) return;
      setGhl({ ...defaultGhl, isLoading: false, refreshConnection: checkConnection });
    }
  }, []);

  useEffect(() => {
    checkConnection();

    // Re-check whenever user signs in or refreshes token
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn' || payload.event === 'tokenRefresh') {
        setGhl((prev) => ({ ...prev, isLoading: true }));
        checkConnection();
      } else if (payload.event === 'signedOut') {
        requestIdRef.current++;
        setGhl({ ...defaultGhl, isLoading: false });
      }
    });

    // Re-check when window regains focus (after OAuth redirect)
    const handleFocus = () => checkConnection();
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
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
