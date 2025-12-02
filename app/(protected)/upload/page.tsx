'use client';

import { useState, useRef } from 'react';
import { Loader, Alert } from '@aws-amplify/ui-react';
import { LoadScript, Autocomplete } from '@react-google-maps/api';
import { useRouter } from 'next/navigation';
import { type Schema } from '@/amplify/data/resource';
import { uploadData } from 'aws-amplify/storage';

type LeadState = Partial<Schema['Lead']['type']>;
type GoogleAutocomplete = google.maps.places.Autocomplete;
const libraries: 'places'[] = ['places'];

// --- CSV TEMPLATES ---
const PROBATE_TEMPLATE = [
  'ownerFirstName,ownerLastName,ownerAddress,ownerCity,ownerState,ownerZip,adminFirstName,adminLastName,adminAddress,adminCity,adminState,adminZip',
];
const PREFORECLOSURE_TEMPLATE = [
  'ownerFirstName,ownerLastName,ownerAddress,ownerCity,ownerState,ownerZip',
];

export default function UploadLeadsPage() {
  const [mode, setMode] = useState<'csv' | 'manual'>('manual');
  const [file, setFile] = useState<File | null>(null);

  // State matches schema fields
  const [lead, setLead] = useState<LeadState>({
    type: '',
    ownerFirstName: '',
    ownerLastName: '',
    ownerAddress: '',
    ownerCity: '',
    ownerState: '',
    ownerZip: '',
    adminFirstName: '',
    adminLastName: '',
    adminAddress: '',
    adminCity: '',
    adminState: '',
    adminZip: '',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  // --- Autocomplete Refs ---
  const addressRef = useRef<GoogleAutocomplete | null>(null);
  const adminAddressRef = useRef<GoogleAutocomplete | null>(null);

  // --- Handlers ---

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setLead((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) setFile(e.target.files[0]);
  };

  // Helper to parse Google address components
  const parseGoogleAddress = (place: google.maps.places.PlaceResult) => {
    const components: { [key: string]: string } = {};
    place.address_components?.forEach((comp) => {
      const type = comp.types[0];
      components[type] = comp.long_name;
    });
    return {
      street:
        `${components.street_number || ''} ${components.route || ''}`.trim(),
      city: components.locality || components.administrative_area_level_2 || '',
      state: components.administrative_area_level_1 || '',
      zip: components.postal_code || '',
    };
  };

  // Property Address Handlers
  const onAddressLoad = (autocomplete: GoogleAutocomplete) => {
    addressRef.current = autocomplete;
  };
  const onAddressChanged = () => {
    if (addressRef.current) {
      const place = addressRef.current.getPlace();
      if (place && place.address_components) {
        const parsed = parseGoogleAddress(place);
        setLead((prev) => ({
          ...prev,
          address: parsed.street,
          city: parsed.city,
          state: parsed.state,
          zip: parsed.zip,
        }));
      }
    }
  };

  // Mailing Address Handlers
  const onadminAddressLoad = (autocomplete: GoogleAutocomplete) => {
    adminAddressRef.current = autocomplete;
  };
  const onadminAddressChanged = () => {
    if (adminAddressRef.current) {
      const place = adminAddressRef.current.getPlace();
      if (place && place.address_components) {
        const parsed = parseGoogleAddress(place);
        setLead((prev) => ({
          ...prev,
          adminAddress: parsed.street,
          adminCity: parsed.city,
          adminState: parsed.state,
          adminZip: parsed.zip,
        }));
      }
    }
  };

  // Template Download Handler
  const downloadTemplate = () => {
    if (!lead.type) {
      alert(
        'Please select a Lead Type first to download the correct template.'
      );
      return;
    }
    const csvContent =
      lead.type === 'probate'
        ? PROBATE_TEMPLATE[0]
        : PREFORECLOSURE_TEMPLATE[0];
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lead.type}-lead-template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Main Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // --- CSV WORKFLOW ---
      if (mode === 'csv') {
        if (!file) {
          setLoading(false);
          return setMessage('❌ Please select a CSV file.');
        }
        if (!lead.type) {
          setLoading(false);
          return setMessage('❌ Please select a Lead Type.');
        }

        // Direct Upload to S3
        const result = await uploadData({
          path: ({ identityId }) => `leadFiles/${identityId}/${file.name}`,
          data: file,
          options: {
            metadata: {
              leadtype: lead.type!, // Pass type for Lambda to read
            },
          },
        }).result;

        console.log('S3 Upload Success:', result);
        setMessage('✅ File uploaded! Processing started in the background.');
        setFile(null);

        setTimeout(() => router.push('/dashboard'), 2000);

        // --- MANUAL WORKFLOW ---
      } else {
        const { type, ownerAddress, ownerCity, ownerState, ownerZip } = lead;
        if (!type || !ownerAddress || !ownerCity || !ownerState || !ownerZip) {
          setLoading(false);
          return alert(
            'Missing required fields (type, address, city, state, zip)'
          );
        }

        const res = await fetch('/api/v1/upload-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lead),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const data = await res.json();
        setMessage(`✅ ${data.message}`);

        // Reset form
        setLead({
          type: '',
          ownerAddress: '',
          ownerFirstName: '',
          ownerLastName: '',
          ownerCity: '',
          ownerState: '',
          ownerZip: '',
          adminFirstName: '',
          adminLastName: '',
          adminAddress: '',
          adminCity: '',
          adminState: '',
          adminZip: '',
        });
      }
    } catch (err: any) {
      console.error(err);
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
      libraries={libraries}
    >
      <main className='max-w-3xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md'>
        <h1 className='text-2xl font-semibold text-blue-600 mb-4'>
          Upload or Add Lead
        </h1>

        {/* Mode Toggle */}
        <div className='flex space-x-2 mb-6'>
          <button
            onClick={() => setMode('csv')}
            className={`px-4 py-2 rounded ${mode === 'csv' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Upload CSV
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`px-4 py-2 rounded ${mode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Add Manually
          </button>
        </div>

        {/* --- CSV Form --- */}
        {mode === 'csv' && (
          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Step 1: Select Lead Type
              </label>
              <select
                name='type'
                value={lead.type || ''}
                onChange={handleChange}
                required
                className='border border-gray-300 rounded-md p-2 w-full'
              >
                <option value=''>Select Type</option>
                <option value='probate'>Probate</option>
                <option value='preforeclosure'>Pre-Foreclosure</option>
              </select>
            </div>

            {/* Download Template */}
            <div className='p-4 bg-gray-50 border border-gray-200 rounded-md'>
              <p className='text-sm text-gray-600 mb-2'>
                Need the correct file format?
              </p>
              <button
                onClick={downloadTemplate}
                type='button'
                className='text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center'
              >
                <svg
                  className='w-4 h-4 mr-1'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                  />
                </svg>
                Download {lead.type ? lead.type : 'CSV'} Template
              </button>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Step 2: Upload Filled CSV
              </label>
              <input
                type='file'
                accept='.csv'
                onChange={handleFileChange}
                className='border border-gray-300 rounded-md p-2 w-full'
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !file || !lead.type}
              className='w-full mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50'
            >
              {loading ? 'Uploading...' : 'Upload and Process'}
            </button>
          </div>
        )}

        {/* --- Manual Form --- */}
        {mode === 'manual' && (
          <form onSubmit={handleSubmit} className='space-y-4'>
            <select
              name='type'
              value={lead.type || ''}
              onChange={handleChange}
              required
              className='border border-gray-300 rounded-md p-2 w-full'
            >
              <option value=''>Select Lead Type *</option>
              <option value='probate'>Probate</option>
              <option value='preforeclosure'>Preforeclosure</option>
            </select>

            {/* Property Address */}
            <h2 className='text-gray-700 font-medium mt-4'>Property Address</h2>
            <Autocomplete
              onLoad={onAddressLoad}
              onPlaceChanged={onAddressChanged}
            >
              <input
                name='ownerAddress'
                placeholder='Owner Address *'
                value={lead.ownerAddress || ''}
                onChange={handleChange}
                className='border border-gray-300 rounded-md p-2 w-full'
                required
              />
            </Autocomplete>
            <div className='grid grid-cols-3 gap-2'>
              <input
                name='ownerCity'
                placeholder='Owner City *'
                value={lead.ownerCity || ''}
                onChange={handleChange}
                className='border border-gray-300 rounded-md p-2'
                required
              />
              <input
                name='ownerState'
                placeholder='Owner State *'
                value={lead.ownerState || ''}
                onChange={handleChange}
                className='border border-gray-300 rounded-md p-2'
                required
              />
              <input
                name='ownerZip'
                placeholder='Owner ZIP *'
                value={lead.ownerZip || ''}
                onChange={handleChange}
                className='border border-gray-300 rounded-md p-2'
                required
              />
            </div>

            {/* Conditional Fields */}
            {lead.type === 'probate' && (
              <>
                <h2 className='text-gray-700 font-medium mt-4'>
                  Owner Information
                </h2>
                <div className='grid grid-cols-2 gap-2'>
                  <input
                    name='ownerFirstName'
                    placeholder='Owner First Name'
                    value={lead.ownerFirstName || ''}
                    onChange={handleChange}
                    className='border border-gray-300 rounded-md p-2'
                  />
                  <input
                    name='ownerLastName'
                    placeholder='Owner Last Name'
                    value={lead.ownerLastName || ''}
                    onChange={handleChange}
                    className='border border-gray-300 rounded-md p-2'
                  />
                </div>

                <h2 className='text-gray-700 font-medium mt-4'>
                  admin Information
                </h2>
                <div className='grid grid-cols-2 gap-2'>
                  <input
                    name='adminFirstName'
                    placeholder='admin First Name'
                    value={lead.adminFirstName || ''}
                    onChange={handleChange}
                    className='border border-gray-300 rounded-md p-2'
                  />
                  <input
                    name='adminLastName'
                    placeholder='admin Last Name'
                    value={lead.adminLastName || ''}
                    onChange={handleChange}
                    className='border border-gray-300 rounded-md p-2'
                  />
                </div>

                <h2 className='text-gray-700 font-medium mt-4'>
                  admin Mailing Address
                </h2>
                <Autocomplete
                  onLoad={onadminAddressLoad}
                  onPlaceChanged={onadminAddressChanged}
                >
                  <input
                    name='adminAddress'
                    placeholder='Mailing Address'
                    value={lead.adminAddress || ''}
                    onChange={handleChange}
                    className='border border-gray-300 rounded-md p-2 w-full'
                  />
                </Autocomplete>
                <div className='grid grid-cols-3 gap-2'>
                  <input
                    name='adminCity'
                    placeholder='City'
                    value={lead.adminCity || ''}
                    onChange={handleChange}
                    className='border border-gray-300 rounded-md p-2'
                  />
                  <input
                    name='adminState'
                    placeholder='State'
                    value={lead.adminState || ''}
                    onChange={handleChange}
                    className='border border-gray-300 rounded-md p-2'
                  />
                  <input
                    name='adminZip'
                    placeholder='ZIP'
                    value={lead.adminZip || ''}
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
                    name='ownerFirstName'
                    placeholder='Borrower First Name'
                    value={lead.ownerFirstName || ''}
                    onChange={handleChange}
                    className='border border-gray-300 rounded-md p-2'
                  />
                  <input
                    name='ownerLastName'
                    placeholder='Borrower Last Name'
                    value={lead.ownerLastName || ''}
                    onChange={handleChange}
                    className='border border-gray-300 rounded-md p-2'
                  />
                </div>
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

        {message && (
          <p className='mt-4 text-sm font-medium text-center'>{message}</p>
        )}
      </main>
    </LoadScript>
  );
}
