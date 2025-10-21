'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';

/**
 * Lightweight hook to check if a user is currently signed in.
 * Returns:
 *  - "loading" | "authenticated" | "unauthenticated"
 *  - currentUser (if available)
 */
export function useAuthSession() {
  const [status, setStatus] = useState<
    'loading' | 'authenticated' | 'unauthenticated'
  >('loading');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function checkUser() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        setStatus('authenticated');
      } catch {
        setStatus('unauthenticated');
      }
    }
    checkUser();
  }, []);

  return { status, user };
}
