// src/lib/amplifyClient.server.ts

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import outputs from '../../amplify_outputs.json';

/**
 * Configure Amplify for server-side usage (API routes, SSR, etc.)
 * This version ensures Amplify.configure() only runs once,
 * and sets SSR mode for proper cookie/session handling.
 */
if (!(Amplify as any)._configured) {
  Amplify.configure(outputs, { ssr: true });
  (Amplify as any)._configured = true;
}

/**
 * Returns a server-safe Amplify Data client.
 * Use inside API routes or Next.js server actions.
 */
export const getServerClient = () => generateClient<Schema>();

/* Example usage:
  const client = getServerClient();
  const { data, errors } = await client.models.Lead.create({
    name: "John Doe",
    type: "probate",
  });
*/

// await client.mutations.addUserToGroup({
//   groupName: 'ADMINS',
//   userId: '5468d468-4061-70ed-8870-45c766d26225',
// });
