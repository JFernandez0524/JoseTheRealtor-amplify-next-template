'use client';

import { getFrontEndUserAttributes } from '../utils/aws/auth/amplifyFrontEndUser';
import { useEffect, useState } from 'react';

// 1. Import the UserAttributeKey type
import { UserAttributeKey } from 'aws-amplify/auth';

// 2. Rename the function to start with "use" to make it a hook
export function useUserProfile() {
  // 3. Give useState the full type: it can be an attributes object OR null
  const [userAttributes, setUserAttributes] = useState<Partial<
    Record<UserAttributeKey, string>
  > | null>(null);

  useEffect(() => {
    async function fetchUserAttributes() {
      try {
        const attributes = await getFrontEndUserAttributes();
        // 4. This will set the state to either the attributes object or null
        setUserAttributes(attributes);
      } catch (error: any) {
        console.error(
          'Error fetching user attributes in useUserProfile:',
          error.message
        );
        setUserAttributes(null);
      }
    }

    fetchUserAttributes();
  }, []);

  // 5. A hook returns the state variable for components to use
  return userAttributes;
}
