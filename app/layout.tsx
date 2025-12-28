import '@aws-amplify/ui-react/styles.css';
import './globals.css';
import { Inter } from 'next/font/google';
import AuthProvider from './components/AuthProvider';
import Navbar from './components/Navbar';
import { ConversationsProvider } from './context/ConversationsContext';
import { AccessProvider } from './context/AccessContext'; // 👈 Import it

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 🛡️ Default values for public/guest access
  const guestAccess = {
    isPro: false,
    isAdmin: false,
    isAI: false,
    hasPaidPlan: false,
  };

  return (
    <html lang='en'>
      <body className={inter.className}>
        <AuthProvider>
          <AccessProvider access={guestAccess}>
            <ConversationsProvider>
              <Navbar />
              {children}
            </ConversationsProvider>
          </AccessProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
