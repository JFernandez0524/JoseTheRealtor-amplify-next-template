'use client';

import { useState, useEffect } from 'react';
import { getFrontEndAuthSession } from '@/app/utils/aws/auth/amplifyFrontEndUser';

export function useSubscription() {
  const [subscription, setSubscription] = useState({
    isPro: false,
    isAdmin: false,
    hasPremiumAccess: false,
    isLoading: true,
  });

  useEffect(() => {
    async function checkAccess() {
      try {
        const session = await getFrontEndAuthSession();
        if (session) {
          const groups =
            (session.tokens?.accessToken.payload[
              'cognito:groups'
            ] as string[]) || [];

          const isPro = groups.includes('PRO');
          const isAdmin = groups.includes('ADMINS');

          setSubscription({
            isPro,
            isAdmin,
            hasPremiumAccess: isPro || isAdmin,
            isLoading: false,
          });
        } else {
          setSubscription((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        setSubscription((prev) => ({ ...prev, isLoading: false }));
      }
    }
    checkAccess();
  }, []);

  return subscription;
}
