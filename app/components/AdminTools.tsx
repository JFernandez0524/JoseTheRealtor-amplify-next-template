'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'aws-amplify/auth'; // Import directly for the logic
import { client } from '@/app/utils/aws/data/frontEndClient';
import { HiOutlineShieldCheck } from 'react-icons/hi2';

export default function AdminTools({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const promoteToAdmin = async () => {
    const confirmAction = confirm(
      'This will promote you to Admin and sign you out to refresh your security permissions. Proceed?'
    );
    if (!confirmAction) return;

    setLoading(true);
    try {
      const { errors } = await client.mutations.addUserToGroup({
        userId,
        groupName: 'ADMINS',
      });

      if (errors) {
        alert(`Promotion failed: ${errors[0].message}`);
      } else {
        // 🛡️ Success Path
        alert('Success! You are now an Admin. Signing out now...');

        // Clear the session and redirect
        await signOut();
        router.push('/login');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={promoteToAdmin}
      disabled={loading}
      className='flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed'
    >
      <HiOutlineShieldCheck className='text-lg' />
      {loading ? 'Promoting...' : 'Promote Me to Admin'}
    </button>
  );
}
