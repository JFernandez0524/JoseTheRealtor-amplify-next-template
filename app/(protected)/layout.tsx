// app/(protected)/layout.tsx
import { AuthGetCurrentUserServer } from '@/src/utils/amplifyServerUtils.server';
import { redirect } from 'next/navigation';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await AuthGetCurrentUserServer();
  if (!user) redirect('/api/auth/sign-in');
  return <>{children}</>;
}
