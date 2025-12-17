// app/(protected)/layout.tsx

import { Suspense } from 'react';
import LoadingOverlay from '@/app/components/shared/LoadingOverlay';

/**
 * Protected Layout
 * This wraps all pages in the (protected) group.
 * The Suspense boundary here will catch the loading state of any
 * Server Component page beneath it.
 */
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className='min-h-screen bg-slate-50'>
      {/* If you have a shared Sidebar or Navbar for 
          protected pages, you would place it here. 
      */}

      <main>
        <Suspense fallback={<LoadingOverlay />}>{children}</Suspense>
      </main>
    </div>
  );
}
