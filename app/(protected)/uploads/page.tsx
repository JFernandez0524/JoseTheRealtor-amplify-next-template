// app/(protected)/uploads/page.tsx
import { UploadHistoryClient } from '@/app/components/upload/UploadHistoryClient';

export default function UploadHistoryPage() {
  return (
    <main className='max-w-5xl mx-auto mt-10 p-6 space-y-8'>
      <div className='flex justify-between items-center'>
        <h1 className='text-2xl font-semibold text-blue-600'>Upload History</h1>
        <a
          href='/upload'
          className='text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors'
        >
          New Upload
        </a>
      </div>

      <div className='bg-white rounded-lg shadow-md p-6'>
        <UploadHistoryClient />
      </div>
    </main>
  );
}
