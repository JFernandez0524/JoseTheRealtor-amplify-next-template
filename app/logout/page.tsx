'use client';

import { getCurrentUser, signOut } from 'aws-amplify/auth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    async function getUser() {
      try {
        const user = await getCurrentUser();
        if (user) {
          await signOut();
        }
      } catch (error) {
        console.log(error);
      } finally {
        router.push('/');
      }
    }
    getUser();
  }, []);
  return <div>LogoutPage</div>;
}
