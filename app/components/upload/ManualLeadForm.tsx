'use client';

import { useState, useRef, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { uploadData } from 'aws-amplify/storage';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { type Schema } from '@/amplify/data/resource';

const libraries: 'places'[] = ['places'];

// 🟢 CSV Template Headers
const PROBATE_TEMPLATE = [
  'ownerFirstName,ownerLastName,ownerAddress,ownerCity,ownerState,ownerZip,adminFirstName,adminLastName,adminAddress,adminCity,adminState,adminZip',
];
const PREFORECLOSURE_TEMPLATE = [
  'ownerFirstName,ownerLastName,ownerAddress,ownerCity,ownerState,ownerZip',
];

export function ManualLeadForm() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

  const [mode, setMode] = useState<'csv' | 'manual'>('manual');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [lead, setLead] = useState<any>({ type: '' });

  const ownerRef = useRef<any>(null);
  const adminRef = useRef<any>(null);

  // 🟢 Template Download Logic
  const downloadTemplate = () => {
    if (!lead.type) return alert('Please select a Lead Type first.');
    const csvContent =
      lead.type === 'PROBATE'
        ? PROBATE_TEMPLATE[0]
        : PREFORECLOSURE_TEMPLATE[0];
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lead.type.toLowerCase()}-lead-template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

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

    const handleOwnerSelect = (e: any) => {
      const place = e.detail.place;
      if (place?.address_components) {
        const parsed = parseGoogleAddress(place);
        setLead((prev: any) => ({
          ...prev,
          ownerAddress: place.formatted_address || parsed.street,
          ownerCity: parsed.city,
          ownerState: parsed.state,
          ownerZip: parsed.zip,
          propLat: place.geometry?.location?.lat(),
          propLng: place.geometry?.location?.lng(),
        }));
      }
    };

    const handleAdminSelect = (e: any) => {
      const place = e.detail.place;
      if (place?.address_components) {
        const parsed = parseGoogleAddress(place);
        setLead((prev: any) => ({
          ...prev,
          adminAddress: place.formatted_address || parsed.street,
          adminCity: parsed.city,
          adminState: parsed.state,
          adminZip: parsed.zip,
        }));
      }
    };

    ownerEl?.addEventListener('gmp-places-select', handleOwnerSelect);
    adminEl?.addEventListener('gmp-places-select', handleAdminSelect);

    return () => {
      ownerEl?.removeEventListener('gmp-places-select', handleOwnerSelect);
      adminEl?.removeEventListener('gmp-places-select', handleAdminSelect);
    };
  }, [isLoaded, mode]);

  const handleCsvSubmit = async () => {
    if (!file || !lead.type) return setMessage('❌ Select file and lead type.');
    setLoading(true);
    try {
      const user = await getFrontEndUser();
      if (!user) throw new Error('Session expired.');

      await uploadData({
        path: `leadFiles/${user.userId}/${file.name}`,
        data: file,
        options: {
          metadata: {
            leadtype: lead.type.toUpperCase(),
            owner_sub: user.userId,
          },
        },
      }).result;

      setMessage('✅ Uploaded! Processing leads now.');
      setFile(null);
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div className='space-y-6'>
      <div className='flex gap-4 border-b border-gray-100 pb-4'>
        <button
          onClick={() => setMode('manual')}
          className={`pb-2 px-4 ${mode === 'manual' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-400'}`}
        >
          Manual Add
        </button>
        <button
          onClick={() => setMode('csv')}
          className={`pb-2 px-4 ${mode === 'csv' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-400'}`}
        >
          CSV Import
        </button>
      </div>

      {mode === 'csv' ? (
        <div className='space-y-4'>
          <div>
            <label className='block text-xs font-bold text-gray-500 uppercase mb-1'>
              1. Select Lead Type
            </label>
            <select
              onChange={(e) => setLead({ ...lead, type: e.target.value })}
              className='w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-100'
            >
              <option value=''>Select Type</option>
              <option value='PROBATE'>Probate</option>
              <option value='PREFORECLOSURE'>Pre-Foreclosure</option>
            </select>
          </div>

          {/* 🟢 Restore Template Download */}
          {lead.type && (
            <div className='p-3 bg-blue-50 border border-blue-100 rounded text-sm'>
              <p className='text-blue-800 mb-1'>
                Need the correct format for {lead.type}?
              </p>
              <button
                onClick={downloadTemplate}
                className='text-blue-600 font-bold hover:underline'
              >
                Download {lead.type} Template
              </button>
            </div>
          )}

          <div>
            <label className='block text-xs font-bold text-gray-500 uppercase mb-1'>
              2. Upload File
            </label>
            <input
              type='file'
              accept='.csv'
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className='w-full border p-2 rounded bg-white'
            />
          </div>

          <button
            onClick={handleCsvSubmit}
            disabled={loading || !file || !lead.type}
            className='w-full bg-blue-600 text-white p-2 rounded font-bold disabled:bg-gray-200'
          >
            {loading ? 'Uploading...' : 'Process CSV'}
          </button>
        </div>
      ) : (
        /* Manual Form Logic (Restored from previous step) */
        <form className='space-y-4'>
          <select
            value={lead.type || ''}
            onChange={(e) => setLead({ ...lead, type: e.target.value })}
            className='border p-2 w-full rounded'
          >
            <option value=''>Select Lead Type *</option>
            <option value='PROBATE'>Probate</option>
            <option value='PREFORECLOSURE'>Preforeclosure</option>
          </select>

          <gmp-place-autocomplete ref={ownerRef}>
            <input
              slot='input'
              placeholder='Property Address *'
              className='border p-2 w-full rounded'
            />
          </gmp-place-autocomplete>

          <div className='grid grid-cols-3 gap-2'>
            <input
              placeholder='City'
              value={lead.ownerCity || ''}
              readOnly
              className='border p-2 bg-gray-50 rounded'
            />
            <input
              placeholder='State'
              value={lead.ownerState || ''}
              readOnly
              className='border p-2 bg-gray-50 rounded'
            />
            <input
              placeholder='Zip'
              value={lead.ownerZip || ''}
              readOnly
              className='border p-2 bg-gray-50 rounded'
            />
          </div>

          {/* Additional manual fields for Probate/Preforeclosure... */}
        </form>
      )}
      {message && (
        <p className='text-center text-sm font-bold text-blue-600'>{message}</p>
      )}
    </div>
  );
}
