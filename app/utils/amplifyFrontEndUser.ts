'use client';

import {
  getCurrentUser,
  fetchUserAttributes,
  fetchAuthSession, // 1. Import the function
  AuthUser,
  UserAttributeKey,
  AuthSession, // 2. Import the return type
} from 'aws-amplify/auth';

export async function getFrontEndUser(): Promise<AuthUser | null> {
  try {
    const user = await getCurrentUser();
    return user;
  } catch (error: any) {
    if (error.name !== 'UserUnauthenticatedException') {
      console.error('Error fetching current user:', error);
      // You may want to remove this throw, just like in the function below
      throw new Error('Error fetching current user');
    }
    return null;
  }
}

export async function getFrontEndUserAttributes(): Promise<Partial<
  Record<UserAttributeKey, string>
> | null> {
  try {
    const attributes = await fetchUserAttributes();
    return attributes;
  } catch (error: any) {
    if (error.name !== 'UserUnauthenticatedException') {
      console.error('User not authenticated', error);
    }
    return null;
  }
}

// 3. 👇 Here is your new function
/**
 * Fetches the current auth session (including tokens) on the client.
 * Returns null if no user is authenticated.
 */
export async function getFrontEndAuthSession(): Promise<AuthSession | null> {
  try {
    const session = await fetchAuthSession();
    return session;
  } catch (error: any) {
    // We apply the same error filtering
    if (error.name !== 'UserUnauthenticatedException') {
      console.error('Error fetching auth session:', error);
    }
    return null;
  }
}
