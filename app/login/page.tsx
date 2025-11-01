// app/login/page.tsx - Custom <Authenticator>

'use client';

import {
  Authenticator,
  Text,
  View,
  useAuthenticator,
} from '@aws-amplify/ui-react';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';

const components = {
  Header() {
    return (
      <View textAlign='center'>
        <Text>
          <span style={{ color: 'white' }}>Authenticator Header</span>
        </Text>
      </View>
    );
  },
};

function CustomAuthenticator() {
  const { user } = useAuthenticator((context) => [context.user]);

  useEffect(() => {
    if (user) {
      redirect('/');
    }
  }, [user]);

  return <Authenticator socialProviders={['google']} components={components} />;
}

export default function Login() {
  return (
    <Authenticator.Provider>
      <CustomAuthenticator />
    </Authenticator.Provider>
  );
}
