'use client';

import Link from 'next/link';
import { useState, useRef } from 'react';
import Logout from './Logout';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { usePathname } from 'next/navigation';
import { useUserProfile } from '../hooks/useUserProfile';
import { useSubscription } from '../hooks/useSubscription';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { user, authStatus } = useAuthenticator((context) => [
    context.user,
    context.authStatus,
  ]);
  const attributes = useUserProfile();
  const { hasPremiumAccess } = useSubscription(); //

  const displayName = attributes?.name || user?.username || 'Guest';
  const profilePic =
    attributes?.picture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0D8ABC&color=fff&rounded=true`;

  const baseLinkClass = 'text-gray-700 hover:text-blue-600';
  const activeLinkClass = 'font-semibold text-blue-600';

  return (
    <nav className='bg-white border-b border-gray-200'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center'>
        <Link href='/' className='text-gray-700 hover:text-blue-600 font-bold'>
          LeadManager
        </Link>

        <div className='hidden md:flex items-center space-x-4'>
          <Link
            href='/pricing'
            className={
              pathname === '/pricing' ? activeLinkClass : baseLinkClass
            }
          >
            Pricing
          </Link>
          <Link
            href='/services'
            className={
              pathname === '/services' ? activeLinkClass : baseLinkClass
            }
          >
            Services
          </Link>

          {authStatus === 'authenticated' && hasPremiumAccess && (
            <>
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
            </>
          )}

          {authStatus === 'authenticated' ? (
            <div ref={dropdownRef} className='relative'>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className='flex items-center space-x-2'
              >
                <img
                  src={profilePic}
                  className='w-8 h-8 rounded-full'
                  alt='Profile'
                />
                <span className='text-sm'>{displayName}</span>
              </button>
              {menuOpen && (
                <div className='absolute right-0 mt-2 w-48 bg-white shadow-lg py-1 z-50 border'>
                  <Link
                    href='/profile'
                    className='block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                  >
                    Profile
                  </Link>
                  <Logout />
                </div>
              )}
            </div>
          ) : (
            <Link href='/login' className={baseLinkClass}>
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
