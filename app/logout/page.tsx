'use client';

import { signOut } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import '@/src/lib/amplifyClient.browser'; // ✅ ensure Amplify is configured

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleLogout() {
      const user = await getCurrentUser();

      try {
        if (user) await signOut(); // 👈 signs out the current Cognito user
      } catch (error) {
        console.error('Error signing out:', error);
      } finally {
        router.replace('/'); // 👈 redirect to home page
      }
    }

    handleLogout();
  }, [router]);

  return (
    <div className='flex items-center justify-center h-screen'>
      <p className='text-gray-600 text-lg'>Signing you out...</p>
    </div>
  );
}
