// app/(protected)/layout.tsx
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import LoadingOverlay from '@/app/components/shared/LoadingOverlay';

import { AuthIsUserAuthenticatedServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Run the Auth Check on the Server
  const isAuthenticated = await AuthIsUserAuthenticatedServer();
  if (!isAuthenticated) {
    redirect('/login');
  }

  return (
    <div className='min-h-screen bg-slate-50'>
      <main>
        <Suspense fallback={<LoadingOverlay />}>{children}</Suspense>
      </main>
    </div>
  );
}
