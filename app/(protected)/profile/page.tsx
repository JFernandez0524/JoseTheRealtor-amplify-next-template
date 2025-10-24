// app/(protected)/profile/page.tsx
import { redirect } from 'next/navigation';
import { AuthGetCurrentUserServer } from '@/src/utils/amplifyServerUtils.server';
import { runWithAmplifyServerContext } from '@/src/utils/amplifyServerUtils.server';
import { fetchUserAttributes } from 'aws-amplify/auth/server';
import { cookies } from 'next/headers';
import SignOutButton from '@/app/components/Logout';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  // 1️⃣ Get current user from SSR cookies
  const user = await AuthGetCurrentUserServer();

  if (!user) {
    redirect('/login'); // Server-side redirect if unauthenticated
  }

  // 2️⃣ Fetch additional user attributes (optional)
  const attributes = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: (ctx) => fetchUserAttributes(ctx),
  });

  // 3️⃣ Render profile details (SSR-rendered)
  return (
    <main className='max-w-2xl mx-auto py-10 px-6'>
      <h1 className='text-3xl font-bold mb-6'>My Profile</h1>

      <div className='bg-gray-50 border rounded-lg p-6 space-y-4 shadow-sm'>
        <div>
          <span className='font-semibold'>Username:</span>{' '}
          <span>{user.username}</span>
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
                <span>{attributes.email}</span>
              </div>
            )}
            {attributes.name && (
              <div>
                <span className='font-semibold'>Name:</span>{' '}
                <span>{attributes.name}</span>
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
