'use client';

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { Hub } from 'aws-amplify/utils';

interface AccessContextType {
  isPro: boolean;
  isAdmin: boolean;
  isAI: boolean;
  hasPaidPlan: boolean;
  credits: number;
  isLoading: boolean;
}

const defaultAccess: AccessContextType = {
  isPro: false,
  isAdmin: false,
  isAI: false,
  hasPaidPlan: false,
  credits: 0,
  isLoading: true,
};

const AccessContext = createContext<AccessContextType>(defaultAccess);

// Global flag to prevent multiple user creation attempts across all instances
let globalUserCreationInProgress: Record<string, boolean> = {};

export function AccessProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<AccessContextType>(defaultAccess);
  
  // Add creation lock to prevent race conditions
  const creatingAccount = useRef(false);

  const checkAccess = useCallback(async () => {
    try {
      const [session, attributes] = await Promise.all([
        fetchAuthSession(),
        fetchUserAttributes(),
      ]);

      const groups =
        (session.tokens?.accessToken.payload['cognito:groups'] as string[]) ||
        [];
      const userId = session.userSub;
      const userEmail = attributes.email;

      if (!userId || !userEmail) {
        setAccess({ ...defaultAccess, isLoading: false });
        return;
      }

      console.log('🔍 AccessContext - Checking user:', { userId, userEmail });

      // 1. 🛡️ Identity Fail-Safe: Add to FREE group if not in any app groups
      const appGroups = ['ADMINS', 'PRO', 'AI_PLAN', 'FREE'];
      const hasAppGroup = groups.some((g) => appGroups.includes(g));

      if (!hasAppGroup) {
        console.log('User missing from app groups. Assigning to FREE...');
        try {
          await client.mutations.addUserToGroup({
            userId: userId,
            groupName: 'FREE',
          });
          await fetchAuthSession({ forceRefresh: true });
          window.location.reload();
          return;
        } catch (groupErr) {
          console.warn('Auto-assign FREE error:', groupErr);
        }
      }

      // 2. Fetch authoritative profile and credit balance from server
      let userCredits = 5;
      let isPro = groups.includes('PRO') || groups.includes('AI_PLAN');
      let isAdmin = groups.includes('ADMINS');
      let isAI = groups.includes('AI_PLAN');

      try {
        const res = await fetch('/api/v1/user/profile');
        if (res.ok) {
          const profile = await res.json();
          if (profile.success) {
            userCredits = profile.credits ?? 5;
            if (profile.isPro !== undefined) isPro = profile.isPro;
            if (profile.isAdmin !== undefined) isAdmin = profile.isAdmin;
            if (profile.isAI !== undefined) isAI = profile.isAI;
          }
        }
      } catch (fetchErr) {
        console.warn('Profile fetch error, using session claims:', fetchErr);
      }

      setAccess({
        isAdmin,
        isPro,
        isAI,
        hasPaidPlan: isPro || isAdmin || isAI,
        credits: userCredits,
        isLoading: false,
      });
    } catch (error) {
      console.error('Access Check Error:', error);
      setAccess({ ...defaultAccess, isLoading: false });
    }
  }, []);


  useEffect(() => {
    checkAccess();
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn' || payload.event === 'tokenRefresh') {
        checkAccess();
      } else if (payload.event === 'signedOut') {
        // Clear localStorage flags on sign out
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('userAccount_created_')) {
            localStorage.removeItem(key);
          }
        });
        setAccess({ ...defaultAccess, isLoading: false });
      }
    });
    return () => unsubscribe();
  }, [checkAccess]);

  return (
    <AccessContext.Provider value={access}>{children}</AccessContext.Provider>
  );
}

export function useAccess() {
  return useContext(AccessContext);
}
