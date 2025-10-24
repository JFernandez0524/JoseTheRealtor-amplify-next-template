//components/Logout
'use client';

import { useRouter } from 'next/navigation';

export default function Logout() {
  const router = useRouter();

  const handleSignOut = () => {
    router.push('/api/auth/sign-out');
  };

  return (
    <button
      onClick={handleSignOut}
      className='w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-100'
    >
      Sign Out
    </button>
  );
}
