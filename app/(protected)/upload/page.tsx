// app/(protected)/upload/page.tsx
import { ManualLeadForm } from '@/app/components/upload/ManualLeadForm';
import { NotificationCenter } from '@/app/components/upload/NotificationCenter';

export default function UploadLeadsPage() {
  return (
    <main className='max-w-4xl mx-auto mt-10 p-6 space-y-8'>
      <div className='flex justify-between items-center'>
        <h1 className='text-2xl font-semibold text-blue-600'>
          Lead Management
        </h1>
        <NotificationCenter />
      </div>

      <div className='bg-white rounded-lg shadow-md p-6'>
        <ManualLeadForm />
      </div>
    </main>
  );
}
