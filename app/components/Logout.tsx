// components/Logout.tsx

'use client';

import { signOut } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';

export default function Logout() {
  const router = useRouter();

  return (
    <button
      className='px-2 bg-red-500 text-white rounded-md'
      onClick={async () => {
        await signOut();
        router.push('/login');
      }}
    >
      Sign out
    </button>
  );
}
