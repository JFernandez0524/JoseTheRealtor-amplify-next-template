'use client';

import '@aws-amplify/ui-react/styles.css';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className='flex flex-col items-center justify-center min-h-screen bg-gray-50 px-6 py-12'>
      <div>
        <h1 className='text-4xl font-bold text-gray-900 mb-4'>
          🏡 JoseTheRealtor Lead Platform
        </h1>
        <p className='mx-auto text-lg text-gray-600 mb-6 max-w-2xl text-center'>
          Upload your Probate or Pre-Foreclosure CSVs, validate addresses and
          manage your leads in one dashboard. Perfect for real estate
          professionals.
        </p>
        <div className='bg-blue-500 text-white p-4 rounded shadow text-center'>
          <button className='text-white'>
            <Link href='/login'>Log In </Link>
          </button>{' '}
        </div>
      </div>

      <footer className='mt-12 text-sm text-gray-500'>
        © {new Date().getFullYear()} JoseTheRealtor.com
      </footer>
    </main>
  );
}
