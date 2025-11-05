import Link from 'next/link';

export default function SignUpCTA() {
  return (
    <div className='mt-6 p-4 bg-green-100 border border-green-300 rounded-lg text-center'>
      <h4 className='font-bold text-green-800'>Like this analysis?</h4>
      <p className='text-green-700'>
        Sign up for a free account to save properties and manage your leads.
      </p>
      <Link
        href='/login' // Your /login page handles both login and sign-up
        className='inline-block mt-2 bg-green-600 text-white px-5 py-2 rounded-md shadow-sm hover:bg-green-700'
      >
        Sign Up for Free
      </Link>
    </div>
  );
}
