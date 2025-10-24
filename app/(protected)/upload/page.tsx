'use client';

import { useState } from 'react';

export default function UploadLeadsPage() {
  const [mode, setMode] = useState<'csv' | 'manual'>('manual');
  const [file, setFile] = useState<File | null>(null);
  const [lead, setLead] = useState({
    type: '',
    address: '',
    firstName: '',
    lastName: '',
    city: '',
    state: '',
    zip: '',
    executorFirstName: '',
    executorLastName: '',
    mailingAddress: '',
    mailingCity: '',
    mailingState: '',
    mailingZip: '',
    borrowerFirstName: '',
    borrowerLastName: '',
    caseNumber: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setLead((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) setFile(e.target.files[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      let res;
      if (mode === 'csv') {
        if (!file) return alert('Please select a CSV file first.');
        const formData = new FormData();
        formData.append('file', file);
        res = await fetch('/api/v1/upload-csv', {
          method: 'POST',
          body: formData,
        });
      } else {
        const { type, address, city, state, zip } = lead;
        if (!type || !address || !city || !state || !zip) {
          alert('Missing required fields (type, address, city, state, zip)');
          setLoading(false);
          return;
        }

        res = await fetch('/api/v1/upload-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lead),
        });
      }

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setMessage(`✅ ${data.message}`);

      // Reset
      setLead({
        type: '',
        address: '',
        firstName: '',
        lastName: '',
        city: '',
        state: '',
        zip: '',
        executorFirstName: '',
        executorLastName: '',
        mailingAddress: '',
        mailingCity: '',
        mailingState: '',
        mailingZip: '',
        borrowerFirstName: '',
        borrowerLastName: '',
        caseNumber: '',
      });
      setFile(null);
    } catch (err) {
      console.error(err);
      setMessage('❌ Error uploading lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className='max-w-3xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md'>
      <h1 className='text-2xl font-semibold text-blue-600 mb-4'>
        Upload or Add Lead
      </h1>

      {/* Mode Toggle */}
      <div className='flex space-x-2 mb-6'>
        <button
          onClick={() => setMode('csv')}
          className={`px-4 py-2 rounded ${
            mode === 'csv'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Upload CSV
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`px-4 py-2 rounded ${
            mode === 'manual'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Add Manually
        </button>
      </div>

      {/* CSV Upload */}
      {mode === 'csv' && (
        <div className='space-y-3'>
          {/* Ask for Lead Type */}
          <label className='block text-sm font-medium text-gray-700'>
            Lead Type *
          </label>
          <select
            name='leadType'
            value={lead.type}
            onChange={handleChange}
            required
            className='border border-gray-300 rounded-md p-2 w-full'
          >
            <option value=''>Select Type</option>
            <option value='probate'>Probate</option>
            <option value='preforeclosure'>Pre-Foreclosure</option>
          </select>

          {/* CSV Upload Input */}
          <input
            type='file'
            accept='.csv'
            onChange={handleFileChange}
            className='border border-gray-300 rounded-md p-2 w-full'
          />

          <button
            onClick={async () => {
              if (!lead.type) return alert('Please select a lead type first.');
              if (!file) return alert('Please select a CSV file.');

              const formData = new FormData();
              formData.append('file', file);
              formData.append('type', lead.type); // 👈 send lead type along with file

              setLoading(true);
              const res = await fetch('/api/v1/upload-csv', {
                method: 'POST',
                body: formData,
              });
              const data = await res.json();
              setMessage(`✅ ${data.message}`);
              setLoading(false);
            }}
            disabled={loading}
            className='mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50'
          >
            {loading ? 'Uploading...' : 'Upload CSV'}
          </button>
        </div>
      )}

      {/* Manual Form */}
      {mode === 'manual' && (
        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Required fields */}
          <select
            name='type'
            value={lead.type}
            onChange={handleChange}
            required
            className='border border-gray-300 rounded-md p-2 w-full'
          >
            <option value=''>Select Lead Type *</option>
            <option value='probate'>Probate</option>
            <option value='preforeclosure'>Preforeclosure</option>
          </select>

          <input
            name='address'
            placeholder='Property Address *'
            value={lead.address}
            onChange={handleChange}
            className='border border-gray-300 rounded-md p-2 w-full'
            required
          />
          <div className='grid grid-cols-3 gap-2'>
            <input
              name='city'
              placeholder='City *'
              value={lead.city}
              onChange={handleChange}
              className='border border-gray-300 rounded-md p-2'
              required
            />
            <input
              name='state'
              placeholder='State *'
              value={lead.state}
              onChange={handleChange}
              className='border border-gray-300 rounded-md p-2'
              required
            />
            <input
              name='zip'
              placeholder='ZIP *'
              value={lead.zip}
              onChange={handleChange}
              className='border border-gray-300 rounded-md p-2'
              required
            />
          </div>

          {/* Conditional Fields */}
          {lead.type === 'probate' && (
            <>
              <h2 className='text-gray-700 font-medium mt-4'>
                Executor Information
              </h2>
              <div className='grid grid-cols-2 gap-2'>
                <input
                  name='executorFirstName'
                  placeholder='Executor First Name'
                  value={lead.executorFirstName}
                  onChange={handleChange}
                  className='border border-gray-300 rounded-md p-2'
                />
                <input
                  name='executorLastName'
                  placeholder='Executor Last Name'
                  value={lead.executorLastName}
                  onChange={handleChange}
                  className='border border-gray-300 rounded-md p-2'
                />
              </div>

              <h2 className='text-gray-700 font-medium mt-4'>
                Mailing Address
              </h2>
              <input
                name='mailingAddress'
                placeholder='Mailing Address'
                value={lead.mailingAddress}
                onChange={handleChange}
                className='border border-gray-300 rounded-md p-2 w-full'
              />
              <div className='grid grid-cols-3 gap-2'>
                <input
                  name='mailingCity'
                  placeholder='City'
                  value={lead.mailingCity}
                  onChange={handleChange}
                  className='border border-gray-300 rounded-md p-2'
                />
                <input
                  name='mailingState'
                  placeholder='State'
                  value={lead.mailingState}
                  onChange={handleChange}
                  className='border border-gray-300 rounded-md p-2'
                />
                <input
                  name='mailingZip'
                  placeholder='ZIP'
                  value={lead.mailingZip}
                  onChange={handleChange}
                  className='border border-gray-300 rounded-md p-2'
                />
              </div>
            </>
          )}

          {lead.type === 'preforeclosure' && (
            <>
              <h2 className='text-gray-700 font-medium mt-4'>
                Borrower Information
              </h2>
              <div className='grid grid-cols-2 gap-2'>
                <input
                  name='borrowerFirstName'
                  placeholder='Borrower First Name'
                  value={lead.borrowerFirstName}
                  onChange={handleChange}
                  className='border border-gray-300 rounded-md p-2'
                />
                <input
                  name='borrowerLastName'
                  placeholder='Borrower Last Name'
                  value={lead.borrowerLastName}
                  onChange={handleChange}
                  className='border border-gray-300 rounded-md p-2'
                />
              </div>

              <input
                name='caseNumber'
                placeholder='Case Number'
                value={lead.caseNumber}
                onChange={handleChange}
                className='border border-gray-300 rounded-md p-2 w-full'
              />
            </>
          )}

          <button
            type='submit'
            disabled={loading}
            className='mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50'
          >
            {loading ? 'Saving...' : 'Add Lead'}
          </button>
        </form>
      )}

      {message && <p className='mt-4 text-sm'>{message}</p>}
    </main>
  );
}
