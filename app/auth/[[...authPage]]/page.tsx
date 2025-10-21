'use client';

import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';

export default function AuthPage() {
  const router = useRouter();
  const { route, user } = useAuthenticator((context) => [
    context.route,
    context.user,
  ]);

  // Automatically redirect once authenticated
  useEffect(() => {
    if (route === 'authenticated' && user) {
      router.push('/dashboard');
    }
  }, [route, user, router]);

  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-50'>
      <div className='bg-white shadow-lg rounded-lg p-6 w-full max-w-md'>
        <Authenticator
          signUpAttributes={['email']}
          socialProviders={['google']}
          hideSignUp={false}
        >
          {({ signOut, user }) => (
            <div className='text-center'>
              <h1 className='text-2xl font-semibold text-blue-600 mb-4'>
                Welcome to LeadManager
              </h1>
              <p className='text-gray-700'>
                Signed in as: {user?.signInDetails?.loginId || user?.username}
              </p>
              <button
                onClick={signOut}
                className='mt-4 px-4 py-2 bg-red-500 text-white rounded-md'
              >
                Sign Out
              </button>
            </div>
          )}
        </Authenticator>
      </div>
    </div>
  );
}
