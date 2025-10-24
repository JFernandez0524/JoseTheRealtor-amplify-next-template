'use client';

import { useState, FormEvent } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';

export default function UploadClient() {
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('');
    setPreview([]);
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);

      // ✅ Client-side version of fetchAuthSession
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
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setStatus(`✅ ${data.message}`);
      setPreview(data.preview || []);
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ ${err.message || 'Error uploading file'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='flex flex-col space-y-4'>
      <input type='file' name='file' accept='.csv' required />
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

      {status && <p className='mt-4'>{status}</p>}

      {preview.length > 0 && (
        <div className='mt-6'>
          <h2 className='text-lg font-semibold mb-2'>Preview:</h2>
          <pre className='bg-gray-100 p-2 rounded text-sm overflow-auto'>
            {JSON.stringify(preview, null, 2)}
          </pre>
        </div>
      )}
    </form>
  );
}
