import '@aws-amplify/ui-react/styles.css';
import './globals.css';
import { Inter } from 'next/font/google';
import ConfigureAmplifyClientSide from '../app/components/ConfigureAmplify';

import Navbar from '@/app/components/Navbar';
import { AuthGetCurrentUserServer } from '@/src/utils/amplifyServerUtils.server';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await AuthGetCurrentUserServer();
  console.log('user', user);
  return (
    <html lang='en'>
      <body className={inter.className}>
        <ConfigureAmplifyClientSide />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
