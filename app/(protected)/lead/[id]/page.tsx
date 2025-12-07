'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { type Schema } from '@/amplify/data/resource';
import { Loader } from '@aws-amplify/ui-react';
import axios from 'axios';
import {
  GoogleMap,
  MarkerF,
  useJsApiLoader,
  Libraries,
} from '@react-google-maps/api';

// --- Types ---
type BridgeData = {
  zestimate?: number;
  rentZestimate?: number;
  zillowUrl?: string;
  taxYear?: number;
  taxAssessment?: number;
  yearBuilt?: number;
  [key: string]: any;
};

// Extend schema type to include flexible contacts for the UI
// I added the optional property fields here just in case you need them later
type LeadWithDetails = Schema['PropertyLead']['type'] & {
  contacts: any[];
  enrichments: Schema['Enrichment']['type'][];
  activities: Schema['Activity']['type'][];
  propertyAddress?: string | null;
  propertyCity?: string | null;
  propertyState?: string | null;
  propertyZip?: string | null;
  yearBuilt?: number | string | null;
  squareFeet?: number | string | null;
  bedrooms?: number | string | null;
  baths?: number | string | null;
};

type LeadApiResponse = {
  success: boolean;
  lead: LeadWithDetails;
  marketAnalysis: BridgeData | null;
};

const axiosInstance = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 seconds for skip trace
});

const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '0.5rem',
  marginTop: '1.5rem',
};

// Define libraries array outside component to prevent re-renders
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
  // Load Google Maps Script
  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: libraries,
  });

  const [lead, setLead] = useState<LeadWithDetails | null>(null);
  const [marketData, setMarketData] = useState<BridgeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSkipTracing, setIsSkipTracing] = useState(false); // 👈 New Loading State
  const [error, setError] = useState<string | null>(null);
  const params = useParams();

  useEffect(() => {
    const id = params.id as string;
    if (id) {
      fetchLead(id);
    }
  }, [params.id]);

  const fetchLead = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get<LeadApiResponse>(`/leads/${id}`);
      const data = response.data;

      if (!data.success) {
        throw new Error('Failed to fetch lead data.');
      }

      setLead(data.lead);
      setMarketData(data.marketAnalysis);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 👇 HANDLE SKIP TRACE BUTTON CLICK
  const handleSkipTrace = async () => {
    if (!lead) return;
    setIsSkipTracing(true);

    try {
      let endpoint = '';
      let payload = {};

      // 1. Determine Endpoint based on Lead Type
      if (lead.type === 'probate') {
        endpoint = '/skiptrace-leads/probate';
        // Probate: Target the Administrator/Executor address ONLY
        payload = {
          address: lead.adminAddress,
          city: lead.adminCity,
          state: lead.adminState,
          zip: lead.adminZip,
        };
      } else {
        // Pre-foreclosure (Default): Target the Owner address ONLY
        endpoint = '/skiptrace-leads/preforeclosure';
        payload = {
          address: lead.ownerAddress,
          city: lead.ownerCity,
          state: lead.ownerState,
          zip: lead.ownerZip,
        };
      }

      console.log(`🚀 Skip Tracing via ${endpoint}`, payload);

      // 2. Call the API
      const response = await axiosInstance.post(endpoint, payload);

      if (response.data.success) {
        const newContacts = response.data.contacts;

        // 3. Update Local State Instantly
        setLead((prev) => {
          if (!prev) return null;

          // Safe check: Ensure we handle LazyLoader objects vs Arrays correctly
          // We treat the current contacts as 'any' to avoid the strict LazyLoader type check
          const currentContacts = (prev.contacts as any) || [];
          const safePrevContacts = Array.isArray(currentContacts)
            ? currentContacts
            : [];

          const updatedLead = {
            ...prev,
            // Force the contacts into the array structure
            contacts: [...safePrevContacts, ...newContacts] as any,
            enrichments: [
              ...((prev.enrichments as any) || []),
              {
                id: Date.now().toString(),
                source: `BatchData (${lead.type})`,
                statusText: `Found ${newContacts.length} contacts`,
                createdAt: new Date().toISOString(),
              } as any,
            ] as any,
          };

          // Final cast to force the state update to be accepted
          return updatedLead as unknown as typeof prev;
        });
      } else {
        alert('No contacts found.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Skip trace failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSkipTracing(false);
    }
  };

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

  const mapCenter =
    lead.latitude && lead.longitude
      ? { lat: lead.latitude, lng: lead.longitude }
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
                <p className='text-base'>{lead.skipTraceStatus}</p>
              </div>
              <div>
                <label className='text-sm font-medium text-gray-500'>
                  Year Built
                </label>
                <p className='text-base'>
                  {lead.yearBuilt || marketData?.yearBuilt || 'N/A'}
                </p>
              </div>
              <div>
                <label className='text-sm font-medium text-gray-500'>
                  Sq. Ft.
                </label>
                <p className='text-base'>{lead.squareFeet || 'N/A'}</p>
              </div>
              <div>
                <label className='text-sm font-medium text-gray-500'>
                  Bedrooms
                </label>
                <p className='text-base'>{lead.bedrooms || 'N/A'}</p>
              </div>
              <div>
                <label className='text-sm font-medium text-gray-500'>
                  Bathrooms
                </label>
                <p className='text-base'>{lead.baths || 'N/A'}</p>
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

          {/* Contacts Card with Skip Trace Button */}
          <div className='bg-white shadow border rounded-lg p-6 relative'>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-xl font-semibold'>Contacts</h2>
              {/* 👇 SKIP TRACE BUTTON */}
              <button
                onClick={handleSkipTrace}
                disabled={isSkipTracing}
                className='text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center gap-2'
              >
                {isSkipTracing && <Loader size='small' variation='linear' />}
                {isSkipTracing ? 'Tracing...' : 'Skip Trace Owner'}
              </button>
            </div>

            {!lead.contacts || lead.contacts.length === 0 ? (
              <div className='text-center py-6 bg-gray-50 rounded border border-dashed'>
                <p className='text-gray-500 mb-2'>No contact info available.</p>
                <p className='text-xs text-gray-400'>
                  Click "Skip Trace Owner" to find phone numbers.
                </p>
              </div>
            ) : (
              <div className='space-y-4'>
                {lead.contacts.map((contact, idx) => (
                  <div
                    key={contact.id || idx}
                    className='border-b pb-4 last:border-0 last:pb-0'
                  >
                    <div className='flex items-baseline justify-between'>
                      <p className='font-bold text-lg text-gray-800'>
                        {contact.firstName} {contact.lastName}
                      </p>
                      <span className='text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full'>
                        Match Found
                      </span>
                    </div>

                    {/* Phone Numbers */}
                    <div className='mt-2'>
                      <p className='text-xs font-semibold text-gray-500 uppercase'>
                        Phone Numbers
                      </p>
                      {contact.phones && contact.phones.length > 0 ? (
                        <div className='flex flex-wrap gap-2 mt-1'>
                          {contact.phones.map((phone: string, pIdx: number) => (
                            <span
                              key={pIdx}
                              className='text-sm bg-gray-100 px-2 py-1 rounded text-gray-700 font-mono'
                            >
                              {phone}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className='text-sm text-gray-400 italic'>
                          None found
                        </p>
                      )}
                    </div>

                    {/* Emails */}
                    <div className='mt-2'>
                      <p className='text-xs font-semibold text-gray-500 uppercase'>
                        Emails
                      </p>
                      {contact.emails && contact.emails.length > 0 ? (
                        <div className='flex flex-wrap gap-2 mt-1'>
                          {contact.emails.map((email: string, eIdx: number) => (
                            <span
                              key={eIdx}
                              className='text-sm text-blue-600 underline'
                            >
                              {email}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className='text-sm text-gray-400 italic'>
                          None found
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Card */}
          <div className='bg-white shadow border rounded-lg p-6'>
            <h2 className='text-xl font-semibold mb-4'>Activity</h2>
            {!lead.activities || lead.activities.length === 0 ? (
              <p className='text-gray-500'>No activities logged.</p>
            ) : (
              lead.activities?.map((activity) => (
                <div key={activity.id} className='border-b py-2 last:border-0'>
                  <p className='font-medium capitalize'>{activity.type}</p>
                  <p className='text-sm text-gray-600'>
                    Outcome: {activity.outcome}
                  </p>
                  <p className='text-sm text-gray-400'>
                    {new Date(Number(activity.createdAt)).toLocaleString()}
                  </p>
                </div>
              ))
            )}
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
                {marketData.taxAssessment && (
                  <div>
                    <label className='text-xs uppercase font-bold text-gray-400'>
                      Tax Assessment
                    </label>
                    <p className='text-lg text-gray-600'>
                      {formatCurrency(marketData.taxAssessment)}
                    </p>
                  </div>
                )}
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
                  Check if latitude/longitude are valid.
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

          {/* Enrichments Log */}
          <div className='bg-white shadow border rounded-lg p-6'>
            <h2 className='text-xl font-semibold mb-4'>Data Log</h2>
            {!lead.enrichments || lead.enrichments.length === 0 ? (
              <p className='text-gray-500'>No enrichments found.</p>
            ) : (
              <div className='space-y-2'>
                {lead.enrichments?.map((enrichment) => (
                  <div
                    key={enrichment.id}
                    className='text-xs border-b pb-2 last:border-0'
                  >
                    <p className='font-medium'>{enrichment.source}</p>
                    <p className='text-gray-500'>
                      Status: {enrichment.statusText}
                    </p>
                    <p className='text-gray-400'>
                      {new Date(
                        Number(enrichment.createdAt)
                      ).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
