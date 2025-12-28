// app/(protected)/layout.tsx
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import LoadingOverlay from '@/app/components/shared/LoadingOverlay';

import {
  AuthGetUserGroupsServer,
  AuthIsUserAuthenticatedServer,
} from '@/app/utils/aws/auth/amplifyServerUtils.server';

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

  // 2. Get Groups and calculate access levels
  const groups = await AuthGetUserGroupsServer();

  const accessData = {
    isPro: groups.includes('PRO'),
    isAdmin: groups.includes('ADMINS'),
    isAI: groups.includes('AI_PLAN'),
    hasPaidPlan:
      groups.includes('PRO') ||
      groups.includes('AI_PLAN') ||
      groups.includes('ADMINS'),
  };

  return (
    <div className='min-h-screen bg-slate-50'>
      {/* 3. Wrap everything in the AccessProvider */}

      <main>
        <Suspense fallback={<LoadingOverlay />}>{children}</Suspense>
      </main>
    </div>
  );
}
