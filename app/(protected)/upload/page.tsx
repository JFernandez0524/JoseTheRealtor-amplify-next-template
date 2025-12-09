'use client';

import { useState, useRef, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { useRouter } from 'next/navigation';
import { uploadData } from 'aws-amplify/storage';
import { getCurrentUser } from 'aws-amplify/auth';

// 🟢 Use the Amplify Data Client
import { client } from '@/app/utils/aws/data/frontEndClient';
import { type Schema } from '@/amplify/data/resource';

// Define types for Web Components
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gmp-place-autocomplete': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { ref?: any },
        HTMLElement
      >;
    }
  }
}

const libraries: 'places'[] = ['places'];

// 🟢 Extended State to hold Geometry (Lat/Lng)
type ExtendedLeadState = Partial<Schema['PropertyLead']['type']> & {
  propLat?: number;
  propLng?: number;
};

const PROBATE_TEMPLATE = [
  'ownerFirstName,ownerLastName,ownerAddress,ownerCity,ownerState,ownerZip,adminFirstName,adminLastName,adminAddress,adminCity,adminState,adminZip',
];
const PREFORECLOSURE_TEMPLATE = [
  'ownerFirstName,ownerLastName,ownerAddress,ownerCity,ownerState,ownerZip',
];

export default function UploadLeadsPage() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: libraries,
  });

  const [mode, setMode] = useState<'csv' | 'manual'>('manual');
  const [file, setFile] = useState<File | null>(null);

  const [lead, setLead] = useState<ExtendedLeadState>({
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

  const ownerRef = useRef<any>(null);
  const adminRef = useRef<any>(null);

  // Helper to parse Google Place components
  const parseGoogleAddress = (place: google.maps.places.PlaceResult) => {
    const components: { [key: string]: string } = {};
    place.address_components?.forEach((comp) => {
      const type = comp.types[0];
      components[type] = comp.long_name;
    });
    return {
      street:
        `${components.street_number || ''} ${components.route || ''}`.trim(),
      city:
        components.locality ||
        components.sublocality ||
        components.administrative_area_level_2 ||
        '',
      state: components.administrative_area_level_1 || '',
      zip: components.postal_code || '',
    };
  };

  useEffect(() => {
    if (!isLoaded || mode !== 'manual') return;

    const ownerEl = ownerRef.current;
    const adminEl = adminRef.current;

    // 🟢 Handler for Property Address (Captures Lat/Lng)
    const handleOwnerSelect = (e: any) => {
      const place = e.detail.place;
      if (place && place.address_components) {
        const parsed = parseGoogleAddress(place);
        setLead((prev) => ({
          ...prev,
          ownerAddress: place.formatted_address || parsed.street,
          ownerCity: parsed.city,
          ownerState: parsed.state,
          ownerZip: parsed.zip,
          // Capture Geometry for Map
          propLat: place.geometry?.location?.lat(),
          propLng: place.geometry?.location?.lng(),
        }));
      }
    };

    // 🟢 Handler for Admin Address
    const handleAdminSelect = (e: any) => {
      const place = e.detail.place;
      if (place && place.address_components) {
        const parsed = parseGoogleAddress(place);
        setLead((prev) => ({
          ...prev,
          adminAddress: place.formatted_address || parsed.street,
          adminCity: parsed.city,
          adminState: parsed.state,
          adminZip: parsed.zip,
        }));
      }
    };

    if (ownerEl)
      ownerEl.addEventListener('gmp-places-select', handleOwnerSelect);
    if (adminEl)
      adminEl.addEventListener('gmp-places-select', handleAdminSelect);

    return () => {
      if (ownerEl)
        ownerEl.removeEventListener('gmp-places-select', handleOwnerSelect);
      if (adminEl)
        adminEl.removeEventListener('gmp-places-select', handleAdminSelect);
    };
  }, [isLoaded, mode, lead.type]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setLead((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) setFile(e.target.files[0]);
  };

  // --- CSV UPLOAD LOGIC (Unchanged - triggers Lambda) ---
  const handleCsvSubmit = async () => {
    if (!file || !lead.type) {
      setMessage('❌ Please select a file and lead type.');
      setLoading(false);
      return;
    }

    const user = await getCurrentUser();

    await uploadData({
      path: `leadFiles/${user.userId}/${file.name}`,
      data: file,
      options: {
        metadata: {
          leadtype: lead.type!,
          owner_sub: user.userId,
        },
      },
    }).result;

    setMessage('✅ File uploaded! Processing started in the background.');
    setFile(null);
    setTimeout(() => router.push('/dashboard'), 2000);
  };

  // --- 🟢 NEW: MANUAL SUBMIT LOGIC (Direct to DynamoDB) ---
  const handleManualSubmit = async () => {
    const { type, ownerAddress, ownerCity, ownerState, ownerZip } = lead;

    // 1. Basic Validation
    if (!type || !ownerAddress || !ownerCity || !ownerState || !ownerZip) {
      setLoading(false);
      return alert('Missing required property fields');
    }

    // 2. Determine Mailing Address Logic
    // Initialize with Property Address (default for Pre-Foreclosure)
    // We use `|| ''` to ensure they are strings, but our Schema allows nulls too.
    let finalMailingAddr: string | null | undefined = lead.ownerAddress;
    let finalMailingCity: string | null | undefined = lead.ownerCity;
    let finalMailingState: string | null | undefined = lead.ownerState;
    let finalMailingZip: string | null | undefined = lead.ownerZip;
    let isAbsentee = false;

    // If Probate, Override with Admin Address
    if (type === 'probate') {
      if (!lead.adminAddress) {
        setLoading(false);
        return alert('Probate leads require an Admin Address.');
      }
      finalMailingAddr = lead.adminAddress;
      finalMailingCity = lead.adminCity;
      finalMailingState = lead.adminState;
      finalMailingZip = lead.adminZip;
      isAbsentee = true; // Probate is effectively absentee
    }

    // 3. Save directly to Data Store
    // We use `lead.ownerFirstName || ''` to ensure no undefined values break the create call if strict
    const { errors, data: newLead } = await client.models.PropertyLead.create({
      type: type.toUpperCase(), // 'PROBATE' or 'PREFORECLOSURE'

      // Owner Info
      ownerFirstName: lead.ownerFirstName || '',
      ownerLastName: lead.ownerLastName || '',
      ownerAddress: lead.ownerAddress || '',
      ownerCity: lead.ownerCity || '',
      ownerState: lead.ownerState || '',
      ownerZip: lead.ownerZip || '',

      // Admin Info
      adminFirstName: lead.adminFirstName || '',
      adminLastName: lead.adminLastName || '',
      adminAddress: lead.adminAddress || '',
      adminCity: lead.adminCity || '',
      adminState: lead.adminState || '',
      adminZip: lead.adminZip || '',

      // Mailing Info (Calculated above)
      // Ensure we pass null if undefined to satisfy strict types if needed, or just pass the value
      mailingAddress: finalMailingAddr || null,
      mailingCity: finalMailingCity || null,
      mailingState: finalMailingState || null,
      mailingZip: finalMailingZip || null,
      isAbsenteeOwner: isAbsentee,

      // System Fields
      validationStatus: 'VALID', // It came from Google Autocomplete, so it is valid
      skipTraceStatus: 'PENDING',
      latitude: lead.propLat || null,
      longitude: lead.propLng || null,

      phones: [],
      emails: [],
    });

    if (errors) {
      throw new Error(errors[0].message);
    }

    setMessage(`✅ Lead added successfully!`);

    // Clear form
    setLead({
      type: '',
      ownerAddress: '',
      ownerCity: '',
      ownerState: '',
      ownerZip: '',
      adminAddress: '',
      adminCity: '',
      adminState: '',
      adminZip: '',
      ownerFirstName: '',
      ownerLastName: '',
      adminFirstName: '',
      adminLastName: '',
    });

    if (ownerRef.current) ownerRef.current.value = '';
    if (adminRef.current) adminRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (mode === 'csv') {
        await handleCsvSubmit();
      } else {
        await handleManualSubmit();
      }
    } catch (err: any) {
      console.error(err);
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    if (!lead.type) return alert('Please select a Lead Type first.');
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

  if (!isLoaded) {
    return <div className='p-10 text-center'>Loading Maps...</div>;
  }

  return (
    <main className='max-w-3xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md'>
      <h1 className='text-2xl font-semibold text-blue-600 mb-4'>
        Upload or Add Lead
      </h1>

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
          <div className='p-4 bg-gray-50 border border-gray-200 rounded-md'>
            <p className='text-sm text-gray-600 mb-2'>
              Need the correct file format?
            </p>
            <button
              onClick={downloadTemplate}
              type='button'
              className='text-sm text-blue-600 hover:text-blue-800 font-medium'
            >
              Download Template
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

          <h2 className='text-gray-700 font-medium mt-4'>Property Address</h2>
          <div className='w-full'>
            <gmp-place-autocomplete ref={ownerRef}>
              <input
                slot='input'
                name='ownerAddress'
                placeholder='Owner Address *'
                onChange={handleChange}
                className='border border-gray-300 rounded-md p-2 w-full'
                required
              />
            </gmp-place-autocomplete>
          </div>

          <div className='grid grid-cols-3 gap-2'>
            <input
              name='ownerCity'
              placeholder='City *'
              value={lead.ownerCity || ''}
              onChange={handleChange}
              className='border p-2'
              required
            />
            <input
              name='ownerState'
              placeholder='State *'
              value={lead.ownerState || ''}
              onChange={handleChange}
              className='border p-2'
              required
            />
            <input
              name='ownerZip'
              placeholder='ZIP *'
              value={lead.ownerZip || ''}
              onChange={handleChange}
              className='border p-2'
              required
            />
          </div>

          {lead.type === 'probate' && (
            <>
              <h2 className='text-gray-700 font-medium mt-4'>
                Owner Info (Deceased)
              </h2>
              <div className='grid grid-cols-2 gap-2'>
                <input
                  name='ownerFirstName'
                  placeholder='First Name'
                  value={lead.ownerFirstName || ''}
                  onChange={handleChange}
                  className='border p-2'
                />
                <input
                  name='ownerLastName'
                  placeholder='Last Name'
                  value={lead.ownerLastName || ''}
                  onChange={handleChange}
                  className='border p-2'
                />
              </div>

              <h2 className='text-gray-700 font-medium mt-4'>Admin Info</h2>
              <div className='grid grid-cols-2 gap-2'>
                <input
                  name='adminFirstName'
                  placeholder='Admin First Name'
                  value={lead.adminFirstName || ''}
                  onChange={handleChange}
                  className='border p-2'
                />
                <input
                  name='adminLastName'
                  placeholder='Admin Last Name'
                  value={lead.adminLastName || ''}
                  onChange={handleChange}
                  className='border p-2'
                />
              </div>

              <h2 className='text-gray-700 font-medium mt-4'>
                Admin Mailing Address
              </h2>
              <div className='w-full'>
                <gmp-place-autocomplete ref={adminRef}>
                  <input
                    slot='input'
                    name='adminAddress'
                    placeholder='Mailing Address'
                    onChange={handleChange}
                    className='border p-2 w-full'
                  />
                </gmp-place-autocomplete>
              </div>
              <div className='grid grid-cols-3 gap-2'>
                <input
                  name='adminCity'
                  placeholder='City'
                  value={lead.adminCity || ''}
                  onChange={handleChange}
                  className='border p-2'
                />
                <input
                  name='adminState'
                  placeholder='State'
                  value={lead.adminState || ''}
                  onChange={handleChange}
                  className='border p-2'
                />
                <input
                  name='adminZip'
                  placeholder='ZIP'
                  value={lead.adminZip || ''}
                  onChange={handleChange}
                  className='border p-2'
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
                  placeholder='First Name'
                  value={lead.ownerFirstName || ''}
                  onChange={handleChange}
                  className='border p-2'
                />
                <input
                  name='ownerLastName'
                  placeholder='Last Name'
                  value={lead.ownerLastName || ''}
                  onChange={handleChange}
                  className='border p-2'
                />
              </div>
            </>
          )}

          <button
            type='submit'
            disabled={loading}
            className='mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 w-full'
          >
            {loading ? 'Saving...' : 'Add Lead'}
          </button>
        </form>
      )}

      {message && (
        <p className='mt-4 text-sm font-medium text-center'>{message}</p>
      )}
    </main>
  );
}
