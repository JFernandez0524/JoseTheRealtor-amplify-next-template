'use client';

import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import { AuthUser, UserAttributeKey } from 'aws-amplify/auth';

export async function getFrontEndUser(): Promise<AuthUser | null> {
  try {
    const user = await getCurrentUser();
    return user;
  } catch (error: any) {
    // 👇 MODIFICATION:
    // Only log errors that are *not* the expected "not logged in" error
    // 👇 ADD THIS DEBUGGING LOG

    if (error.name !== 'UserUnAuthenticatedException') {
      console.error('Error fetching current user:', error);
      throw new Error('Error fetching current user');
    }
    return null;
  }
}

export async function getFrontEndUserAttributes(): Promise<
  Partial<Record<UserAttributeKey, string> | null>
> {
  try {
    const attributes = await fetchUserAttributes();
    return attributes;
  } catch (error: any) {
    if (error.name !== 'UserUnAuthenticatedException') {
      console.error('User not authenticated', error);
    }
    return null;
  }
}
