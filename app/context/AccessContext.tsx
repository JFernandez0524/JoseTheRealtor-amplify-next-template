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

      if (!userId || !userEmail) return;

      console.log('🔍 AccessContext - Checking user:', { userId, userEmail });

      // 1. Check if the UserAccount exists by BOTH userId AND email
      const [
        { data: accountsByOwner },
        { data: accountsByOwnerContains },
        { data: accountsByEmail }
      ] = await Promise.all([
        client.models.UserAccount.list({
          filter: { owner: { eq: userId } },
        }),
        client.models.UserAccount.list({
          filter: { owner: { contains: userId } },
        }),
        client.models.UserAccount.list({
          filter: { email: { eq: userEmail } },
        })
      ]);

      console.log('🔍 Found accounts:', { 
        byOwner: accountsByOwner?.length || 0,
        byOwnerContains: accountsByOwnerContains?.length || 0,
        byEmail: accountsByEmail?.length || 0 
      });

      const accounts = accountsByOwner?.length > 0 ? accountsByOwner : (accountsByOwnerContains || []);
      const existingAccountByEmail = accountsByEmail?.[0];

      // 2. Fix owner field if account exists by email but not by owner
      if (accounts.length === 0 && existingAccountByEmail) {
        console.log('🔧 Fixing owner field for existing account...');
        try {
          await client.models.UserAccount.update({
            id: existingAccountByEmail.id,
            owner: userId
          });
          console.log('✅ Fixed owner field for account:', existingAccountByEmail.id);
          
          // Re-fetch the account
          const { data: updatedAccounts } = await client.models.UserAccount.list({
            filter: { owner: { eq: userId } },
          });
          
          if (updatedAccounts && updatedAccounts.length > 0) {
            const account = updatedAccounts[0];
            setAccess({
              isPro: account.tier === 'PRO' || account.tier === 'AI_PLAN',
              isAdmin: account.tier === 'ADMIN',
              isAI: account.tier === 'AI_PLAN',
              hasPaidPlan: ['PRO', 'AI_PLAN', 'ADMIN'].includes(account.tier || ''),
              isLoading: false,
            });
            return;
          }
        } catch (updateError) {
          console.error('Failed to fix owner field:', updateError);
        }
      }

      // 3. Create DB record if missing (Handles Social Logins)
      if (accounts.length === 0) {
        // If there's already an account with this email but different userId, don't create another
        if (existingAccountByEmail) {
          console.log('⚠️ Account exists with same email but different userId. This might be a Google login issue.');
          console.log('Existing account owner:', existingAccountByEmail.owner);
          console.log('Current userId:', userId);
          // Don't create a new account, just continue with access setup
        } else {
          // Anti-abuse checks
          const disposableEmailDomains = [
            '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
            'mailinator.com', 'yopmail.com', 'throwaway.email',
            'temp-mail.org', 'getnada.com', 'maildrop.cc'
          ];

          const emailDomain = userEmail.split('@')[1]?.toLowerCase();
          if (disposableEmailDomains.includes(emailDomain)) {
            console.error('❌ Disposable email addresses not allowed');
            return;
          }

          // Get client IP from API
          let clientIP = '0.0.0.0';
          try {
            const ipResponse = await fetch('/api/v1/get-client-ip');
            const ipData = await ipResponse.json();
            clientIP = ipData.ip || '0.0.0.0';
          } catch (ipError) {
            console.log('Failed to get client IP:', ipError);
          }

          // Check for existing accounts with same IP
          const { data: existingIPAccounts } = await client.models.UserAccount.list({
            filter: { registrationIP: { eq: clientIP } },
          });

          if (existingIPAccounts && existingIPAccounts.length >= 1) {
            console.error('❌ Maximum accounts per IP address reached');
            return;
          }

          // Check global flag first
          if (globalUserCreationInProgress[userEmail]) {
            console.log('UserAccount creation already in progress for email, skipping...');
          } else {
            // Set global flag by email instead of userId
            globalUserCreationInProgress[userEmail] = true;
            
            try {
              console.log('Creating UserAccount for:', userEmail);
              
              // Set credit expiration to 30 days from now
              const creditsExpiresAt = new Date();
              creditsExpiresAt.setDate(creditsExpiresAt.getDate() + 30);
              
              await client.models.UserAccount.create({
                email: userEmail,
                credits: 5, // Starter credits for new users
                creditsExpiresAt: creditsExpiresAt.toISOString(),
                registrationIP: clientIP,
                lastLoginIP: clientIP,
                totalLeadsSynced: 0,
                totalSkipsPerformed: 0,
              });
              console.log('✅ UserAccount initialized for:', userEmail);
            } catch (createError) {
              console.log('UserAccount creation failed:', createError);
            } finally {
              // Clear global flag after delay
              setTimeout(() => {
                delete globalUserCreationInProgress[userEmail];
              }, 5000);
            }
          }
        }
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
