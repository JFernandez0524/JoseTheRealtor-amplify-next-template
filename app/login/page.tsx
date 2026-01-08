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
  SignUp: {
    FormFields() {
      return (
        <>
          <Authenticator.SignUp.FormFields />
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem', 
            backgroundColor: '#f3f4f6', 
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            color: '#374151'
          }}>
            <strong>Note:</strong> If you previously signed up with Google, please use the "Continue with Google" button instead of creating a new email account.
          </div>
        </>
      );
    },
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
