'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import Logout from './Logout';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useRouter } from 'next/navigation';
import { AuthUser } from 'aws-amplify/auth';
import { Loader } from '@aws-amplify/ui-react';
import { getFrontEndUser } from '../src/utils/amplifyFrontEndUser';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { user, authStatus, route } = useAuthenticator((context) => [
    context.user,
    context.authStatus,
    context.route,
  ]);

  if (authStatus === 'unauthenticated') {
    console.log('Not authenticated');
  } else if (authStatus === 'authenticated') {
    console.log(user);
  }

  // 2. Handle clicks outside the dropdown to close it
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

  // 3. Define user display info
  const displayName = user ? user.username : 'Guest';
  const profilePic = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    displayName
  )}&background=0D8ABC&color=fff&rounded=true`;

  // 4. Main return statement
  return (
    <nav className='bg-white border-b border-gray-200'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center'>
        {/* Left Side: Home Link */}
        <Link href='/' className='text-gray-700 hover:text-blue-600 font-bold'>
          LeadManager
        </Link>

        {/* Right Side: Auth Links */}
        <div className='flex items-center space-x-4 relative'>
          {/* Show loading state until we've checked for a user.
            This prevents a "flash" of the wrong content.
          */}
          {authStatus !== 'authenticated' ? (
            <div className='text-sm text-gray-500'>
              <Loader size='large' />
            </div>
          ) : authStatus ? (
            // User is LOGGED IN: Show dashboard and profile dropdown
            <>
              <Link
                href='/dashboard'
                className='text-gray-700 hover:text-blue-600'
              >
                Dashboard
              </Link>
              <Link
                href='/upload'
                className='text-gray-700 hover:text-blue-600'
              >
                Upload Leads
              </Link>

              {/* Profile Dropdown */}
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
                  {/* Chevron Icon */}
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
                      className='block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
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
            // User is LOGGED OUT: Show Login link
            <Link href='/login' className='text-gray-700 hover:text-blue-600'>
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
