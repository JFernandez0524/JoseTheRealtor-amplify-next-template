import '@aws-amplify/ui-react/styles.css';
import './globals.css';
import { Inter } from 'next/font/google';
// import ConfigureAmplifyClientSide from '../app/components/ConfigureAmplify';

import AuthProvider from './components/AuthProvider';
import Navbar from './components/Navbar';
import { ConversationsProvider } from './context/ConversationsContext';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en'>
      <body className={inter.className}>
        {/* <ConfigureAmplifyClientSide /> */}
        <AuthProvider>
          <ConversationsProvider>
            <Navbar />
            {children}
          </ConversationsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
