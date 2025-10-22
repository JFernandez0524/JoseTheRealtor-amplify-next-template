'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useState, useEffect, useRef } from 'react';
import type { CognitoUserAttributes } from '@/src/types/auth';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, route } = useAuthenticator((context) => [
    context.user,
    context.route,
  ]);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ✅ Safely cast attributes
  const attrs = (user as any)?.attributes as CognitoUserAttributes | undefined;

  const displayName =
    attrs?.name || attrs?.email?.split('@')[0] || user?.username || 'User';

  const profilePic =
    attrs?.picture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName
    )}&background=0D8ABC&color=fff`;

  // ✅ Auto-close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

        <div className='flex items-center space-x-3 relative'>
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

              {/* Avatar Dropdown */}
              <div ref={dropdownRef} className='relative'>
                <button
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className='flex items-center space-x-2 focus:outline-none'
                  aria-label='User menu'
                >
                  <img
                    src={profilePic}
                    alt={`${displayName} avatar`}
                    className='w-8 h-8 rounded-full border border-gray-300'
                  />
                </button>

                {menuOpen && (
                  <div className='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-100 z-50'>
                    <div className='px-4 py-2 text-sm text-gray-700 border-b font-medium'>
                      {displayName}
                    </div>
                    <div className='px-4 py-1 text-xs text-gray-500 border-b truncate'>
                      {attrs?.email || user?.username}
                    </div>
                    <Link
                      href='/profile'
                      className='block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                      onClick={() => setMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    <button
                      onClick={async () => {
                        await signOut();
                        router.push('/auth/login');
                      }}
                      className='w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100'
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
