'use client';

import { useState, useRef, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { uploadData } from 'aws-amplify/storage';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { useRouter } from 'next/navigation';
import { useSubscription } from '@/app/hooks/useSubscription';

const libraries: 'places'[] = ['places'];

// 🎯 CSV Template Headers matching your updated Probate file requirements
const PROBATE_TEMPLATE =
  'ownerFirstName,ownerLastName,ownerAddress,ownerCity,ownerState,ownerZip,adminFirstName,adminLastName,adminAddress,adminCity,adminState,adminZip,phone';
const PREFORECLOSURE_TEMPLATE =
  'ownerFirstName,ownerLastName,ownerAddress,ownerCity,ownerState,ownerZip';

export function ManualLeadForm() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });
  //hook to check user subscription
  const { hasPremiumAccess, isLoading } = useSubscription();

  const router = useRouter();
  const [mode, setMode] = useState<'csv' | 'manual'>('manual');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [lead, setLead] = useState<any>({
    type: '',
    ownerFirstName: '',
    ownerLastName: '',
    adminFirstName: '',
    adminLastName: '',
    phone: '', // 🎯 Added state for manual phone entry
  });

  const ownerRef = useRef<any>(null);
  const adminRef = useRef<any>(null);

  const downloadTemplate = () => {
    if (!lead.type) return alert('Please select a Lead Type first.');
    const csvContent =
      lead.type === 'PROBATE' ? PROBATE_TEMPLATE : PREFORECLOSURE_TEMPLATE;
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
          latitude: place.geometry?.location?.lat(),
          longitude: place.geometry?.location?.lng(),
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

    const ownerEl = ownerRef.current;
    const adminEl = adminRef.current;
    ownerEl?.addEventListener('gmp-places-select', handleOwnerSelect);
    adminEl?.addEventListener('gmp-places-select', handleAdminSelect);

    return () => {
      ownerEl?.removeEventListener('gmp-places-select', handleOwnerSelect);
      adminEl?.removeEventListener('gmp-places-select', handleAdminSelect);
    };
  }, [isLoaded, mode]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead.type || !lead.ownerAddress || !lead.ownerLastName) {
      return setMessage('❌ Please fill in all required fields (*)');
    }

    setLoading(true);
    try {
      // 🎯 If phone is provided manually, it will be saved to phones array in DB
      const { data: newLead, errors } = await client.models.PropertyLead.create(
        {
          ...lead,
          phones: lead.phone ? [lead.phone] : [],
          skipTraceStatus: lead.phone ? 'COMPLETED' : 'PENDING',
          ghlSyncStatus: 'PENDING',
          ghlContactId: null,
        }
      );

      if (errors) throw new Error(errors[0].message);
      setMessage('✅ Lead added successfully!');
      setLead({ type: '', ownerFirstName: '', ownerLastName: '', phone: '' });
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCsvSubmit = async () => {
    if (!hasPremiumAccess) return alert('Please upgrade to PRO!');
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

      // 🎯 Success notification + Redirect
      setMessage('✅ Uploaded! Moving to Dashboard...');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) return <div className='p-10 text-center'>Loading Maps...</div>;

  return (
    <>
      {hasPremiumAccess && (
        <div className='space-y-6 max-w-2xl mx-auto p-4 bg-white shadow-sm rounded-lg'>
          <div className='flex gap-4 border-b border-gray-100 pb-4'>
            <button
              onClick={() => setMode('manual')}
              //button disabled for non group members

              className={`pb-2 px-4 transition-all ${mode === 'manual' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Manual Add
            </button>
            <button
              onClick={() => setMode('csv')}
              className={`pb-2 px-4 transition-all ${mode === 'csv' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
            >
              CSV Import
            </button>
          </div>

          {mode === 'csv' ? (
            <div className='space-y-4 animate-in fade-in duration-300'>
              <div className='bg-gray-50 p-4 rounded-md border border-gray-100'>
                <label className='block text-xs font-bold text-gray-500 uppercase mb-2'>
                  1. Select Lead Type
                </label>
                <select
                  value={lead.type}
                  onChange={(e) => setLead({ ...lead, type: e.target.value })}
                  className='w-full border p-2 rounded bg-white outline-none focus:ring-2 focus:ring-blue-100'
                >
                  <option value=''>Select Type</option>
                  <option value='PROBATE'>Probate</option>
                  <option value='PREFORECLOSURE'>Pre-Foreclosure</option>
                </select>

                {lead.type && (
                  <div className='mt-3 p-3 bg-blue-50 border border-blue-100 rounded text-sm'>
                    <p className='text-blue-800 mb-1'>
                      Format required for <strong>{lead.type}</strong>:
                    </p>
                    <button
                      onClick={downloadTemplate}
                      className='text-blue-600 font-bold hover:underline'
                    >
                      Download {lead.type} Template{' '}
                      {lead.type === 'PROBATE' && '(includes phone column)'}
                    </button>
                  </div>
                )}
              </div>

              <div className='p-4 border border-dashed border-gray-300 rounded-md text-center'>
                <label className='block text-xs font-bold text-gray-500 uppercase mb-2 text-left'>
                  2. Upload File
                </label>
                <input
                  type='file'
                  accept='.csv'
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className='w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
                />
              </div>

              <button
                onClick={handleCsvSubmit}
                disabled={loading || !file || !lead.type}
                className='w-full bg-blue-600 text-white p-3 rounded-md font-bold disabled:bg-gray-300 hover:bg-blue-700 transition-colors'
              >
                {loading ? 'Processing...' : 'Start CSV Import'}
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleManualSubmit}
              className='space-y-4 animate-in fade-in duration-300'
            >
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='text-xs font-bold text-gray-400 uppercase'>
                    First Name
                  </label>
                  <input
                    className='w-full border p-2 rounded'
                    value={lead.ownerFirstName}
                    onChange={(e) =>
                      setLead({ ...lead, ownerFirstName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className='text-xs font-bold text-gray-400 uppercase'>
                    Last Name *
                  </label>
                  <input
                    className='w-full border p-2 rounded'
                    value={lead.ownerLastName}
                    onChange={(e) =>
                      setLead({ ...lead, ownerLastName: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {/* 🎯 Added Phone field for Manual Entry */}
              <div className='space-y-1'>
                <label className='text-xs font-bold text-gray-400 uppercase'>
                  Phone Number (Optional)
                </label>
                <input
                  placeholder='+12015551234'
                  className='w-full border p-2 rounded'
                  value={lead.phone}
                  onChange={(e) => setLead({ ...lead, phone: e.target.value })}
                />
                <p className='text-[10px] text-gray-400'>
                  Adding a phone number will skip automated skiptracing.
                </p>
              </div>

              <div className='space-y-1'>
                <label className='text-xs font-bold text-gray-400 uppercase'>
                  Lead Type *
                </label>
                <select
                  value={lead.type || ''}
                  onChange={(e) => setLead({ ...lead, type: e.target.value })}
                  className='border p-2 w-full rounded'
                  required
                >
                  <option value=''>Select Type</option>
                  <option value='PROBATE'>Probate</option>
                  <option value='PREFORECLOSURE'>Pre-Foreclosure</option>
                </select>
              </div>

              <div className='space-y-1'>
                <label className='text-xs font-bold text-gray-400 uppercase'>
                  Property Address *
                </label>
                <gmp-place-autocomplete ref={ownerRef}>
                  <input
                    slot='input'
                    placeholder='Search Address...'
                    className='border p-2 w-full rounded'
                  />
                </gmp-place-autocomplete>
              </div>

              {lead.type === 'PROBATE' && (
                <div className='p-4 bg-gray-50 rounded-md border border-gray-100 space-y-4'>
                  <h3 className='text-sm font-bold text-gray-700 border-b pb-2'>
                    Admin / Executor Info
                  </h3>
                  <div className='grid grid-cols-2 gap-4'>
                    <input
                      placeholder='Admin First Name'
                      className='border p-2 rounded bg-white'
                      value={lead.adminFirstName}
                      onChange={(e) =>
                        setLead({ ...lead, adminFirstName: e.target.value })
                      }
                    />
                    <input
                      placeholder='Admin Last Name'
                      className='border p-2 rounded bg-white'
                      value={lead.adminLastName}
                      onChange={(e) =>
                        setLead({ ...lead, adminLastName: e.target.value })
                      }
                    />
                  </div>
                  <gmp-place-autocomplete ref={adminRef}>
                    <input
                      slot='input'
                      placeholder='Admin Mailing Address'
                      className='border p-2 w-full rounded bg-white'
                    />
                  </gmp-place-autocomplete>
                </div>
              )}

              <button
                type='submit'
                disabled={loading}
                className='w-full bg-blue-600 text-white p-3 rounded-md font-bold hover:bg-blue-700 disabled:bg-gray-300 transition-colors'
              >
                {loading ? 'Adding...' : 'Save Manual Lead'}
              </button>
            </form>
          )}

          {message && (
            <div
              className={`p-3 rounded text-center text-sm font-bold ${message.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
            >
              {message}
            </div>
          )}
        </div>
      )}
      <div>SIGN UP FOR PRO!</div>
    </>
  );
}
