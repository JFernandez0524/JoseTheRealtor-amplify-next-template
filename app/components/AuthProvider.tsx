'use client';

import { Authenticator } from '@aws-amplify/ui-react';

import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';

// 1. Configure Amplify ONCE for the browser.
//    { ssr: true } = "use the secure auth cookies from the Next.js adapter"
Amplify.configure(outputs, { ssr: true });

export const ConfigureAmplify = () => {
  return null;
};

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Authenticator.Provider>
      <ConfigureAmplify />
      {children}
    </Authenticator.Provider>
  );
}
