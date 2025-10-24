'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import Logout from '../components/Logout';

interface NavbarProps {
  user?: {
    username?: string;
  } | null;
}

export default function Navbar({ user }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const displayName = user?.username ?? 'Guest';
  const profilePic = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    displayName
  )}&background=0D8ABC&color=fff`;

  return (
    <nav className='w-full bg-white shadow-sm border-b border-gray-200'>
      <div className='max-w-6xl mx-auto px-4 py-3 flex items-center justify-between'>
        <h1 className='text-lg font-semibold text-blue-600'>
          <Link href='/'>LeadManager</Link>
        </h1>

        <div className='flex items-center space-x-3 relative'>
          <Link href='/' className='text-gray-700 hover:text-blue-600'>
            Home
          </Link>

          {!user && (
            <Link
              href='/api/auth/sign-in?provider=Google'
              className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
            >
              Login
            </Link>
          )}

          {user && (
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

              <div ref={dropdownRef} className='relative'>
                <button
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className='flex items-center space-x-2 focus:outline-none'
                >
                  <img
                    src={profilePic}
                    alt={displayName}
                    className='w-8 h-8 rounded-full border border-gray-300'
                  />
                </button>

                {menuOpen && (
                  <div className='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-100 z-50'>
                    <div className='px-4 py-2 text-sm font-medium text-gray-700 border-b'>
                      {displayName}
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
          )}
        </div>
      </div>
    </nav>
  );
}
