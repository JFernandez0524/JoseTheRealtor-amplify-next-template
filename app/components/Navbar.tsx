'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthenticator } from '@aws-amplify/ui-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuthenticator((context) => [context.user]);

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

          {!user && (
            <Link href='/auth/login' className={linkClass('/auth/login')}>
              Login
            </Link>
          )}

          {user && (
            <>
              <Link href='/dashboard' className={linkClass('/dashboard')}>
                Dashboard
              </Link>
              <Link href='/upload' className={linkClass('/upload')}>
                Upload Leads
              </Link>

              <button
                onClick={() => {
                  signOut();
                  router.push('/auth/login');
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
