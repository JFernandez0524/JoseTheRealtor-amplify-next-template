//components/Logout
'use client';

export default function Logout() {
  return (
    <a
      className='w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-100'
      href='/api/auth/sign-out'
    >
      Sign Out
    </a>
  );
}
