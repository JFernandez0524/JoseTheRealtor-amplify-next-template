'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AuthUser } from 'aws-amplify/auth';
import { useFormFocus } from '@/app/context/FormFocusContext';

interface HeroSectionProps {
  user: AuthUser | null;
}

export default function HeroSection({ user }: HeroSectionProps) {
  const { isFormFocused, hasAnalysisRun } = useFormFocus();
  const [showAuthButton, setShowAuthButton] = useState(false);

  useEffect(() => {
    if (hasAnalysisRun && !showAuthButton) {
      const timer = setTimeout(() => {
        setShowAuthButton(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [hasAnalysisRun, showAuthButton]);

  return (
    <div
      className={`w-full max-w-2xl text-center transition-all duration-500 ${
        isFormFocused
          ? 'opacity-20 md:opacity-100 scale-95 md:scale-100'
          : 'opacity-100'
      } ${isFormFocused ? 'hidden md:block' : ''}`}
    >
      <h1 className='text-5xl font-black text-slate-900 mb-6 tracking-tight'>
        🏡 Instant Property Analyzer
      </h1>

      <p className='mx-auto text-xl text-slate-500 mb-6 max-w-xl leading-relaxed font-medium'>
        Find your next deal. Enter an address below for an instant investment
        analysis, Zestimate, and a potential 'as-is' cash offer.
      </p>

      {/* 🚀 DYNAMIC SPACE: Only grows when the button is ready */}
      <div
        className={`transition-all duration-700 ease-in-out overflow-hidden ${
          showAuthButton
            ? 'max-h-40 mb-10 opacity-100'
            : 'max-h-0 mb-0 opacity-0'
        }`}
      >
        <div className='pt-4'>
          {!user ? (
            <Link
              href='/login'
              className='inline-block w-full bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-5 rounded-2xl shadow-2xl transition-all hover:scale-[1.02] active:scale-95'
            >
              <div className='flex flex-col items-center'>
                <span className='text-lg font-black uppercase tracking-widest'>
                  Unlock Hidden Owner Data
                </span>
                <span className='text-[10px] font-bold opacity-80 uppercase mt-1 tracking-tighter'>
                  Get Names, Verified Phones, and Direct CRM Access
                </span>
              </div>
            </Link>
          ) : (
            <Link
              href='/dashboard'
              className='inline-block w-full bg-slate-900 hover:bg-slate-800 text-white px-8 py-5 rounded-2xl shadow-2xl text-lg font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95'
            >
              Access My Lead Pipeline
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
