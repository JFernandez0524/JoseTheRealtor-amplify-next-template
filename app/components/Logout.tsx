// components/Logout.tsx

'use client';

import { signOut } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';

export default function Logout() {
  const router = useRouter();

  return (
    <button
      className='block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors'
      onClick={async () => {
        try {
          await signOut();
          router.push('/');
        } catch (error) {
          console.log('error signing out: ', error);
        }
      }}
    >
      Sign Out
    </button>
  );
}
