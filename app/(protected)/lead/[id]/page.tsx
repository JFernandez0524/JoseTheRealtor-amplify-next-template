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

// 👇 IMPORT COMPONENTS FROM the dedicated subdirectory
import { CoreLeadInfo } from '@/app/components/leadDetails/CoreLeadInfo';
import { GhlActions } from '@/app/components/leadDetails/GhlActions';
import { LeadStatusBadge } from '@/app/components/leadDetails/LeadStatusBadge';
import { CardWrapper } from '@/app/components/leadDetails/CardWrapper';

// 👇 Import your frontend client
import { client } from '@/app/utils/aws/data/frontEndClient';
// 👇 Import the Schema type directly to ensure type safety
import { type Schema } from '@/amplify/data/resource';

// Define the shape of our Lead based on the Schema (Extended for custom/backend fields)
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

// --- TYPE: Navigation Context ---
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
  const [isCoreInfoEditing, setIsCoreInfoEditing] = useState(false); // --- NAVIGATION LOGIC ---

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
  }; // --- Data Fetching/Update Logic ---

  const loadData = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: leadData, errors } = await client.models.PropertyLead.get({
        id: id,
      });

      if (errors || !leadData) {
        throw new Error('Could not find lead in database.');
      }
      setLead(leadData as Lead);

      try {
        // Fetch market data via API route
        const response = await axios.get(`/api/v1/leads/${id}`);
        if (response.data && response.data.marketAnalysis) {
          setMarketData(response.data.marketAnalysis);
        } else {
          setMarketData(null);
        }
      } catch (marketError) {
        console.warn('Market Data API failed, but Lead loaded.', marketError);
        setMarketData(null);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load lead.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSkipTrace = async () => {
    if (!lead) return;
    if (lead.skipTraceStatus === 'COMPLETED') return;

    setIsSkipTracing(true);
    try {
      const { errors } = await client.mutations.skipTraceLeads({
        leadIds: [lead.id],
      });
      if (errors) {
        throw new Error(
          errors.map((e) => e.message).join(' | ') ||
            'Skip Trace failed to execute mutation.'
        );
      }
      await loadData(lead.id);
      alert('Skip Trace Complete! Refreshing data...');
    } catch (err: any) {
      console.error('Skip trace failed:', err);
      alert(`Skip trace failed: ${err.message || 'Please try again.'}`);
    } finally {
      setIsSkipTracing(false);
    }
  };

  const handleLeadUpdate = (updatedLead: Lead) => {
    setLead(updatedLead); // Ensure edit mode closes after a successful update
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
  }, [currentLeadId, loadData, loadNavigationContext]); // --- RENDER ---

  if (isLoading) {
    return (
      <main className='max-w-4xl mx-auto py-10 px-6 text-center'>
                <Loader size='large' />     {' '}
      </main>
    );
  }
  if (error) {
    return (
      <main className='max-w-4xl mx-auto py-10 px-6'>
                <h1 className='text-3xl font-bold text-red-600'>Error</h1>     
          <p>{error}</p>       {' '}
        <button
          onClick={() => router.push('/dashboard')}
          className='mt-4 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300'
        >
                    ← Go to Dashboard        {' '}
        </button>
             {' '}
      </main>
    );
  }
  if (!lead) {
    return (
      <main className='max-w-4xl mx-auto py-10 px-6'>
                <h1 className='text-3xl font-bold'>Lead Not Found</h1>     {' '}
      </main>
    );
  }

  const mapCenter =
    lead.latitude && lead.longitude
      ? { lat: Number(lead.latitude), lng: Number(lead.longitude) }
      : null;

  return (
    <main className='max-w-6xl mx-auto py-10 px-6'>
           {' '}
      <div className='flex justify-between items-center mb-8'>
               {/* 1. NAVIGATION ARROWS BLOCK */}       {' '}
        <div className='flex items-center gap-4'>
                   {' '}
          <h1 className='text-3xl font-bold text-gray-800'>Lead Detail</h1>     
             {' '}
          {navContext && (
            <div className='flex gap-2 text-gray-500 items-center border rounded-full p-1 bg-gray-50'>
                            {/* Previous Button */}             {' '}
              <button
                onClick={() => navigateToLead('prev')}
                disabled={navContext.isFirst}
                className='p-1 rounded-full text-gray-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition'
                title='Previous Lead'
              >
                               {' '}
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  width='20'
                  height='20'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  {' '}
                  <path d='m15 18-6-6 6-6' />{' '}
                </svg>
                             {' '}
              </button>
                           {' '}
              <span className='px-2 text-sm font-medium'>
                                {navContext.currentIndex + 1} /{' '}
                {navContext.ids.length}             {' '}
              </span>
                           {' '}
              <button
                onClick={() => navigateToLead('next')}
                disabled={navContext.isLast}
                className='p-1 rounded-full text-gray-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition'
                title='Next Lead'
              >
                               {' '}
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  width='20'
                  height='20'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  {' '}
                  <path d='m9 18 6-6-6-6' />{' '}
                </svg>
                             {' '}
              </button>
                         {' '}
            </div>
          )}
                 {' '}
        </div>
                {/* 2. Back Button */}       {' '}
        <button
          onClick={() => router.push('/dashboard')}
          className='bg-white border text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition shadow-sm'
        >
                    ← Back to Dashboard        {' '}
        </button>
             {' '}
      </div>
            {/* Lead Information */}     {' '}
      <div className='mb-8'>
                <h2 className='text-3xl font-bold'>{lead.ownerAddress}</h2>     
         {' '}
        <p className='text-lg text-gray-600'>
                    {lead.ownerCity}, {lead.ownerState} {lead.ownerZip}     
           {' '}
        </p>
             {' '}
      </div>
           {' '}
      {/* 💥 FINAL LAYOUT: Using md:flex to ensure two columns display horizontally */}
           {' '}
      <div className='flex flex-col md:flex-row gap-8'>
               {' '}
        {/* --- LEFT COLUMN (2/3 width from MD breakpoint up: Core Info, Details, Contacts) --- */}
               {' '}
        <div className='w-full md:w-2/3 space-y-6'>
                   {/* 1. CORE LEAD INFO CARD (Editable) */}
          <CardWrapper
            title='Core Lead Information (Editable)'
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
                    {/* 2. PROPERTY DETAILS Card (STATIC) */}         {' '}
          <div className='bg-white shadow border rounded-lg p-6'>
                       {' '}
            <h2 className='text-xl font-semibold mb-4'>Property Details</h2>   
                   {' '}
            <div className='grid grid-cols-3 gap-4'>
                           {' '}
              <div>
                               {' '}
                <label className='text-sm font-medium text-gray-500'>
                  Type
                </label>
                               {' '}
                <p className='text-base capitalize'>{lead.type}</p>           
                 {' '}
              </div>
                           {' '}
              <div>
                               {' '}
                <label className='text-sm font-medium text-gray-500'>
                  Skip Trace Status
                </label>
                               {' '}
                <p className='text-base'>
                                   {' '}
                  <LeadStatusBadge
                    type='SKIP_TRACE'
                    status={lead.skipTraceStatus}
                  />
                                 {' '}
                </p>
                             {' '}
              </div>
                           {' '}
              <div>
                               {' '}
                <label className='text-sm font-medium text-gray-500'>
                  Source
                </label>
                                <p className='text-base'>CSV Import</p>         
                   {' '}
              </div>
                         {' '}
            </div>
                       {' '}
            {lead.type === 'probate' && (
              <>
                               {' '}
                <h3 className='text-lg font-semibold mt-6 mb-2'>
                  Executor Info
                </h3>
                               {' '}
                <div className='grid grid-cols-2 gap-4'>
                                   {' '}
                  <div>
                                       {' '}
                    <label className='text-sm font-medium text-gray-500'>
                      Name
                    </label>
                                       {' '}
                    <p className='text-base'>
                      {lead.adminFirstName} {lead.adminLastName}
                    </p>
                                     {' '}
                  </div>
                                   {' '}
                  <div>
                                       {' '}
                    <label className='text-sm font-medium text-gray-500'>
                      Mailing Address
                    </label>
                                       {' '}
                    <p className='text-base'>{lead.adminAddress || 'N/A'}</p>   
                                 {' '}
                  </div>
                                 {' '}
                </div>
                             {' '}
              </>
            )}
                     {' '}
          </div>
                    {/* 3. CONTACTS Card */}         {' '}
          <div className='bg-white shadow border rounded-lg p-6 relative'>
                       {' '}
            <div className='flex justify-between items-center mb-4'>
                            <h2 className='text-xl font-semibold'>Contacts</h2> 
                         {' '}
              <button
                onClick={handleSkipTrace}
                disabled={isSkipTracing || lead.skipTraceStatus === 'COMPLETED'}
                className={`text-sm px-3 py-1.5 rounded transition-colors flex items-center gap-2 ${
                  lead.skipTraceStatus === 'COMPLETED'
                    ? 'bg-green-100 text-green-700 cursor-not-allowed border border-green-200'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300'
                }`}
              >
                               {' '}
                {isSkipTracing ? (
                  <>
                                       {' '}
                    <Loader size='small' variation='linear' /> Tracing...      
                               {' '}
                  </>
                ) : lead.skipTraceStatus === 'COMPLETED' ? (
                  <>
                                        <span>✓</span> Skiptrace Complete      
                               {' '}
                  </>
                ) : lead.skipTraceStatus === 'NO_MATCH' ? (
                  'Retry Skip Trace'
                ) : (
                  'Skip Trace Owner'
                )}
                             {' '}
              </button>
                         {' '}
            </div>
                       {' '}
            {(!lead.phones || lead.phones.length === 0) &&
            (!lead.emails || lead.emails.length === 0) ? (
              <div className='text-center py-6 bg-gray-50 rounded border border-dashed'>
                               {' '}
                <p className='text-gray-500 mb-2'>No contact info available.</p>
                               {' '}
                <p className='text-xs text-gray-400'>
                  Click "Skip Trace Owner" to find numbers.
                </p>
                             {' '}
              </div>
            ) : (
              <div className='space-y-4'>
                               {' '}
                <div>
                                   {' '}
                  <h3 className='text-xs font-bold text-gray-500 uppercase mb-2'>
                    Phone Numbers
                  </h3>
                                   {' '}
                  {lead.phones && lead.phones.length > 0 ? (
                    <div className='flex flex-wrap gap-2'>
                                           {' '}
                      {lead.phones.map((phone, i) => (
                        <div
                          key={i}
                          className='bg-green-50 text-green-800 border border-green-200 px-3 py-1 rounded text-sm font-mono flex items-center gap-2'
                        >
                          📞 {phone}
                        </div>
                      ))}
                                         {' '}
                    </div>
                  ) : (
                    <span className='text-sm text-gray-400 italic'>
                      None found
                    </span>
                  )}
                                 {' '}
                </div>
                               {' '}
                <div>
                                   {' '}
                  <h3 className='text-xs font-bold text-gray-500 uppercase mb-2'>
                    Emails
                  </h3>
                                   {' '}
                  {lead.emails && lead.emails.length > 0 ? (
                    <div className='flex flex-wrap gap-2'>
                                           {' '}
                      {lead.emails.map((email, i) => (
                        <div
                          key={i}
                          className='bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded text-sm flex items-center gap-2'
                        >
                          ✉️ {email}
                        </div>
                      ))}
                                         {' '}
                    </div>
                  ) : (
                    <span className='text-sm text-gray-400 italic'>
                      None found
                    </span>
                  )}
                                 {' '}
                </div>
                             {' '}
              </div>
            )}
                     {' '}
          </div>
                 {' '}
        </div>
               {' '}
        {/* --- RIGHT COLUMN (1/3 width from MD breakpoint up: GHL, Intel, Activity, Map) --- */}
               {' '}
        <div className='w-full md:w-1/3 space-y-6'>
          {/* 4. GHL Actions Card */}
          <GhlActions
            leadId={lead.id}
            ghlContactId={lead.ghlContactId}
            ghlSyncStatus={lead.ghlSyncStatus}
            onSyncComplete={handleGhlSyncComplete}
            client={client}
          />
          {/* 5. MARKET INTEL */}         {' '}
          <div className='bg-white shadow border rounded-lg p-6 border-l-4 border-l-blue-500'>
                       {' '}
            <h2 className='text-xl font-semibold mb-4'>Market Intel</h2>       
               {' '}
            {marketData ? (
              <div className='space-y-4'>
                               {' '}
                <div>
                                   {' '}
                  <label className='text-xs uppercase font-bold text-gray-400'>
                    Est. Value (Zestimate)
                  </label>
                                   {' '}
                  <p className='text-2xl font-bold text-gray-800'>
                    {formatCurrency(marketData.zestimate)}
                  </p>
                                 {' '}
                </div>
                               {' '}
                <div>
                                   {' '}
                  <label className='text-xs uppercase font-bold text-gray-400'>
                    Est. Rent
                  </label>
                                   {' '}
                  <p className='text-xl font-semibold text-gray-700'>
                    {formatCurrency(marketData.rentZestimate)} /mo
                  </p>
                                 {' '}
                </div>
                               {' '}
                <div className='pt-2'>
                                   {' '}
                  <span className='inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded'>
                    Source: Bridge/Zillow
                  </span>
                                 {' '}
                </div>
                             {' '}
              </div>
            ) : (
              <div className='text-center py-4 text-gray-500'>
                                <p>No market data available.</p>               {' '}
                <p className='text-xs mt-1'>
                  (The API route for Market Intel might be outdated.)
                </p>
                             {' '}
              </div>
            )}
                     {' '}
          </div>
          {/* 6. ACTIVITY LOG */}         {' '}
          <div className='bg-white shadow border rounded-lg p-6'>
                        <h2 className='text-xl font-semibold mb-4'>Activity</h2>
                        <p className='text-gray-500'>No activities logged.</p> 
                   {' '}
          </div>
                    {/* 7. MAP Card */}         {' '}
          <div className='bg-white shadow border rounded-lg p-6'>
                        <h2 className='text-xl font-semibold mb-4'>Map</h2>     
                 {' '}
            {isMapLoaded && mapCenter ? (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={mapCenter}
                zoom={16}
                options={{ disableDefaultUI: true, zoomControl: true }}
              >
                                <MarkerF position={mapCenter} />           
                 {' '}
              </GoogleMap>
            ) : (
              <div
                className='flex items-center justify-center bg-gray-100 rounded text-gray-500'
                style={{ height: '300px' }}
              >
                               {' '}
                {!isMapLoaded ? 'Loading Map...' : 'Address not geocoded.'}     
                       {' '}
              </div>
            )}
                     {' '}
          </div>
                 {' '}
        </div>
             {' '}
      </div>
         {' '}
    </main>
  );
}
