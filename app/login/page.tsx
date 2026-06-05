'use client';

import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { redirect } from 'next/navigation';
import { useEffect } from 'react';

function CustomAuthenticator() {
  const { user } = useAuthenticator((context) => [context.user]);

  useEffect(() => {
    if (user) {
      redirect('/');
    }
  }, [user]);

  return <Authenticator socialProviders={['google']} hideSignUp />;
}

export default function Login() {
  return (
    <Authenticator.Provider>
      <CustomAuthenticator />
    </Authenticator.Provider>
  );
}
