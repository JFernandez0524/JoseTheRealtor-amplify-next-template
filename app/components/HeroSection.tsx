'use client'; // This is still a client component to use Link

import React from 'react';
import Link from 'next/link';
import { AuthUser } from 'aws-amplify/auth'; // Import the AuthUser type

// 1. Define the props it will receive
interface HeroSectionProps {
  user: AuthUser | null;
}

// 2. Receive 'user' as a prop
export default function HeroSection({ user }: HeroSectionProps) {
  // 3. All useEffect and useState logic is GONE!

  return (
    <div className='w-full max-w-2xl text-center'>
      <h1 className='text-4xl font-bold text-gray-900 mb-4'>
        🏡 JoseTheRealtor Lead Platform
      </h1>
      <p className='mx-auto text-lg text-gray-600 mb-6 max-w-2xl text-center'>
        Upload your Probate or Pre-Foreclosure CSVs, validate addresses and
        manage your leads in one dashboard. Perfect for real estate
        professionals.
      </p>

      {/* 4. Render the button based on the 'user' prop */}
      <div className='mt-8'>
        {!user ? (
          <Link
            href='/login'
            className='bg-blue-500 text-white p-4 rounded shadow text-center'
          >
            Log In to Manage Leads
          </Link>
        ) : (
          <Link
            href='/dashboard'
            className='bg-blue-500 text-white p-4 rounded shadow text-center'
          >
            View Dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
