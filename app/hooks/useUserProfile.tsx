'use client';

import { getFrontEndUserAttributes } from '../utils/aws/auth/amplifyFrontEndUser';
import { useEffect, useState, useCallback } from 'react';

// 1. Import the UserAttributeKey type
import { UserAttributeKey } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

// 2. Rename the function to start with "use" to make it a hook
export function useUserProfile() {
  // 3. Give useState the full type: it can be an attributes object OR null
  const [userAttributes, setUserAttributes] = useState<Partial<
    Record<UserAttributeKey, string>
  > | null>(null);

  const fetchAttributes = useCallback(async () => {
    try {
      const attributes = await getFrontEndUserAttributes();
      setUserAttributes(attributes);
    } catch (error: any) {
      console.error(
        'Error fetching user attributes in useUserProfile:',
        error.message
      );
      setUserAttributes(null);
    }
  }, []);

  useEffect(() => {
    fetchAttributes();

    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn' || payload.event === 'tokenRefresh') {
        fetchAttributes();
      } else if (payload.event === 'signedOut') {
        setUserAttributes(null);
      }
    });

    return () => unsubscribe();
  }, [fetchAttributes]);

  // 5. A hook returns the state variable for components to use
  return userAttributes;
}
