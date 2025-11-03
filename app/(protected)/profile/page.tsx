// app/(protected)/profile/page.tsx
import { redirect } from 'next/navigation';

import { runWithAmplifyServerContext } from '@/app/utils/amplifyServerUtils.server';
import { fetchUserAttributes } from 'aws-amplify/auth/server';
import { cookies } from 'next/headers';
import SignOutButton from '@/app/components/Logout';
import {
  AuthGetCurrentUserServer,
  AuthGetUserAttributesServer,
} from '@/app/utils/amplifyServerUtils.server';
import { a } from '@aws-amplify/backend';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  // 1️⃣ Get current user from SSR cookies
  // ✅ SSR-safe: get current user from Amplify server context
  // const { user } = await runWithAmplifyServerContext({
  //   nextServerContext: { cookies },
  //   operation: async (ctx) => {
  //     try {
  //       const user = await getCurrentUser(ctx);
  //       console.log('Current user', user);

  //       return { user };
  //     } catch {
  //       return { user: null };
  //     }
  //   },
  // });
  const user = await AuthGetCurrentUserServer();

  if (!user) {
    redirect('/login'); // Server-side redirect if unauthenticated
  }

  const attributes = await AuthGetUserAttributesServer();
  console.log('attributes', attributes);

  // 3️⃣ Render profile details (SSR-rendered)
  return (
    <main className='max-w-2xl mx-auto py-10 px-6'>
      <h1 className='text-3xl font-bold mb-6'>My Profile</h1>

      <div className='bg-gray-50 border rounded-lg p-6 space-y-4 shadow-sm'>
        {attributes?.picture && (
          <div className='flex items-center space-x-2'>
            <span className='font-semibold'>Picture:</span>
            <img
              src={attributes?.picture.toString()}
              alt={attributes?.name || 'User profile picture'}
              className='w-16 h-16 rounded-full' // Example: Add size and style
            />
          </div>
        )}
        <div>
          <span className='font-semibold'>Username:</span>{' '}
          <span>{attributes?.name}</span>
        </div>
        <div>
          <span className='font-semibold'>User ID (sub):</span>{' '}
          <span>{user.userId}</span>
        </div>
        {attributes && (
          <>
            {attributes.email && (
              <div>
                <span className='font-semibold'>Email:</span>{' '}
                <span>{attributes?.email}</span>
              </div>
            )}
            {attributes.name && (
              <div>
                <span className='font-semibold'>Name:</span>{' '}
                <span>{attributes?.name}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className='mt-8'>
        <SignOutButton />
      </div>
    </main>
  );
}
