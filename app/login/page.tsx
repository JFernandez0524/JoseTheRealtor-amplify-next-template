//app/components/login.tsx
'use client';

import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import '@/src/lib/amplifyClient.browser';

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-50 text-center'>
      <div className='bg-white shadow-md rounded-lg p-8 w-full max-w-md'>
        <h1 className='text-2xl font-semibold text-center mb-6 text-blue-600 '>
          Welcome to LeadManager
        </h1>

        <Authenticator
          signUpAttributes={['email']}
          hideSignUp={false}
          variation='default'
        >
          {({ user }) => {
            useEffect(() => {
              if (user) router.push('/dashboard');
            }, [user]);
            return <p className='text-center'>Redirecting...</p>;
          }}
        </Authenticator>
      </div>
    </div>
  );
}
