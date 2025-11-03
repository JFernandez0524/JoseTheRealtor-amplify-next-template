'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import Logout from './Logout';
import { useAuthenticator, Loader } from '@aws-amplify/ui-react';
import { getFrontEndUserAttributes } from '@/app/utils/amplifyFrontEndUser'; // Ensure this path is correct
import { UserAttributeKey } from 'aws-amplify/auth';
// 1. Import usePathname
import { usePathname } from 'next/navigation';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [attributes, setAttributes] = useState<Partial<
    Record<UserAttributeKey, string>
  > | null>(null);

  // 2. Get the current path
  const pathname = usePathname();

  const { user, authStatus } = useAuthenticator((context) => [
    context.user,
    context.authStatus,
  ]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      async function fetchAttributes() {
        try {
          const attrs = await getFrontEndUserAttributes();
          setAttributes(attrs);
        } catch (e) {
          console.error('Navbar: Error fetching user attributes', e);
        }
      }
      fetchAttributes();
    } else {
      setAttributes(null);
    }
  }, [authStatus]);

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

  const displayName = attributes?.name || user?.username || 'Guest';
  const profilePic =
    attributes?.picture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName
    )}&background=0D8ABC&color=fff&rounded=true`;

  // 3. Define our link styles
  const baseLinkClass = 'text-gray-700 hover:text-blue-600';
  const activeLinkClass = 'nav-link-active'; // The class from globals.css

  return (
    <nav className='bg-white border-b border-gray-200'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center'>
        <Link href='/' className='text-gray-700 hover:text-blue-600 font-bold'>
          LeadManager
        </Link>

        <div className='flex items-center space-x-4 relative'>
          {/* --- Public Links (Always Show) --- */}
          {/* 4. Apply conditional classes */}
          <Link
            href='/services'
            className={
              pathname === '/services' ? activeLinkClass : baseLinkClass
            }
          >
            Services
          </Link>
          <Link
            href='/about'
            className={pathname === '/about' ? activeLinkClass : baseLinkClass}
          >
            About
          </Link>

          {/* --- Auth-Conditional Links --- */}
          {authStatus === 'configuring' ? (
            <div className='text-sm text-gray-500'>
              <Loader size='large' />
            </div>
          ) : authStatus === 'authenticated' ? (
            <>
              {/* --- Protected Links --- */}
              <Link
                href='/dashboard'
                className={
                  pathname === '/dashboard' ? activeLinkClass : baseLinkClass
                }
              >
                Dashboard
              </Link>
              <Link
                href='/upload'
                className={
                  pathname === '/upload' ? activeLinkClass : baseLinkClass
                }
              >
                Upload Leads
              </Link>

              {/* --- Profile Dropdown --- */}
              <div ref={dropdownRef} className='relative'>
                <button
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className='flex items-center space-x-2 focus:outline-none'
                >
                  <img
                    src={profilePic}
                    alt='Profile'
                    className='w-8 h-8 rounded-full'
                  />
                  <span className='text-gray-700 hidden sm:block'>
                    {displayName}
                  </span>
                  <svg
                    className='w-4 h-4 text-gray-500'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                    xmlns='http://www.w3.org/2000/svg'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M19 9l-7 7-7-7'
                    ></path>
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {menuOpen && (
                  <div className='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-100 z-50'>
                    <div className='px-4 py-2 text-sm font-medium text-gray-700 border-b'>
                      Signed in as
                      <br />
                      <strong className='truncate'>{displayName}</strong>
                    </div>
                    <Link
                      href='/profile'
                      className={`block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${
                        pathname === '/profile' ? 'bg-gray-100' : ''
                      }`}
                      onClick={() => setMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    <Logout />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* C: LOGGED-OUT (UNAUTHENTICATED) STATE */
            <Link
              href='/login'
              className={
                pathname === '/login' ? activeLinkClass : baseLinkClass
              }
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
