// app/(protected)/lead/[id]/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader } from '@aws-amplify/ui-react';
import axios from 'axios';
import {
  GoogleMap,
  MarkerF,
  useJsApiLoader,
  Libraries,
} from '@react-google-maps/api';

// 👇 COMPONENTS
import { CoreLeadInfo } from '@/app/components/leadDetails/CoreLeadInfo';
import { GhlActions } from '@/app/components/leadDetails/GhlActions';
import { LeadStatusBadge } from '@/app/components/leadDetails/LeadStatusBadge';
import { CardWrapper } from '@/app/components/leadDetails/CardWrapper';

// 👇 UTILS
import { client } from '@/app/utils/aws/data/frontEndClient';
import { type Schema } from '@/amplify/data/resource';

type Lead = Schema['PropertyLead']['type'] & {
  notes?: string | null;
  ghlSyncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  ghlContactId?: string | null;
  ghlSyncDate?: string | null;
};

const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '0.5rem',
  marginTop: '1.5rem',
};

const libraries: Libraries = ['places'];

const formatCurrency = (value?: number | string | null) => {
  if (!value || isNaN(Number(value))) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value));
};

interface NavContext {
  ids: string[];
  currentIndex: number;
  isFirst: boolean;
  isLast: boolean;
}

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const currentLeadId = params.id as string;

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
  const [navContext, setNavContext] = useState<NavContext | null>(null);
  const [isCoreInfoEditing, setIsCoreInfoEditing] = useState(false);

  const loadNavigationContext = useCallback(() => {
    if (typeof window === 'undefined') return;
    const contextString = sessionStorage.getItem('leadNavContext');
    if (!contextString) return;
    try {
      const context = JSON.parse(contextString);
      const leadIds: string[] = context.ids || [];
      const currentIndex = leadIds.findIndex((id) => id === currentLeadId);
      if (currentIndex !== -1) {
        setNavContext({
          ids: leadIds,
          currentIndex: currentIndex,
          isFirst: currentIndex === 0,
          isLast: currentIndex === leadIds.length - 1,
        });
      }
    } catch (e) {
      console.error('Error loading navigation context:', e);
    }
  }, [currentLeadId]);

  const navigateToLead = (direction: 'prev' | 'next') => {
    if (!navContext) return;
    const newIndex =
      direction === 'next'
        ? navContext.currentIndex + 1
        : navContext.currentIndex - 1;
    if (newIndex >= 0 && newIndex < navContext.ids.length) {
      const nextId = navContext.ids[newIndex];
      router.push(`/lead/${nextId}`);
    }
  };

  const loadData = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: leadData, errors } = await client.models.PropertyLead.get({
        id,
      });
      if (errors || !leadData)
        throw new Error('Could not find lead in database.');
      setLead(leadData as Lead);

      try {
        const response = await axios.get(`/api/v1/leads/${id}`);
        setMarketData(response.data?.marketAnalysis || null);
      } catch (marketError) {
        setMarketData(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load lead.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSkipTrace = async () => {
    if (!lead || lead.skipTraceStatus === 'COMPLETED') return;
    setIsSkipTracing(true);
    try {
      const { errors } = await client.mutations.skipTraceLeads({
        leadIds: [lead.id],
      });
      if (errors) throw new Error(errors.map((e) => e.message).join(' | '));
      await loadData(lead.id);
      alert('Skip Trace Complete!');
    } catch (err: any) {
      alert(`Skip trace failed: ${err.message}`);
    } finally {
      setIsSkipTracing(false);
    }
  };

  const handleLeadUpdate = (updatedLead: Lead) => {
    setLead(updatedLead);
    setIsCoreInfoEditing(false);
  };

  const handleGhlSyncComplete = () => {
    loadData(currentLeadId);
  };

  useEffect(() => {
    if (currentLeadId) {
      loadData(currentLeadId);
      loadNavigationContext();
    }
  }, [currentLeadId, loadData, loadNavigationContext]);

  if (isLoading)
    return (
      <main className='max-w-4xl mx-auto py-10 px-6 text-center'>
        <Loader size='large' />
      </main>
    );
  if (error)
    return (
      <main className='max-w-4xl mx-auto py-10 px-6'>
        <h1 className='text-3xl font-bold text-red-600'>Error</h1>
        <p>{error}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className='mt-4 bg-gray-200 px-4 py-2 rounded-md'
        >
          ← Go to Dashboard
        </button>
      </main>
    );
  if (!lead)
    return (
      <main className='max-w-4xl mx-auto py-10 px-6'>
        <h1 className='text-3xl font-bold'>Lead Not Found</h1>
      </main>
    );

  const mapCenter =
    lead.latitude && lead.longitude
      ? { lat: Number(lead.latitude), lng: Number(lead.longitude) }
      : null;

  return (
    <main className='max-w-6xl mx-auto py-6 px-6'>
      {/* 1. TIGHT HEADER ROW */}
      <div className='flex flex-row items-center justify-between mb-6 border-b pb-4 border-gray-100'>
        <div className='flex items-center gap-6'>
          <h1 className='text-2xl font-bold text-gray-800'>Lead Detail</h1>
          {navContext && (
            <div className='flex items-center gap-1 bg-gray-50 border rounded-full px-3 py-1 text-gray-500 shadow-sm'>
              <button
                onClick={() => navigateToLead('prev')}
                disabled={navContext.isFirst}
                className='p-1 rounded-full text-gray-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition'
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  width='18'
                  height='18'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2.5'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  <path d='m15 18-6-6 6-6' />
                </svg>
              </button>
              <span className='px-2 text-xs font-bold tracking-tighter'>
                {navContext.currentIndex + 1} / {navContext.ids.length}
              </span>
              <button
                onClick={() => navigateToLead('next')}
                disabled={navContext.isLast}
                className='p-1 rounded-full text-gray-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition'
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  width='18'
                  height='18'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2.5'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  <path d='m9 18 6-6-6-6' />
                </svg>
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className='text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors'
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* 2. HERO ADDRESS */}
      <div className='mb-6'>
        <h2 className='text-3xl font-extrabold text-slate-900 tracking-tight'>
          {lead.ownerAddress}
        </h2>
        <p className='text-lg text-slate-500 font-medium -mt-1'>
          {lead.ownerCity}, {lead.ownerState} {lead.ownerZip}
        </p>
      </div>

      <div className='flex flex-col md:flex-row gap-8'>
        {/* LEFT COLUMN */}
        <div className='w-full md:w-2/3 space-y-6'>
          <CardWrapper
            title='Core Lead Information'
            isEditable={true}
            onEditToggle={setIsCoreInfoEditing}
          >
            <CoreLeadInfo
              lead={lead}
              onUpdate={handleLeadUpdate}
              client={client}
              isEditing={isCoreInfoEditing}
              onEditToggle={setIsCoreInfoEditing}
            />
          </CardWrapper>

          <div className='bg-white shadow border rounded-lg p-6'>
            <h2 className='text-xl font-semibold mb-4'>Property Details</h2>
            <div className='grid grid-cols-3 gap-4'>
              <div>
                <label className='text-sm font-medium text-gray-500'>
                  Type
                </label>
                <p className='capitalize'>{lead.type}</p>
              </div>
              <div>
                <label className='text-sm font-medium text-gray-500'>
                  Skip Trace Status
                </label>
                <div>
                  <LeadStatusBadge
                    type='SKIP_TRACE'
                    status={lead.skipTraceStatus}
                  />
                </div>
              </div>
              <div>
                <label className='text-sm font-medium text-gray-500'>
                  Source
                </label>
                <p>CSV Import</p>
              </div>
            </div>
            {lead.type === 'probate' && (
              <div className='mt-6 pt-6 border-t'>
                <h3 className='text-lg font-semibold mb-2'>Executor Info</h3>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label className='text-sm font-medium text-gray-500'>
                      Name
                    </label>
                    <p>
                      {lead.adminFirstName} {lead.adminLastName}
                    </p>
                  </div>
                  <div>
                    <label className='text-sm font-medium text-gray-500'>
                      Mailing Address
                    </label>
                    <p>{lead.adminAddress || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className='bg-white shadow border rounded-lg p-6'>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-xl font-semibold'>Contacts</h2>
              <button
                onClick={handleSkipTrace}
                disabled={isSkipTracing || lead.skipTraceStatus === 'COMPLETED'}
                className={`text-sm px-3 py-1.5 rounded transition ${lead.skipTraceStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
              >
                {isSkipTracing
                  ? 'Tracing...'
                  : lead.skipTraceStatus === 'COMPLETED'
                    ? '✓ Complete'
                    : 'Skip Trace Owner'}
              </button>
            </div>
            {!lead.phones?.length && !lead.emails?.length ? (
              <div className='text-center py-6 bg-gray-50 rounded border border-dashed text-gray-500'>
                No contact info. Run Skip Trace.
              </div>
            ) : (
              <div className='space-y-4'>
                <div>
                  <h3 className='text-xs font-bold text-gray-500 uppercase mb-2'>
                    Phones
                  </h3>
                  <div className='flex flex-wrap gap-2'>
                    {lead.phones?.map((p, i) => (
                      <span
                        key={i}
                        className='bg-green-50 text-green-800 border px-3 py-1 rounded text-sm font-mono'
                      >
                        📞 {p}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className='text-xs font-bold text-gray-500 uppercase mb-2'>
                    Emails
                  </h3>
                  <div className='flex flex-wrap gap-2'>
                    {lead.emails?.map((e, i) => (
                      <span
                        key={i}
                        className='bg-blue-50 text-blue-800 border px-3 py-1 rounded text-sm'
                      >
                        ✉️ {e}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className='w-full md:w-1/3 space-y-6'>
          <GhlActions
            leadId={lead.id}
            ghlContactId={lead.ghlContactId}
            ghlSyncStatus={lead.ghlSyncStatus}
            onSyncComplete={handleGhlSyncComplete}
            client={client}
          />

          <div className='bg-white shadow border rounded-lg p-6 border-l-4 border-l-blue-500'>
            <h2 className='text-xl font-semibold mb-4'>Market Intel</h2>
            {marketData ? (
              <div className='space-y-4'>
                <div>
                  <label className='text-xs uppercase font-bold text-gray-400'>
                    Zestimate
                  </label>
                  <p className='text-2xl font-bold'>
                    {formatCurrency(marketData.zestimate)}
                  </p>
                </div>
                <div>
                  <label className='text-xs uppercase font-bold text-gray-400'>
                    Est. Rent
                  </label>
                  <p className='text-xl font-semibold'>
                    {formatCurrency(marketData.rentZestimate)} /mo
                  </p>
                </div>
              </div>
            ) : (
              <p className='text-gray-500'>No market data available.</p>
            )}
          </div>

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
              <div className='flex items-center justify-center bg-gray-100 rounded text-gray-500 h-[300px]'>
                Map Loading or No Data
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
