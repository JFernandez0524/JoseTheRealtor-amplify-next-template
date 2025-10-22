'use client';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { fetchUserAttributes } from 'aws-amplify/auth';
import type { CognitoUserAttributes } from '@/src/types/auth';
import { useEffect, useState } from 'react';

export default function ProfilePage() {
  const [attributes, setAttributes] = useState<CognitoUserAttributes | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const { user } = useAuthenticator((context) => [context.user]);
  console.log(user);
  if (!user) return;
  useEffect(() => {
    async function fetchAttributes() {
      try {
        const attrs = await fetchUserAttributes();
        setAttributes(attrs as CognitoUserAttributes);
        console.log(attrs);
      } catch (error) {
        console.error('Error fetching user attributes:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAttributes();
  }, []);

  if (loading) {
    return (
      <div className='flex justify-center items-center h-screen text-gray-500'>
        Loading profile...
      </div>
    );
  }

  if (!attributes) {
    return (
      <div className='flex justify-center items-center h-screen text-red-600'>
        Unable to load profile information.
      </div>
    );
  }

  const profileImage =
    attributes.picture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      attributes.fullname || attributes.email || 'User'
    )}&background=0D8ABC&color=fff`;

  return (
    <div className='p-6 flex justify-center'>
      <div className='bg-white shadow-lg rounded-lg p-6 w-full max-w-md'>
        <div className='flex flex-col items-center'>
          <img
            src={profileImage}
            alt='Profile'
            className='w-20 h-20 rounded-full border mb-4'
          />
          <h1 className='text-2xl font-semibold mb-2'>My Profile</h1>

          <div className='text-gray-700 text-sm space-y-2 w-full text-center'>
            <p>
              <strong>Name:</strong> {attributes.fullname || '—'}
            </p>
            <p>
              <strong>Email:</strong> {attributes.email || '—'}
            </p>
            <p>
              <strong>Username:</strong>{' '}
              {attributes.preferredUsername || attributes.sub || '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
