'use client';

import { useState, FormEvent } from 'react';

export default function UploadPage() {
  const [status, setStatus] = useState<string>('');
  const [preview, setPreview] = useState<any[]>([]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    setStatus('Uploading...');

    try {
      const res = await fetch('/api/upload-csv', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        setStatus(`Error: ${errorData.error || 'Upload failed'}`);
        return;
      }

      const data = await res.json();
      setStatus(`✅ ${data.message}`);
      setPreview(data.preview || []);
    } catch (err) {
      console.error('Upload error:', err);
      setStatus('❌ Error uploading file');
    }
  };

  return (
    <div className='p-6 max-w-lg mx-auto'>
      <h1 className='text-2xl font-bold mb-4'>Upload CSV File</h1>

      <form onSubmit={handleSubmit}>
        <input
          type='file'
          name='file'
          accept='.csv'
          required
          className='block mb-4'
        />
        <button
          type='submit'
          className='bg-blue-600 text-white px-4 py-2 rounded'
        >
          Upload
        </button>
      </form>

      <p className='mt-4'>{status}</p>

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
