'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import Logout from './Logout';
import { usePathname } from 'next/navigation';
import { useAccess } from '../context/AccessContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { HiMenu, HiX } from 'react-icons/hi';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  /** * 🛡️ CONSOLIDATED ACCESS HOOK
   * Now includes isLoading to prevent UI flickering during session checks
   */
  const { hasPaidPlan, isAdmin, isLoading } = useAccess();

  /** * 👤 PROFILE DATA
   * We keep useUserProfile for the 'picture' and 'name' attributes
   */
  const attributes = useUserProfile();

  // 1. Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // 2. Click Outside Dropdown Handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 3. Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const displayName = attributes?.name || 'User';
  const profilePic =
    attributes?.picture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0D8ABC&color=fff&rounded=true`;

  const baseLinkClass =
    'text-gray-700 hover:text-blue-600 transition-colors duration-200';
  const activeLinkClass =
    'font-bold text-blue-600 transition-colors duration-200';

  const mobileLinkClass =
    'text-2xl font-semibold text-gray-800 hover:text-blue-600 py-4 border-b border-gray-50 w-full text-center';
  const mobileActiveLinkClass =
    'text-2xl font-bold text-blue-600 py-4 border-b border-gray-50 w-full text-center';

  // 🔒 AUTH GUARD HELPER
  // If isLoading is true, we don't show auth-dependent items yet to prevent "jumping" UI
  const isAuthenticated = !isLoading && attributes?.email;

  return (
    <nav className='bg-white border-b border-gray-200 sticky top-0 z-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center'>
        <Link
          href='/'
          className='text-gray-900 hover:text-blue-600 font-black text-xl tracking-tight z-[60]'
        >
          LeadManager
        </Link>

        {/* --- DESKTOP NAV --- */}
        <div className='hidden md:flex items-center space-x-6'>
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
          <Link
            href='/contact'
            className={
              pathname === '/contact' ? activeLinkClass : baseLinkClass
            }
          >
            Contact
          </Link>

          {isAuthenticated && (
            <>
              {hasPaidPlan && (
                <>
                  <Link
                    href='/dashboard'
                    className={
                      pathname === '/dashboard'
                        ? activeLinkClass
                        : baseLinkClass
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
                  <Link
                    href='/docs'
                    className={
                      pathname === '/docs' ? activeLinkClass : baseLinkClass
                    }
                  >
                    User Guide
                  </Link>
                </>
              )}
              {isAdmin && (
                <Link
                  href='/admin'
                  className='text-red-600 hover:text-red-700 font-bold bg-red-50 px-3 py-1 rounded-lg border border-red-100'
                >
                  Admin
                </Link>
              )}
            </>
          )}

          {isAuthenticated ? (
            <div ref={dropdownRef} className='relative ml-4'>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className='flex items-center space-x-2 focus:outline-none'
              >
                <img
                  src={profilePic}
                  className='w-8 h-8 rounded-full border border-gray-200'
                  alt='Profile'
                />
                <span className='text-sm font-medium text-gray-700'>
                  {displayName}
                </span>
              </button>
              {menuOpen && (
                <div className='absolute right-0 mt-2 w-48 bg-white shadow-xl rounded-xl py-2 z-50 border border-gray-100'>
                  <Link
                    href='/profile'
                    className='block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50'
                    onClick={() => setMenuOpen(false)}
                  >
                    Profile Settings
                  </Link>
                  <Logout />
                </div>
              )}
            </div>
          ) : (
            !isLoading && (
              <Link
                href='/login'
                className='bg-blue-600 text-white px-5 py-2 rounded-lg font-bold text-sm'
              >
                Sign In
              </Link>
            )
          )}
        </div>

        {/* --- MOBILE TOGGLE --- */}
        <div className='flex md:hidden items-center space-x-4 z-[60]'>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className='text-gray-600 text-3xl p-2'
          >
            {isMobileMenuOpen ? <HiX /> : <HiMenu />}
          </button>
        </div>
      </div>

      {/* --- MOBILE OVERLAY --- */}
      <div
        className={`fixed inset-0 bg-white z-[55] flex flex-col items-center justify-center px-6 transition-transform duration-300 md:hidden ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className='flex flex-col items-center w-full max-w-sm space-y-2'>
          <Link
            href='/pricing'
            className={
              pathname === '/pricing' ? mobileActiveLinkClass : mobileLinkClass
            }
          >
            Pricing
          </Link>
          <Link
            href='/services'
            className={
              pathname === '/services' ? mobileActiveLinkClass : mobileLinkClass
            }
          >
            Services
          </Link>
          <Link
            href='/contact'
            className={
              pathname === '/contact' ? mobileActiveLinkClass : mobileLinkClass
            }
          >
            Contact
          </Link>

          {isAuthenticated && (
            <>
              {hasPaidPlan && (
                <>
                  <Link
                    href='/dashboard'
                    className={
                      pathname === '/dashboard'
                        ? mobileActiveLinkClass
                        : mobileLinkClass
                    }
                  >
                    Dashboard
                  </Link>
                  <Link
                    href='/upload'
                    className={
                      pathname === '/upload'
                        ? mobileActiveLinkClass
                        : mobileLinkClass
                    }
                  >
                    Upload Leads
                  </Link>
                  <Link
                    href='/docs'
                    className={
                      pathname === '/docs'
                        ? mobileActiveLinkClass
                        : mobileLinkClass
                    }
                  >
                    User Guide
                  </Link>
                </>
              )}
              {isAdmin && (
                <Link
                  href='/admin'
                  className='text-red-600 font-bold py-4 text-2xl w-full text-center border-b border-gray-50'
                >
                  Admin Panel
                </Link>
              )}
              <Link
                href='/profile'
                className='text-gray-700 py-4 text-2xl w-full text-center border-b border-gray-50'
              >
                Profile Settings
              </Link>
              <div className='w-full pt-6 flex justify-center'>
                <Logout />
              </div>
            </>
          )}
          {!isAuthenticated && !isLoading && (
            <Link
              href='/login'
              className='mt-8 bg-blue-600 text-white w-full py-5 rounded-2xl font-bold text-xl text-center shadow-lg'
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
