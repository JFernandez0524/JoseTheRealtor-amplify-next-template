'use client';

import React, { useState, useEffect } from 'react'; // Import useState and useEffect
import Link from 'next/link';
import { AuthUser } from 'aws-amplify/auth';
import { useFormFocus } from '@/app/context/FormFocusContext'; // Adjust path

// Define the props it will receive
interface HeroSectionProps {
  user: AuthUser | null;
}

export default function HeroSection({ user }: HeroSectionProps) {
  // 1. Get both states from the context
  const { isFormFocused, hasAnalysisRun } = useFormFocus();

  // 2. Add new state to manage the button's visibility
  const [showAuthButton, setShowAuthButton] = useState(false);

  // 3. Add an effect to watch for the analysis to run
  useEffect(() => {
    // Check if the analysis has run AND the button isn't already visible
    if (hasAnalysisRun && !showAuthButton) {
      // Start a 10-second timer
      const timer = setTimeout(() => {
        setShowAuthButton(true); // After 10s, set state to show the button
      }, 5000); // 10,000 milliseconds = 10 seconds

      // Cleanup: If the component unmounts, clear the timer
      return () => clearTimeout(timer);
    }
  }, [hasAnalysisRun, showAuthButton]); // This effect runs when hasAnalysisRun changes

  return (
    // This class hides the component on mobile when the form is focused
    <div
      className={`w-full max-w-2xl text-center ${isFormFocused ? 'hidden md:block' : ''}`}
    >
      <h1 className='text-4xl font-bold text-gray-900 mb-4'>
        🏡 Instant Property Analyzer
      </h1>

      <p className='mx-auto text-lg text-gray-600 mb-6 max-w-2xl text-center'>
        Find your next deal. Enter an address below for an instant investment
        analysis, Zestimate, and a potential 'as-is' cash offer.
      </p>

      {/* 4. 👇 Only render this block IF showAuthButton is true */}
      {showAuthButton && (
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
      )}
    </div>
  );
}
