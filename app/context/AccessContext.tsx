'use client';

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
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
  isLoading: boolean;
}

const defaultAccess: AccessContextType = {
  isPro: false,
  isAdmin: false,
  isAI: false,
  hasPaidPlan: false,
  isLoading: true,
};

const AccessContext = createContext<AccessContextType>(defaultAccess);

export function AccessProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<AccessContextType>(defaultAccess);

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

      if (!userId || !userEmail) return;

      // 1. Check if the UserAccount exists
      const { data: accounts } = await client.models.UserAccount.list({
        filter: { owner: { eq: userId } },
      });

      // 2. Create DB record if missing (Handles Social Logins)
      if (accounts.length === 0) {
        await client.models.UserAccount.create({
          email: userEmail,
          credits: 0,
          totalLeadsSynced: 0,
          totalSkipsPerformed: 0,
        });
        console.log('✅ UserAccount initialized for:', userEmail);
      }

      // 3. 🛡️ Identity Fail-Safe: Add to FREE group if not in any app groups
      // We check if they have NO app-specific groups (ignores the system Google group)
      const appGroups = ['ADMINS', 'PRO', 'AI_PLAN', 'FREE'];
      const hasAppGroup = groups.some((g) => appGroups.includes(g));

      if (!hasAppGroup) {
        console.log('User missing from app groups. Assigning to FREE...');
        await client.mutations.addUserToGroup({
          userId: userId,
          groupName: 'FREE',
        });

        // Force a session refresh so the new group shows up in the Navbar immediately
        await fetchAuthSession({ forceRefresh: true });
        window.location.reload();
        return; // Stop execution here as the reload will re-trigger checkAccess
      }

      setAccess({
        isAdmin: groups.includes('ADMINS'),
        isPro: groups.includes('PRO'),
        isAI: groups.includes('AI_PLAN'),
        hasPaidPlan:
          groups.includes('PRO') ||
          groups.includes('AI_PLAN') ||
          groups.includes('ADMINS'),
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
