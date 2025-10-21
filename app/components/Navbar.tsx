'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{
    username?: string;
    userId?: string;
  } | null>(null);

  // ✅ Load current user after render
  useEffect(() => {
    async function fetchUser() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch {
        setUser(null); // not signed in
      }
    }
    fetchUser();
  }, []);

  const linkClass = (path: string) =>
    `px-4 py-2 rounded-md text-sm font-medium transition ${
      pathname === path
        ? 'bg-blue-600 text-white'
        : 'text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <nav className='w-full bg-white shadow-sm border-b border-gray-200'>
      <div className='max-w-6xl mx-auto px-4 py-3 flex items-center justify-between'>
        <h1 className='text-lg font-semibold text-blue-600'>
          <Link href='/'>LeadManager</Link>
        </h1>

        <div className='flex space-x-2 items-center'>
          <Link href='/' className={linkClass('/')}>
            Home
          </Link>
          {/* if user don't show login link  */}
          {!user && (
            <Link href='/login' className={linkClass('/login')}>
              Login
            </Link>
          )}

          {/* ✅ Show private links only if signed in */}
          {user && (
            <>
              <Link href='/dashboard' className={linkClass('/dashboard')}>
                Dashboard
              </Link>
              <Link href='/upload' className={linkClass('/upload')}>
                Upload Leads
              </Link>
              <Link href='/settings' className={linkClass('/settings')}>
                Settings
              </Link>
              <button
                onClick={async () => {
                  await signOut();
                  window.location.href = '/login';
                }}
                className='ml-3 px-3 py-1 bg-red-500 text-white rounded-md text-sm hover:bg-red-600'
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
