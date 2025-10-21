'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/src/lib/useAuthSession';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { status } = useAuthSession();

  // 🚪 Redirect to login if not signed in
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // 💡 While checking session
  if (status === 'loading') {
    return (
      <div className='flex items-center justify-center min-h-screen bg-gray-50'>
        <div className='animate-pulse text-gray-500 text-lg'>
          Loading session...
        </div>
      </div>
    );
  }

  // ⛔ Avoid flicker during redirect
  if (status === 'unauthenticated') return null;

  // ✅ Authenticated → render page content (no Navbar here)
  return <>{children}</>;
}
