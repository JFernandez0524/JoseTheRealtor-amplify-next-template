'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Loader } from '@aws-amplify/ui-react';
import axios from 'axios';
import {
  GoogleMap,
  MarkerF,
  useJsApiLoader,
  Libraries,
} from '@react-google-maps/api';

// 👇 Import your frontend client
import { client } from '@/app/utils/aws/data/frontEndClient';
// 👇 Import the Schema type directly to ensure type safety
import { type Schema } from '@/amplify/data/resource';

// Define the shape of our Lead based on the Schema
type Lead = Schema['PropertyLead']['type'];

const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '0.5rem',
  marginTop: '1.5rem',
};

const libraries: Libraries = ['places'];

const formatCurrency = (value?: number | string | null) => {
  if (!value) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value));
};

export default function LeadDetailPage() {
  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: libraries,
  });

  const [lead, setLead] = useState<Lead | null>(null);
  const [marketData, setMarketData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSkipTracing, setIsSkipTracing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useParams();

  useEffect(() => {
    const id = params.id as string;
    if (id) {
      loadData(id);
    }
  }, [params.id]);

  const loadData = async (id: string) => {
    setIsLoading(true);
    try {
      // 1. 🟢 FETCH LEAD DIRECTLY (Reliable)
      // This uses the generated client so it handles the new Arrays correctly
      const { data: leadData, errors } = await client.models.PropertyLead.get({
        id: id,
      });

      if (errors || !leadData) {
        throw new Error('Could not find lead in database.');
      }

      setLead(leadData);

      // 2. 🟡 FETCH MARKET DATA (Best Effort)
      // We try to hit your API, but if it fails, we don't break the whole page.
      try {
        const response = await axios.get(`/api/v1/leads/${id}`);
        if (response.data && response.data.marketAnalysis) {
          setMarketData(response.data.marketAnalysis);
        }
      } catch (marketError) {
        console.warn(
          'Market Data API failed (likely due to schema change), but Lead loaded.',
          marketError
        );
        // We do NOT set the main error here, so the user can still see the lead.
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load lead.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipTrace = async () => {
    if (!lead) return;
    if (lead.skipTraceStatus === 'COMPLETED') return;

    setIsSkipTracing(true);
    try {
      await client.mutations.skipTraceLeads({
        leadIds: [lead.id],
        targetCrm: 'NONE',
      });

      // Refresh data
      await loadData(lead.id);
      alert('Skip Trace Complete!');
    } catch (err: any) {
      console.error('Skip trace failed:', err);
      alert('Skip trace failed. Please try again.');
    } finally {
      setIsSkipTracing(false);
    }
  };

  // --- RENDER ---
  if (isLoading) {
    return (
      <main className='max-w-4xl mx-auto py-10 px-6 text-center'>
        <Loader size='large' />
      </main>
    );
  }

  if (error) {
    return (
      <main className='max-w-4xl mx-auto py-10 px-6'>
        <h1 className='text-3xl font-bold text-red-600'>Error</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (!lead) {
    return (
      <main className='max-w-4xl mx-auto py-10 px-6'>
        <h1 className='text-3xl font-bold'>Lead Not Found</h1>
      </main>
    );
  }

  // 🟢 MAP LOGIC: Ensure we have numbers
  const mapCenter =
    lead.latitude && lead.longitude
      ? { lat: Number(lead.latitude), lng: Number(lead.longitude) }
      : null;

  return (
    <main className='max-w-6xl mx-auto py-10 px-6'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold'>
          {lead.ownerFirstName} {lead.ownerLastName}
        </h1>
        <p className='text-lg text-gray-600'>
          {lead.ownerAddress}, {lead.ownerCity}, {lead.ownerState}
        </p>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
        <div className='lg:col-span-2 space-y-6'>
          {/* Property Details */}
          <div className='bg-white shadow border rounded-lg p-6'>
            <h2 className='text-xl font-semibold mb-4'>Property Details</h2>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='text-sm font-medium text-gray-500'>
                  Type
                </label>
                <p className='text-base capitalize'>{lead.type}</p>
              </div>
              <div>
                <label className='text-sm font-medium text-gray-500'>
                  Status
                </label>
                <p className='text-base'>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      lead.skipTraceStatus === 'COMPLETED'
                        ? 'bg-green-100 text-green-800'
                        : lead.skipTraceStatus === 'FAILED'
                          ? 'bg-red-100 text-red-800'
                          : lead.skipTraceStatus === 'NO_MATCH'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {lead.skipTraceStatus}
                  </span>
                </p>
              </div>
              <div>
                <label className='text-sm font-medium text-gray-500'>
                  Zip Code
                </label>
                <p className='text-base'>{lead.ownerZip}</p>
              </div>
              <div>
                <label className='text-sm font-medium text-gray-500'>
                  Source
                </label>
                <p className='text-base'>CSV Import</p>
              </div>
            </div>
            {lead.type === 'probate' && (
              <>
                <h3 className='text-lg font-semibold mt-6 mb-2'>
                  Executor Info
                </h3>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label className='text-sm font-medium text-gray-500'>
                      Name
                    </label>
                    <p className='text-base'>
                      {lead.adminFirstName} {lead.adminLastName}
                    </p>
                  </div>
                  <div>
                    <label className='text-sm font-medium text-gray-500'>
                      Mailing Address
                    </label>
                    <p className='text-base'>{lead.adminAddress || 'N/A'}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Contacts Card */}
          <div className='bg-white shadow border rounded-lg p-6 relative'>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-xl font-semibold'>Contacts</h2>
              <button
                onClick={handleSkipTrace}
                disabled={isSkipTracing || lead.skipTraceStatus === 'COMPLETED'}
                className={`
                  text-sm px-3 py-1.5 rounded transition-colors flex items-center gap-2
                  ${
                    lead.skipTraceStatus === 'COMPLETED'
                      ? 'bg-green-100 text-green-700 cursor-not-allowed border border-green-200'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300'
                  }
                `}
              >
                {isSkipTracing ? (
                  <>
                    <Loader size='small' variation='linear' /> Tracing...
                  </>
                ) : lead.skipTraceStatus === 'COMPLETED' ? (
                  <>
                    <span>✓</span> Skiptrace Complete
                  </>
                ) : lead.skipTraceStatus === 'NO_MATCH' ? (
                  'Retry Skip Trace'
                ) : (
                  'Skip Trace Owner'
                )}
              </button>
            </div>

            {(!lead.phones || lead.phones.length === 0) &&
            (!lead.emails || lead.emails.length === 0) ? (
              <div className='text-center py-6 bg-gray-50 rounded border border-dashed'>
                <p className='text-gray-500 mb-2'>No contact info available.</p>
                <p className='text-xs text-gray-400'>
                  Click "Skip Trace Owner" to find numbers.
                </p>
              </div>
            ) : (
              <div className='space-y-4'>
                <div>
                  <h3 className='text-xs font-bold text-gray-500 uppercase mb-2'>
                    Phone Numbers
                  </h3>
                  {lead.phones && lead.phones.length > 0 ? (
                    <div className='flex flex-wrap gap-2'>
                      {lead.phones.map((phone, i) => (
                        <div
                          key={i}
                          className='bg-green-50 text-green-800 border border-green-200 px-3 py-1 rounded text-sm font-mono flex items-center gap-2'
                        >
                          📞 {phone}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className='text-sm text-gray-400 italic'>
                      None found
                    </span>
                  )}
                </div>
                <div>
                  <h3 className='text-xs font-bold text-gray-500 uppercase mb-2'>
                    Emails
                  </h3>
                  {lead.emails && lead.emails.length > 0 ? (
                    <div className='flex flex-wrap gap-2'>
                      {lead.emails.map((email, i) => (
                        <div
                          key={i}
                          className='bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded text-sm flex items-center gap-2'
                        >
                          ✉️ {email}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className='text-sm text-gray-400 italic'>
                      None found
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Activity Log - (Kept simple for now) */}
          <div className='bg-white shadow border rounded-lg p-6'>
            <h2 className='text-xl font-semibold mb-4'>Activity</h2>
            <p className='text-gray-500'>No activities logged.</p>
          </div>
        </div>

        {/* --- Right Column --- */}
        <div className='lg:col-span-1 space-y-6'>
          {/* Market Intel */}
          <div className='bg-white shadow border rounded-lg p-6 border-l-4 border-l-blue-500'>
            <h2 className='text-xl font-semibold mb-4'>Market Intel</h2>
            {marketData ? (
              <div className='space-y-4'>
                <div>
                  <label className='text-xs uppercase font-bold text-gray-400'>
                    Est. Value (Zestimate)
                  </label>
                  <p className='text-2xl font-bold text-gray-800'>
                    {formatCurrency(marketData.zestimate)}
                  </p>
                </div>
                <div>
                  <label className='text-xs uppercase font-bold text-gray-400'>
                    Est. Rent
                  </label>
                  <p className='text-xl font-semibold text-gray-700'>
                    {formatCurrency(marketData.rentZestimate)} /mo
                  </p>
                </div>
                <div className='pt-2'>
                  <span className='inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded'>
                    Source: Bridge/Zillow
                  </span>
                </div>
              </div>
            ) : (
              <div className='text-center py-4 text-gray-500'>
                <p>No market data available.</p>
                <p className='text-xs mt-1'>
                  (The API route for Market Intel might be outdated. We can fix
                  this next.)
                </p>
              </div>
            )}
          </div>

          {/* Map Card */}
          <div className='bg-white shadow border rounded-lg p-6'>
            <h2 className='text-xl font-semibold mb-4'>Map</h2>
            {isMapLoaded && mapCenter ? (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={mapCenter}
                zoom={16}
                options={{ disableDefaultUI: true, zoomControl: true }}
              >
                <MarkerF position={mapCenter} />
              </GoogleMap>
            ) : (
              <div
                className='flex items-center justify-center bg-gray-100 rounded text-gray-500'
                style={{ height: '300px' }}
              >
                {!isMapLoaded ? 'Loading Map...' : 'Address not geocoded.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
