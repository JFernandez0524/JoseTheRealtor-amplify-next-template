'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import Logout from './Logout';
import { useAuthenticator, Loader } from '@aws-amplify/ui-react';
import { getFrontEndUserAttributes } from '@/app/utils/amplifyFrontEndUser'; // Ensure this path is correct
import { UserAttributeKey } from 'aws-amplify/auth';
import { usePathname } from 'next/navigation';

// --- Icon Helper Components ---

const HamburgerIcon = () => (
  <svg
    className='w-6 h-6'
    fill='none'
    stroke='currentColor'
    viewBox='0 0 24 24'
    xmlns='http://www.w3.org/2000/svg'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M4 6h16M4 12h16m-7 6h7'
    />
  </svg>
);

const CloseIcon = () => (
  <svg
    className='w-6 h-6'
    fill='none'
    stroke='currentColor'
    viewBox='0 0 24 24'
    xmlns='http://www.w3.org/2000/svg'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M6 18L18 6M6 6l12 12'
    />
  </svg>
);

// --- Navbar Component ---

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false); // For desktop profile dropdown
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // For mobile overlay
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [attributes, setAttributes] = useState<Partial<
    Record<UserAttributeKey, string>
  > | null>(null);

  const pathname = usePathname();

  const { user, authStatus } = useAuthenticator((context) => [
    context.user,
    context.authStatus,
  ]);

  // Fetch attributes when authenticated
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

  // Close desktop dropdown on click outside
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

  // Define user display info
  const displayName = attributes?.name || user?.username || 'Guest';
  const profilePic =
    attributes?.picture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName
    )}&background=0D8ABC&color=fff&rounded=true`;

  // Define link styles
  const baseLinkClass = 'text-gray-700 hover:text-blue-600';
  const activeLinkClass = 'nav-link-active font-semibold text-blue-600'; // Added 'nav-link-active' for your CSS

  // Helper to close menus on link click
  const handleLinkClick = () => {
    setMenuOpen(false);
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className='bg-white border-b border-gray-200'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center'>
        {/* Left Side: Home Link (Always visible) */}
        <Link href='/' className='text-gray-700 hover:text-blue-600 font-bold'>
          LeadManager
        </Link>

        {/* --- 1. DESKTOP MENU (Hidden on mobile) --- */}
        <div className='hidden md:flex items-center space-x-4 relative'>
          {/* Public Links */}
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

          {/* Auth-Conditional Links */}
          {authStatus === 'configuring' ? (
            <Loader size='large' />
          ) : authStatus === 'authenticated' ? (
            <>
              {/* Protected Links */}
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
                  {/* ... (chevron) ... */}
                </button>

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
                      onClick={handleLinkClick} // Close on click
                    >
                      Profile
                    </Link>
                    <Logout />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* C: LOGGED-OUT STATE */
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

        {/* --- 2. MOBILE MENU BUTTON (Hidden on desktop) --- */}
        <div className='md:hidden flex items-center space-x-2'>
          {/* Show profile pic next to hamburger when logged in */}
          {authStatus === 'authenticated' && (
            <img
              src={profilePic}
              alt='Profile'
              className='w-8 h-8 rounded-full'
            />
          )}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className='text-gray-700 focus:outline-none'
            aria-label='Open menu'
          >
            <HamburgerIcon />
          </button>
        </div>
      </div>

      {/* --- 3. MOBILE MENU OVERLAY --- */}
      {isMobileMenuOpen && (
        <div className='fixed inset-0 z-50 bg-white flex flex-col md:hidden'>
          {/* Mobile Menu Header */}
          <div className='flex justify-between items-center h-16 px-4 border-b border-gray-200'>
            <span className='text-gray-700 font-bold text-lg'>Menu</span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className='text-gray-700 focus:outline-none'
              aria-label='Close menu'
            >
              <CloseIcon />
            </button>
          </div>

          {/* Mobile Menu Links */}
          <div className='flex flex-col p-4 space-y-4'>
            {/* --- Public Links --- */}
            <Link
              href='/'
              className={`text-lg ${pathname === '/' ? activeLinkClass : baseLinkClass}`}
              onClick={handleLinkClick}
            >
              Home
            </Link>
            <Link
              href='/services'
              className={`text-lg ${pathname === '/services' ? activeLinkClass : baseLinkClass}`}
              onClick={handleLinkClick}
            >
              Services
            </Link>
            <Link
              href='/about'
              className={`text-lg ${pathname === '/about' ? activeLinkClass : baseLinkClass}`}
              onClick={handleLinkClick}
            >
              About
            </Link>

            <hr />

            {/* --- Auth-Conditional Links --- */}
            {authStatus === 'authenticated' ? (
              <>
                <Link
                  href='/dashboard'
                  className={`text-lg ${pathname === '/dashboard' ? activeLinkClass : baseLinkClass}`}
                  onClick={handleLinkClick}
                >
                  Dashboard
                </Link>
                <Link
                  href='/upload'
                  className={`text-lg ${pathname === '/upload' ? activeLinkClass : baseLinkClass}`}
                  onClick={handleLinkClick}
                >
                  Upload Leads
                </Link>
                <Link
                  href='/profile'
                  className={`text-lg ${pathname === '/profile' ? activeLinkClass : baseLinkClass}`}
                  onClick={handleLinkClick}
                >
                  Profile
                </Link>
                <div className='pt-4'>
                  <Logout />
                </div>
              </>
            ) : (
              <Link
                href='/login'
                className={`text-lg ${pathname === '/login' ? activeLinkClass : baseLinkClass}`}
                onClick={handleLinkClick}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
