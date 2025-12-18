'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { ContactActionItem } from '@/app/components/leadDetails/ContactActionItem';

// 👇 UTILS
import { client } from '@/app/utils/aws/data/frontEndClient';
import { type Schema } from '@/amplify/data/resource';

type Lead = Schema['PropertyLead']['type'] & {
  notes?: string | null;
  ghlSyncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  ghlContactId?: string | null;
  ghlSyncDate?: string | null;
};

const libraries: Libraries = ['places'];
const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '0.5rem',
  marginTop: '1.5rem',
};

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

interface LeadDetailClientProps {
  initialLead: Lead;
}

export function LeadDetailClient({ initialLead }: LeadDetailClientProps) {
  const router = useRouter();

  // 1. STATE MANAGEMENT
  const [lead, setLead] = useState<Lead>(initialLead);
  const [marketData, setMarketData] = useState<any | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSkipTracing, setIsSkipTracing] = useState(false);
  const [navContext, setNavContext] = useState<NavContext | null>(null);
  const [isCoreInfoEditing, setIsCoreInfoEditing] = useState(false);

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: libraries,
  });

  // 2. FETCH BRIDGEAPI MARKET DATA
  useEffect(() => {
    setLead(initialLead);

    const fetchMarketIntel = async () => {
      // Ensure we have a property address to search
      if (!initialLead.ownerAddress) return;

      setIsAnalyzing(true);
      try {
        // Construct the full search string for Google -> Bridge validation
        const fullAddress = `${initialLead.ownerAddress}, ${initialLead.ownerCity}, ${initialLead.ownerState} ${initialLead.ownerZip}`;

        const response = await axios.post('/api/v1/analyze-property', {
          address: fullAddress,
        });

        if (response.data.success) {
          setMarketData(response.data);
        }
      } catch (err) {
        console.error('BridgeAPI Error:', err);
        setMarketData(null);
      } finally {
        setIsAnalyzing(false);
      }
    };

    fetchMarketIntel();
  }, [initialLead]);

  // 3. NAVIGATION LOGIC
  const loadNavigationContext = useCallback(() => {
    if (typeof window === 'undefined') return;
    const contextString = sessionStorage.getItem('leadNavContext');
    if (!contextString) return;
    try {
      const context = JSON.parse(contextString);
      const leadIds: string[] = context.ids || [];
      const currentIndex = leadIds.findIndex(
        (id: string) => id === initialLead.id
      );
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
  }, [initialLead.id]);

  useEffect(() => {
    loadNavigationContext();
  }, [loadNavigationContext]);

  const navigateToLead = (direction: 'prev' | 'next') => {
    if (!navContext) return;
    const newIndex =
      direction === 'next'
        ? navContext.currentIndex + 1
        : navContext.currentIndex - 1;
    if (newIndex >= 0 && newIndex < navContext.ids.length) {
      router.push(`/lead/${navContext.ids[newIndex]}`);
    }
  };

  // 4. HANDLERS
  const handleSkipTrace = async () => {
    if (lead.skipTraceStatus === 'COMPLETED') return;
    setIsSkipTracing(true);
    try {
      const { errors } = await client.mutations.skipTraceLeads({
        leadIds: [lead.id],
      });
      if (errors) throw new Error(errors.map((e) => e.message).join(' | '));

      const { data } = await client.models.PropertyLead.get({ id: lead.id });
      if (data) setLead(data as Lead);
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

  const mapCenter =
    lead.latitude && lead.longitude
      ? { lat: Number(lead.latitude), lng: Number(lead.longitude) }
      : null;

  return (
    <main className='max-w-6xl mx-auto py-6 px-6'>
      {/* HEADER & NAVIGATION */}
      <div className='flex flex-row items-center justify-between mb-6 border-b pb-4 border-gray-100'>
        <div className='flex items-center gap-6'>
          <h1 className='text-2xl font-bold text-gray-800'>Lead Detail</h1>
          {navContext && (
            <div className='flex items-center gap-1 bg-gray-50 border rounded-full px-3 py-1 text-gray-500 shadow-sm'>
              <button
                onClick={() => navigateToLead('prev')}
                disabled={navContext.isFirst}
                className='p-1 rounded-full text-gray-700 hover:bg-white disabled:opacity-30 transition'
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  width='18'
                  height='18'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2.5'
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
                className='p-1 rounded-full text-gray-700 hover:bg-white disabled:opacity-30 transition'
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  width='18'
                  height='18'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2.5'
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

      {/* HERO SECTION */}
      <div className='mb-6'>
        <h2 className='text-3xl font-extrabold text-slate-900 tracking-tight'>
          {lead.ownerAddress || 'No Address Found'}
        </h2>
        <p className='text-lg text-slate-500 font-medium -mt-1'>
          {lead.ownerCity}, {lead.ownerState} {lead.ownerZip}
        </p>
      </div>

      <div className='flex flex-col md:flex-row gap-8'>
        {/* LEFT COLUMN: CORE INFO & CONTACTS */}
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
                <p className='capitalize'>{lead.type?.toLowerCase()}</p>
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
          </div>

          <div className='bg-white shadow border rounded-lg p-6 relative'>
            <div className='flex justify-between items-center mb-6'>
              <h2 className='text-xl font-semibold text-gray-800'>Contacts</h2>
              <button
                onClick={handleSkipTrace}
                disabled={isSkipTracing || lead.skipTraceStatus === 'COMPLETED'}
                className={`text-sm px-4 py-2 rounded-md font-medium transition ${lead.skipTraceStatus === 'COMPLETED' ? 'bg-green-50 text-green-700 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
              >
                {isSkipTracing
                  ? 'Tracing...'
                  : lead.skipTraceStatus === 'COMPLETED'
                    ? '✓ Skiptrace Complete'
                    : 'Skip Trace Owner'}
              </button>
            </div>
            {!lead.phones?.length && !lead.emails?.length ? (
              <div className='text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300'>
                <p className='text-gray-500 font-medium'>
                  No contact info available.
                </p>
              </div>
            ) : (
              <div className='space-y-6'>
                <div>
                  <h3 className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-3'>
                    Phone Numbers
                  </h3>
                  <div className='grid grid-cols-1 gap-2'>
                    {lead.phones?.map(
                      (phone, i) =>
                        phone && (
                          <ContactActionItem
                            key={i}
                            value={phone}
                            type='phone'
                          />
                        )
                    )}
                  </div>
                </div>
                {/* Emails section */}
                {lead.emails && lead.emails.length > 0 && (
                  <div>
                    <h3 className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-3'>
                      Emails
                    </h3>
                    <div className='grid grid-cols-1 gap-2'>
                      {lead.emails.map(
                        (email, i) =>
                          email && (
                            <ContactActionItem
                              key={i}
                              value={email}
                              type='email'
                            />
                          )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: GHL ACTIONS, MARKET INTEL & MAP */}
        <div className='w-full md:w-1/3 space-y-6'>
          <GhlActions
            leadId={lead.id}
            ghlContactId={lead.ghlContactId}
            ghlSyncStatus={lead.ghlSyncStatus}
            onSyncComplete={async () => {
              const { data } = await client.models.PropertyLead.get({
                id: lead.id,
              });
              if (data) setLead(data as Lead);
            }}
            client={client}
          />

          {/* MARKET INTEL CARD */}
          <div className='bg-white shadow border rounded-lg p-6 border-l-4 border-l-blue-500'>
            <h2 className='text-xl font-semibold mb-4'>Market Intel</h2>

            {isAnalyzing ? (
              <div className='animate-pulse space-y-3'>
                <div className='h-4 bg-gray-200 rounded w-1/2'></div>
                <div className='h-8 bg-gray-200 rounded w-3/4'></div>
                <div className='h-4 bg-gray-200 rounded w-1/3'></div>
                <div className='h-6 bg-gray-200 rounded w-2/3'></div>
              </div>
            ) : marketData ? (
              <div className='space-y-4 animate-in fade-in duration-500'>
                <div>
                  <label className='text-xs uppercase font-bold text-gray-400'>
                    Zestimate
                  </label>
                  <p className='text-2xl font-bold text-blue-600'>
                    {formatCurrency(marketData.zestimate)}
                  </p>
                </div>
                <div>
                  <label className='text-xs uppercase font-bold text-gray-400'>
                    Rent Zestimate
                  </label>
                  <p className='text-xl font-semibold'>
                    {formatCurrency(marketData.rentZestimate)} /mo
                  </p>
                </div>
                <div>
                  <label className='text-xs uppercase font-bold text-gray-400'>
                    Est. Cash Offer (75%)
                  </label>
                  <p className='text-xl font-semibold text-green-600'>
                    {formatCurrency(marketData.cashOffer)}
                  </p>
                </div>
                <div className='pt-2 border-t text-[10px] text-gray-400 italic'>
                  Source: Zillow BridgeAPI
                </div>
              </div>
            ) : (
              <p className='text-sm text-gray-400 italic'>
                No market data found for this property.
              </p>
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
                Map Loading...
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
