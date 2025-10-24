// app/(protected)/upload/page.tsx
import { AuthGetCurrentUserServer } from '@/src/utils/amplifyServerUtils.server';
import UploadClient from './UploadClient';

export const dynamic = 'force-dynamic';

export default async function UploadPage() {
  const user = await AuthGetCurrentUserServer();
  // layout already redirects unauthenticated users, but double-check here
  if (!user) return null;

  return (
    <div className='p-6 max-w-lg mx-auto'>
      <h1 className='text-2xl font-bold mb-4'>
        Upload CSV File for {user.username}
      </h1>
      <UploadClient />
    </div>
  );
}
