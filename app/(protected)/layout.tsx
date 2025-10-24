import { redirect } from 'next/navigation';
import { AuthGetCurrentUserServer } from '@/src/utils/amplifyServerUtils.server';
import Navbar from '@/app/components/Navbar';
import ConfigureAmplifyClientSide from '@/src/lib/amplifyClient.browser';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;

  try {
    user = await AuthGetCurrentUserServer();
  } catch {
    // Redirect unauthenticated users before rendering anything
    redirect('/login');
  }

  return (
    <html lang='en'>
      <body>
        <ConfigureAmplifyClientSide />
        <Navbar user={user} />
        <main>{children}</main>
      </body>
    </html>
  );
}
