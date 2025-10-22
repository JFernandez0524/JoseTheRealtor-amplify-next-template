'use client';

import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthSession } from '@/src/lib/useAuthSession';

export default function AuthPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthenticator((context) => [context.user]);
  const { status } = useAuthSession();

  // ✅ Redirect authenticated users
  useEffect(() => {
    if (user) router.push('/dashboard');
  }, [user, router]);

  // ✅ Handle loading session check
  if (status === 'loading') {
    return (
      <div className='flex items-center justify-center min-h-screen bg-gray-50'>
        <div className='animate-pulse text-gray-500 text-lg'>
          Loading session...
        </div>
      </div>
    );
  }

  // ✅ Authenticator UI (only render when ready)
  return (
    <div className='flex justify-center items-center min-h-screen bg-gray-50'>
      <Authenticator
        initialState={
          pathname?.includes('signup')
            ? 'signUp'
            : pathname?.includes('forgot')
              ? 'forgotPassword'
              : 'signIn'
        }
        socialProviders={['google']}
      />
    </div>
  );
}
