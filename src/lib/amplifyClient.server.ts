// src/lib/amplifyClient.server.ts
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import outputs from '../../amplify_outputs.json';

if (!(Amplify as any)._configured) {
  Amplify.configure(outputs, { ssr: true });
  (Amplify as any)._configured = true;
}

export const getServerClient = () => generateClient<Schema>();

// await client.mutations.addUserToGroup({
//   groupName: 'ADMINS',
//   userId: '5468d468-4061-70ed-8870-45c766d26225',
// });
