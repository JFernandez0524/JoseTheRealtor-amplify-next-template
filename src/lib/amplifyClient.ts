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
  authMode: 'apiKey', // Use your default mode (matches resource.ts)
});
