import React from 'react';
import Link from 'next/link';

export default function PricingPage() {
  return (
    <div className='bg-white py-24 sm:py-32'>
      <div className='mx-auto max-w-7xl px-6 lg:px-8 text-center'>
        <h2 className='text-base font-semibold leading-7 text-blue-600 uppercase tracking-wide'>
          Simple Pricing
        </h2>
        <p className='mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl'>
          Get the Data You Need to Close Deals
        </p>
        <p className='mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600'>
          Professional-grade skip tracing for real estate investors. No hidden
          fees, just accurate data.
        </p>

        <div className='mt-16 flex justify-center'>
          <div className='relative rounded-2xl border border-gray-200 p-8 shadow-sm flex flex-col items-center max-w-sm w-full'>
            <h3 className='text-xl font-semibold leading-7 text-gray-900'>
              Pay As You Go
            </h3>
            <p className='mt-4 flex items-baseline gap-x-2'>
              <span className='text-5xl font-bold tracking-tight text-gray-900'>
                $0.09
              </span>
              <span className='text-sm font-semibold leading-6 text-gray-600'>
                per lead
              </span>
            </p>
            <ul className='mt-8 space-y-3 text-sm leading-6 text-gray-600 text-left w-full'>
              <li className='flex gap-x-3'>
                <span className='text-green-500'>✓</span> Up to 8 Phone Numbers
                per Match
              </li>
              <li className='flex gap-x-3'>
                <span className='text-green-500'>✓</span> Validated Email
                Addresses
              </li>
              <li className='flex gap-x-3'>
                <span className='text-green-500'>✓</span> Bankruptcy & Deceased
                Check
              </li>
              <li className='flex gap-x-3'>
                <span className='text-green-500'>✓</span> Litigator Scrubbing
              </li>
            </ul>
            <Link
              href='/dashboard'
              className='mt-8 block w-full rounded-md bg-blue-600 px-3.5 py-2 text-center text-sm font-semibold text-white app/hooksshadow-sm hover:bg-blue-500 transition'
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
