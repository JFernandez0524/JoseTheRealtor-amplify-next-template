// src/utils/amplifyServerUtils.server.ts
import { cookies } from 'next/headers';
import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import { generateServerClientUsingCookies } from '@aws-amplify/adapter-nextjs/api';
import { getCurrentUser } from 'aws-amplify/auth/server';

// -----------------------------
// ✅ Safe imports for Amplify outputs and schema
// -----------------------------

let outputs: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  outputs = require('../../../amplify_outputs.json');
} catch {
  console.warn('⚠️ amplify_outputs.json not found yet. Using empty config.');
  outputs = {};
}

let Schema: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Schema = require('../../amplify/data/resource').Schema;
} catch {
  console.warn('⚠️ Amplify data schema not found yet. Using fallback.');
  Schema = {};
}

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

export const cookiesClient = generateServerClientUsingCookies<typeof Schema>({
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
