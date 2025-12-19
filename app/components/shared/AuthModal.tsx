'use client';

import React from 'react';
import Link from 'next/link';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300'
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className='relative bg-white w-full max-w-lg rounded-[2.5rem] p-12 shadow-2xl animate-in zoom-in-95 duration-300'>
        <button
          onClick={onClose}
          className='absolute top-6 right-8 text-slate-400 hover:text-slate-600 transition-colors'
        >
          ✕
        </button>

        <div className='text-center'>
          <div className='inline-block bg-indigo-100 text-indigo-600 p-4 rounded-full mb-6 text-2xl'>
            🚀
          </div>

          <h2 className='text-3xl font-black text-slate-900 mb-4 tracking-tight leading-tight'>
            Stop Searching, <br /> Start Closing.
          </h2>

          <p className='text-slate-500 font-medium mb-8 leading-relaxed'>
            Join the inner circle of professionals using our **Skip Trace
            Engine** to pull verified owner data in seconds.
          </p>

          {/* Value Stack */}
          <div className='grid grid-cols-1 gap-4 mb-10 text-left'>
            <div className='flex items-start gap-3'>
              <span className='text-indigo-600 font-bold'>✓</span>
              <p className='text-sm text-slate-600'>
                **Instant Access**: Obtain home owner phone numbers and emails
                immediately.
              </p>
            </div>
            <div className='flex items-start gap-3'>
              <span className='text-indigo-600 font-bold'>✓</span>
              <p className='text-sm text-slate-600'>
                **Automated Outreach**: Sync leads directly into a full CRM
                workflow for automated prospecting.
              </p>
            </div>
            <div className='flex items-start gap-3'>
              <span className='text-indigo-600 font-bold'>✓</span>
              <p className='text-sm text-slate-600'>
                **Scale Faster**: Turn any property address into a verified,
                automated lead pipeline.
              </p>
            </div>
          </div>

          <div className='flex flex-col gap-3'>
            <Link
              href='/login'
              className='w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest py-6 rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95'
            >
              Unlock My Lead Pipeline
            </Link>
            <button
              onClick={onClose}
              className='w-full bg-slate-50 hover:bg-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest py-4 rounded-2xl transition-all'
            >
              Continue with limited access
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
