// src/utils/amplifyServerUtils.server.ts
import { cookies } from 'next/headers';
import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import { generateServerClientUsingCookies } from '@aws-amplify/adapter-nextjs/api';
import { getCurrentUser } from 'aws-amplify/auth/server';
import { type Schema } from '../../amplify/data/resource';
import outputs from '../../amplify_outputs.json';

export const { runWithAmplifyServerContext, createAuthRouteHandlers } =
  createServerRunner({
    config: outputs,
    runtimeOptions: {
      cookies: {
        domain: new URL(origin).hostname, // making cookies available to all subdomains
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
    },
  });

export const cookiesClient = generateServerClientUsingCookies<Schema>({
  config: outputs,
  cookies,
});

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
