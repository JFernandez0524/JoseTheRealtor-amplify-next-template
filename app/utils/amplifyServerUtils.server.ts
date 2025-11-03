// src/utils/amplifyServerUtils.server.ts

import { cookies } from 'next/headers';
import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import { generateServerClientUsingCookies } from '@aws-amplify/adapter-nextjs/api';
import {
  getCurrentUser,
  fetchUserAttributes,
  fetchAuthSession,
} from 'aws-amplify/auth/server';

import { type Schema } from '@/amplify/data/resource';
import outputs from '@/amplify_outputs.json';

// -----------------------------
// ✅ Server configuration
// -----------------------------

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
    const currentUser = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => getCurrentUser(contextSpec),
    });
    return currentUser;
  } catch (error) {
    console.error('Auth SSR error:', error);
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
