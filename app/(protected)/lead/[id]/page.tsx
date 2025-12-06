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

type LeadWithDetails = Schema['PropertyLead']['type'] & {
  contacts: Schema['Contact']['type'][];
  enrichments: Schema['Enrichment']['type'][];
  activities: Schema['Activity']['type'][];
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
  timeout: 10000,
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
  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: libraries,
  });

  const [lead, setLead] = useState<LeadWithDetails | null>(null);
  const [marketData, setMarketData] = useState<BridgeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
          <div className='bg-white shadow border rounded-lg p-6'>
            <h2 className='text-xl font-semibold mb-4'>Contacts</h2>
            {/* 🛑 FIX: Use optional chaining (?.) on contacts.map to prevent crashes */}
            {!lead.contacts || lead.contacts.length === 0 ? (
              <p className='text-gray-500'>No skip-trace contacts found.</p>
            ) : (
              lead.contacts?.map((contact) => (
                <div key={contact.id} className='border-b py-2 last:border-0'>
                  <p className='font-medium'>
                    {contact.firstName} {contact.lastName}
                  </p>
                  <p className='text-sm text-gray-600'>
                    Phones: {contact.phones?.length || 0}
                  </p>
                  <p className='text-sm text-gray-600'>
                    Emails: {contact.emails?.length || 0}
                  </p>
                </div>
              ))
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
