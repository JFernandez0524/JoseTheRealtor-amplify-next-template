'use client';
import { useAuthenticator } from '@aws-amplify/ui-react';

export default function ProfilePage() {
  const { user } = useAuthenticator((context) => [context.user]);

  return (
    <div className='max-w-2xl mx-auto mt-10'>
      <h1 className='text-2xl font-semibold mb-4'>My Profile</h1>
      <div className='bg-white shadow rounded-lg p-4'>
        <p>
          <strong>Username:</strong> {user?.username}
        </p>
        <p>
          <strong>Email:</strong> {}
        </p>
      </div>
    </div>
  );
}
