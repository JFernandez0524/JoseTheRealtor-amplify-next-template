'use client';
//Component to add user to ADMINS group

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

export default function AdminTools() {
  const promoteToAdmin = async () => {
    const { data, errors } = await client.mutations.addUserToGroup({
      userId: '< REPLACE_WITH_USER_ID >',
      groupName: 'ADMINS', // Must match the group defined in auth/resource.ts
    });

    if (errors) {
      console.error('Promotion failed:', errors);
    } else {
      console.log('User promoted successfully:', data);
    }
  };

  return (
    <div>
      <button onClick={promoteToAdmin}>Promote Me to Admin</button>
    </div>
  );
}
