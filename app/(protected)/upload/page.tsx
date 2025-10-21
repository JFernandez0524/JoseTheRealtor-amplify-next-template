'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
  const { user } = useAuthenticator((context) => [context.user]);
  const router = useRouter();

  const [status, setStatus] = useState<string>('');
  const [preview, setPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 🧭 Redirect if no user (extra safety, though layout already protects)
  useEffect(() => {
    if (!user) router.push('/auth/login');
  }, [user, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('');
    setPreview([]);
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);

      // ✅ Get current session token for authenticated requests
      const { tokens } = await fetchAuthSession();
      const idToken = tokens?.idToken?.toString();

      const res = await fetch('/api/v1/upload-csv', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(`❌ ${data.error || 'Upload failed'}`);
      } else {
        setStatus(`✅ ${data.message}`);
        setPreview(data.preview || []);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setStatus('❌ Error uploading file');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className='flex items-center justify-center min-h-screen text-gray-500'>
        Checking authentication...
      </div>
    );
  }

  return (
    <div className='p-6 max-w-lg mx-auto'>
      <h1 className='text-2xl font-bold mb-4'>
        Upload CSV File for {user?.username}
      </h1>

      <form onSubmit={handleSubmit} className='flex flex-col space-y-4'>
        <input
          type='file'
          name='file'
          accept='.csv'
          required
          className='block'
        />
        <button
          type='submit'
          disabled={loading}
          className={`px-4 py-2 rounded text-white ${
            loading
              ? 'bg-blue-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      {status && <p className='mt-4'>{status}</p>}

      {preview.length > 0 && (
        <div className='mt-6'>
          <h2 className='text-lg font-semibold mb-2'>Preview:</h2>
          <pre className='bg-gray-100 p-2 rounded text-sm overflow-auto'>
            {JSON.stringify(preview, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
