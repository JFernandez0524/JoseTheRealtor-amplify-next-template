import '@aws-amplify/ui-react/styles.css';
import './globals.css';
import { Inter } from 'next/font/google';
import AuthProvider from './components/AuthProvider';
import Navbar from './components/Navbar';
import { ConversationsProvider } from './context/ConversationsContext';
import { AccessProvider } from './context/AccessContext';
import SessionTimeout from './components/SessionTimeout';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en'>
      <body className={inter.className}>
        <AuthProvider>
          <AccessProvider>
            <ConversationsProvider>
              <SessionTimeout />
              <Navbar />
              {children}
            </ConversationsProvider>
          </AccessProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
