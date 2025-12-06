// src/utils/amplifyServerUtils.server.ts

import { cookies } from 'next/headers';
import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import { generateServerClientUsingCookies } from '@aws-amplify/adapter-nextjs/api';
import {
  getCurrentUser,
  fetchUserAttributes,
  fetchAuthSession,
} from 'aws-amplify/auth/server';

import { type Schema } from '../../../../amplify/data/resource';
import outputs from '../../../../amplify_outputs.json';

// -----------------------------
// ✅ Server configuration
// -----------------------------

type Lead = Schema['PropertyLead']['type'];

export const { runWithAmplifyServerContext, createAuthRouteHandlers } =
  createServerRunner({
    config: outputs,
  });

// -----------------------------
// ✅ Cookies client setup
// -----------------------------

export const cookiesClient = generateServerClientUsingCookies<Schema>({
  config: outputs,
  cookies,
});

// -----------------------------
// ✅ Auth SSR helper
// -----------------------------

export async function AuthGetCurrentUserServer() {
  try {
    const user = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => getCurrentUser(contextSpec),
    });
    return user;
  } catch (error: any) {
    // 🛑 FIX: Silence the error if the user is simply not logged in
    if (
      error.name === 'UserUnAuthenticatedException' ||
      error.code === 'UserUnAuthenticatedException'
    ) {
      return null;
    }
    // Only log real errors (like network issues)
    console.error('AuthGetCurrentUserServer Error:', error);
    return null;
  }
}
export async function AuthGetUserAttributesServer() {
  try {
    const attributes = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (ctx) => fetchUserAttributes(ctx),
    });
    return attributes;
  } catch (error) {
    console.error('Auth SSR error:', error);
    return null;
  }
}

export async function AuthIsUserAuthenticatedServer(): Promise<boolean> {
  const authenticated = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: async (contextSpec) => {
      try {
        const session = await fetchAuthSession(contextSpec);
        return (
          session.tokens?.accessToken !== undefined &&
          session.tokens?.idToken !== undefined
        );
      } catch (error) {
        console.log(error);
        return false;
      }
    },
  });
  return authenticated;
}

export async function createLeadInDatabase(lead: Lead) {
  try {
    const { data } = await cookiesClient.models.PropertyLead.create(lead);
    return data;
  } catch (error: any) {
    console.error('❌ createLeadInDatabase error:', error.message);
  }
}
