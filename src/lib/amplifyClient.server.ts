//src/lib/amplifyClient.ts
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

/**
 * Shared Amplify Data client for server-side code (Next.js routes, Lambdas, etc.)
 *
 * Usage:
 *   import { client } from '@/src/lib/amplifyClient';
 *   const { data } = await client.models.Lead.create({...});
 */

// ✅ Create Amplify Data client
export const client = generateClient<Schema>({
  // authMode: 'apiKey', // Use your default mode (matches resource.ts)
});

await client.mutations.addUserToGroup({
  groupName: 'ADMINS',
  userId: '5468d468-4061-70ed-8870-45c766d26225',
});
