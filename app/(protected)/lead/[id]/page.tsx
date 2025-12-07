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

// 👇 Import the types from your new file
import {
  type LeadWithDetails,
  type BridgeData,
  type LeadApiResponse,
} from '@/app/types/leads';

// ... (Rest of your imports) ...

const axiosInstance = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

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

  // Now using the imported types
  const [lead, setLead] = useState<LeadWithDetails | null>(null);
  const [marketData, setMarketData] = useState<BridgeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSkipTracing, setIsSkipTracing] = useState(false);
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
      // Fetch from your Next.js API route that aggregates Lead + Market Data
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

  // 👇 HANDLE SKIP TRACE (With Status Check & Update)
  const handleSkipTrace = async () => {
    if (!lead) return;

    // 🛑 1. PREVENT DUPLICATE SKIP TRACE
    if (lead.skipTraceStatus === 'COMPLETED') {
      alert('This lead has already been skip traced.');
      return;
    }

    setIsSkipTracing(true);

    try {
      let endpoint = '';
      let payload = {};

      if (lead.type === 'probate') {
        endpoint = '/skiptrace-leads/probate';
        payload = {
          address: lead.adminAddress,
          city: lead.adminCity,
          state: lead.adminState,
          zip: lead.adminZip,
          firstName: lead.adminFirstName,
          lastName: lead.adminLastName,
        };
      } else {
        endpoint = '/skiptrace-leads/preforeclosure';
        payload = {
          address: lead.ownerAddress,
          city: lead.ownerCity,
          state: lead.ownerState,
          zip: lead.ownerZip,
          firstName: lead.ownerFirstName,
          lastName: lead.ownerLastName,
        };
      }

      console.log(`🚀 Requesting Skip Trace via ${endpoint}`, payload);

      // 2. Call the API (Mock or Prod)
      const response = await axiosInstance.post(endpoint, payload);
      console.log('🔍 API RESPONSE:', response.data);

      if (response.data.success) {
        const newContacts = response.data.contacts;

        // 3. Save Contacts & Update Lead Status in Database
        try {
          // A. Save Contacts
          const savePromises = newContacts.map((contact: any) =>
            client.models.Contact.create({
              leadId: lead.id,
              firstName: contact.firstName,
              lastName: contact.lastName,
              middleName: contact.middleName,
              phones: contact.phones,
              emails: contact.emails,
              addresses: contact.addresses,
              litigator: contact.litigator,
              deceased: contact.deceased,
            })
          );

          // B. Update Lead Status to COMPLETED
          const updateLeadStatus = client.models.PropertyLead.update({
            id: lead.id,
            skipTraceStatus: 'COMPLETED',
          });

          // Run both operations
          await Promise.all([...savePromises, updateLeadStatus]);

          console.log(
            '💾 Database successfully updated (Contacts Saved + Status Completed)'
          );
        } catch (dbError) {
          console.error('❌ Failed to save to DB:', dbError);
          alert(
            'Contacts found but failed to save to database. Check console.'
          );
        }

        // 4. Update Local State (UI)
        setLead((prev) => {
          if (!prev) return null;

          const currentContacts = (prev.contacts as any) || [];
          const safePrevContacts = Array.isArray(currentContacts)
            ? currentContacts
            : [];

          const updatedLead = {
            ...prev,
            skipTraceStatus: 'COMPLETED', // 👈 Update Status in UI immediately
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

          return updatedLead as unknown as typeof prev;
        });
      } else {
        alert('No contacts found.');
      }
    } catch (err: any) {
      console.error('❌ Skip trace error:', err);
      alert('Skip trace failed: ' + (err.response?.data?.error || err.message));
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

          {/* Contacts Card */}
          <div className='bg-white shadow border rounded-lg p-6 relative'>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-xl font-semibold'>Contacts</h2>
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
              <div className='space-y-6'>
                {lead.contacts.map((contact, idx) => (
                  <div
                    key={contact.id || idx}
                    className='border-b pb-4 last:border-0 last:pb-0'
                  >
                    {/* Header: Name + Badges */}
                    <div className='flex items-baseline justify-between'>
                      <div className='flex items-center gap-2 flex-wrap'>
                        <p className='font-bold text-lg text-gray-800'>
                          {contact.firstName} {contact.middleName}{' '}
                          {contact.lastName}
                        </p>
                        {contact.deceased && (
                          <span className='bg-red-100 text-red-800 text-[10px] px-2 py-0.5 rounded border border-red-200 uppercase font-semibold'>
                            Deceased
                          </span>
                        )}
                        {contact.litigator && (
                          <span className='bg-orange-100 text-orange-800 text-[10px] px-2 py-0.5 rounded border border-orange-200 uppercase font-semibold'>
                            Litigator
                          </span>
                        )}
                      </div>
                      <span className='text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full whitespace-nowrap'>
                        Match Found
                      </span>
                    </div>

                    {/* Addresses */}
                    <div className='mt-2'>
                      <p className='text-xs font-semibold text-gray-500 uppercase'>
                        Addresses
                      </p>
                      {contact.addresses && contact.addresses.length > 0 ? (
                        <div className='mt-1 space-y-1'>
                          {contact.addresses.map((addr: any, i: number) => (
                            <p key={i} className='text-sm text-gray-700'>
                              {addr.fullAddress}
                              {addr.type === 'Mailing' && (
                                <span className='text-xs text-blue-600 ml-2 font-medium bg-blue-50 px-1 rounded'>
                                  (Mailing)
                                </span>
                              )}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className='text-sm text-gray-400 italic'>
                          No addresses found
                        </p>
                      )}
                    </div>

                    {/* Phone Numbers */}
                    <div className='mt-3'>
                      <p className='text-xs font-semibold text-gray-500 uppercase'>
                        Phone Numbers
                      </p>
                      {contact.phones && contact.phones.length > 0 ? (
                        <div className='flex flex-wrap gap-2 mt-1'>
                          {contact.phones.map((phone: any, pIdx: number) => (
                            <div
                              key={pIdx}
                              className='text-sm bg-gray-100 px-2 py-1 rounded text-gray-700 font-mono flex items-center gap-2 border border-gray-200'
                            >
                              <span>{phone.number}</span>
                              {phone.type && (
                                <span
                                  className={`text-[10px] uppercase px-1 rounded ${
                                    phone.type === 'Mobile'
                                      ? 'bg-blue-100 text-blue-700 font-bold'
                                      : 'bg-gray-200 text-gray-600'
                                  }`}
                                >
                                  {phone.type}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className='text-sm text-gray-400 italic'>
                          None found
                        </p>
                      )}
                    </div>

                    {/* Emails */}
                    <div className='mt-3'>
                      <p className='text-xs font-semibold text-gray-500 uppercase'>
                        Emails
                      </p>
                      {contact.emails && contact.emails.length > 0 ? (
                        <div className='flex flex-wrap gap-2 mt-1'>
                          {contact.emails.map((emailObj: any, eIdx: number) => (
                            <span
                              key={eIdx}
                              className='text-sm text-blue-600 underline cursor-pointer hover:text-blue-800'
                            >
                              {emailObj.email}
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

          {/* Activity Log */}
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
