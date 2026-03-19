'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  GoogleMap,
} from '@react-google-maps/api';
import { useGoogleMaps } from '../GoogleMapsProvider';
import { Loader } from '@aws-amplify/ui-react';

// Icons
import {
  HiOutlinePhone,
  HiOutlineEnvelope,
  HiChevronLeft,
} from 'react-icons/hi2';
import { FiMapPin } from 'react-icons/fi';

// Modular Components
import { CoreLeadInfo } from './CoreLeadInfo';
import { GhlActions } from './GhlActions';
import { LeadStatusBadge } from './LeadStatusBadge';
import { CardWrapper } from './CardWrapper';
import { OutreachStatus } from './OutreachStatus';
import { SkipTraceHistory } from './SkipTraceHistory';
import { ErrorBoundary } from './ErrorBoundary';
import { ToastProvider, useToast } from './ToastProvider';
import { 
  MapSkeleton, 
  PropertyInfoSkeleton, 
  SidebarSkeleton 
} from './SkeletonLoaders';

// Utils
import { client } from '@/app/utils/aws/data/frontEndClient';
import { getFrontEndAuthSession } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { type Schema } from '@/amplify/data/resource';

type Lead = Schema['PropertyLead']['type'] & {
  notes?: Array<{ text: string; createdAt: string; createdBy?: string }> | null;
  ghlSyncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  ghlContactId?: string | null;
  ghlSyncDate?: string | null;
};


const mapContainerStyle = { width: '100%', height: '100%' };

const formatCurrency = (v?: any) =>
  v
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(Number(v))
    : '---';

interface NavContext {
  ids: string[];
  currentIndex: number;
  isFirst: boolean;
  isLast: boolean;
}

export function LeadDetailWrapper({ initialLead }: { initialLead: Lead }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <LeadDetailClient initialLead={initialLead} />
      </ToastProvider>
    </ErrorBoundary>
  );
}

function LeadDetailClient({ initialLead }: { initialLead: Lead }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [lead, setLead] = useState<Lead>(initialLead);
  const [marketData, setMarketData] = useState<any | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSkipTracing, setIsSkipTracing] = useState(false);
  const [navContext, setNavContext] = useState<NavContext | null>(null);
  const [isCoreInfoEditing, setIsCoreInfoEditing] = useState(false);
  const [access, setAccess] = useState({ isAdmin: false, isPro: false });
  const [outreachData, setOutreachData] = useState<any>(null);
  const [isLoadingOutreach, setIsLoadingOutreach] = useState(false);
  const [marketDataError, setMarketDataError] = useState<string | null>(null);
  const [outreachError, setOutreachError] = useState<string | null>(null);

  const { isLoaded: isMapLoaded } = useGoogleMaps();

  const refreshLeadData = async () => {
    try {
      const { data: updatedLead } = await client.models.PropertyLead.get({
        id: lead.id,
      });
      if (updatedLead) {
        setLead(updatedLead as Lead);
      }
    } catch (err) {
      console.error('Failed to refresh lead data:', err);
    }
  };

  // 1. AUTH CHECK - Updated for ADMINS
  useEffect(() => {
    async function checkAccess() {
      const session = await getFrontEndAuthSession();
      if (session) {
        const groups =
          (session.tokens?.accessToken.payload['cognito:groups'] as string[]) ||
          [];
        setAccess({
          isAdmin: groups.includes('ADMINS'),
          isPro: groups.includes('PRO'),
        });
      }
    }
    checkAccess();
  }, []);

  // Enhanced outreach data fetching with error handling
  const fetchOutreachData = useCallback(async () => {
    if (!lead.ghlContactId) {
      setOutreachData(null);
      return;
    }

    setIsLoadingOutreach(true);
    setOutreachError(null);
    
    try {
      const response = await axios.get(`/api/v1/ghl-outreach-data?contactId=${lead.ghlContactId}`);
      setOutreachData(response.data);
    } catch (error) {
      console.error('Failed to fetch outreach data:', error);
      setOutreachError('Failed to load outreach data');
      setOutreachData(null);
    } finally {
      setIsLoadingOutreach(false);
    }
  }, [lead.ghlContactId]);

  // Enhanced market data fetching with error handling
  const fetchMarketIntel = useCallback(async () => {
    if (!initialLead?.id || (!initialLead?.latitude && !initialLead.standardizedAddress)) {
      return;
    }
    
    setIsAnalyzing(true);
    setMarketDataError(null);

    let street = lead?.ownerAddress || initialLead.ownerAddress || '';
    let city = lead?.ownerCity || initialLead.ownerCity || '';
    let state = lead?.ownerState || initialLead.ownerState || '';
    let zip = lead?.ownerZip || initialLead.ownerZip || '';

    const rawAddress = initialLead.standardizedAddress;
    if (typeof rawAddress === 'string' && rawAddress.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawAddress);
        street = parsed.street || street;
        city = parsed.city || city;
        state = parsed.state || state;
        zip = parsed.zip || zip;
      } catch (e) {}
    }

    try {
      const response = await axios.post('/api/v1/analyze-property', {
        lat: Number(initialLead.latitude),
        lng: Number(initialLead.longitude),
        street,
        city,
        state,
        zip,
      });
      if (response.data.success) {
        setMarketData(response.data);
      } else {
        setMarketDataError('Property analysis unavailable');
      }
    } catch (err) {
      console.error('Analysis Failed:', err);
      setMarketDataError('Failed to load property analysis');
    } finally {
      setIsAnalyzing(false);
    }
  }, [initialLead, lead?.ownerAddress, lead?.ownerCity, lead?.ownerState, lead?.ownerZip]);

  // 2. DATA FETCHING (ANALYZER)
  useEffect(() => {
    // Subscribe to real-time updates for this lead
    const subscription = client.models.PropertyLead.observeQuery({
      filter: { id: { eq: initialLead.id } }
    }).subscribe({
      next: ({ items }) => {
        if (items.length > 0) {
          const updatedLead = items[0] as Lead;
          setLead(updatedLead);
          console.log('📡 Lead updated in real-time:', updatedLead.id);
        }
      }
    });

    const fetchMarketIntel = async () => {
      if (
        !initialLead?.id ||
        (!initialLead?.latitude && !initialLead.standardizedAddress)
      )
        return;
      setIsAnalyzing(true);

      let street = lead?.ownerAddress || initialLead.ownerAddress || '';
      let city = lead?.ownerCity || initialLead.ownerCity || '';
      let state = lead?.ownerState || initialLead.ownerState || '';
      let zip = lead?.ownerZip || initialLead.ownerZip || '';

      const rawAddress = initialLead.standardizedAddress;
      if (typeof rawAddress === 'string' && rawAddress.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(rawAddress);
          street = parsed.street || street;
          city = parsed.city || city;
          state = parsed.state || state;
          zip = parsed.zip || zip;
        } catch (e) {}
      }

      try {
        const response = await axios.post('/api/v1/analyze-property', {
          lat: Number(initialLead.latitude),
          lng: Number(initialLead.longitude),
          street,
          city,
          state,
          zip,
        });
        if (response.data.success) setMarketData(response.data);
      } catch (err) {
        console.error('Analysis Failed:', err);
      } finally {
        setIsAnalyzing(false);
      }
    };
    
    setLead(initialLead);
    fetchMarketIntel();

    return () => subscription.unsubscribe();
  }, [initialLead]);

  // 3. NAVIGATION LOGIC - Updated path to match /lead/ structure
  useEffect(() => {
    const loadNavigation = async () => {
      const contextString = sessionStorage.getItem('leadNavContext');
      if (!contextString) return;
      try {
        const context = JSON.parse(contextString);
        let leadIds = context.ids || [];
        let idx = leadIds.indexOf(initialLead.id);

        if (idx === -1) {
          const { data: freshLeads } = await client.models.PropertyLead.list({
            filter: context.filterType
              ? { type: { eq: context.filterType } }
              : undefined,
            selectionSet: ['id'],
          });
          leadIds = freshLeads.map((l) => l.id);
          idx = leadIds.indexOf(initialLead.id);
          sessionStorage.setItem(
            'leadNavContext',
            JSON.stringify({ ...context, ids: leadIds })
          );
        }

        if (idx !== -1) {
          setNavContext({
            ids: leadIds,
            currentIndex: idx,
            isFirst: idx === 0,
            isLast: idx === leadIds.length - 1,
          });
        }
      } catch (e) {
        console.error('Navigation Load Error:', e);
      }
    };
    loadNavigation();
  }, [initialLead.id]);

  const handlePrevious = () => {
    if (navContext && !navContext.isFirst) {
      router.push(`/lead/${navContext.ids[navContext.currentIndex - 1]}`);
    }
  };

  const handleNext = () => {
    if (navContext && !navContext.isLast) {
      router.push(`/lead/${navContext.ids[navContext.currentIndex + 1]}`);
    }
  };

  const handleSkipTrace = async () => {
    if (lead.skipTraceStatus === 'COMPLETED') return;
    setIsSkipTracing(true);
    try {
      await client.mutations.skipTraceLeads({ leadIds: [lead.id] });
      const { data } = await client.models.PropertyLead.get({ id: lead.id });
      if (data) {
        setLead(data as Lead);
        addToast({
          type: 'success',
          title: 'Skip Trace Complete',
          message: 'Contact information has been updated'
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Skip Trace Failed',
        message: err.message || 'Please try again'
      });
    } finally {
      setIsSkipTracing(false);
    }
  };

  // 4. MAPPINGS
  const parcel = marketData?.assessment || marketData?.parcel;
  const valuation = marketData?.valuation;
  const building = parcel?.building?.[0] || {};
  const mapCenter =
    lead.latitude && Number(lead.latitude) !== 0
      ? { lat: Number(lead.latitude), lng: Number(lead.longitude) }
      : null;

  const getCleanAddress = (val: any) => {
    if (typeof val !== 'string' || !val.trim()) return '';
    if (val.trim().startsWith('{')) {
      try {
        const p = JSON.parse(val);
        return `${p.street || ''}, ${p.city || ''}, ${p.state || ''} ${p.zip || ''}`.replace(
          /^[,\s]+|[,\s]+$/g,
          ''
        );
      } catch {
        return val;
      }
    }
    return val;
  };

  const displayAddress =
    getCleanAddress(lead.standardizedAddress) ||
    getCleanAddress(lead.ownerAddress) ||
    'Address Not Available';

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <main className='max-w-[1600px] mx-auto py-4 md:py-6 px-4 md:px-8 bg-slate-50 min-h-screen'>
      {/* HEADER / NAV - Mobile Optimized */}
      <div className='flex items-center justify-between mb-6 md:mb-8'>
        <div className='flex items-center gap-3 md:gap-6'>
          <button
            onClick={() => router.push('/dashboard')}
            className='p-2 md:p-2 hover:bg-white rounded-full border border-slate-200 transition touch-manipulation'
          >
            <HiChevronLeft className='text-lg md:text-xl text-slate-600' />
          </button>
          <h1 className='text-lg md:text-xl font-bold text-slate-800 uppercase tracking-tight'>
            PROPERTY RECORD
          </h1>
        </div>

        <div className='flex items-center gap-2 md:gap-4'>
          <button
            onClick={handlePrevious}
            disabled={!navContext || navContext.isFirst}
            className='px-3 py-2 md:px-4 md:py-2 text-xs font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 disabled:opacity-30 transition-colors touch-manipulation'
          >
            PREV
          </button>
          <div className='px-3 py-2 md:px-4 md:py-2 bg-white border border-slate-200 rounded-lg shadow-sm'>
            <span className='text-xs font-black text-slate-800'>
              {navContext
                ? `${navContext.currentIndex + 1} / ${navContext.ids.length}`
                : '- / -'}
            </span>
          </div>
          <button
            onClick={handleNext}
            disabled={!navContext || navContext.isLast}
            className='px-3 py-2 md:px-4 md:py-2 text-xs font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 disabled:opacity-30 transition-colors touch-manipulation'
          >
            NEXT
          </button>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8'>
        <div className='lg:col-span-9 space-y-6 md:space-y-8'>
          {/* MAP & HERO - Mobile Optimized */}
          <section className='bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 overflow-hidden'>
            <div className='h-[250px] md:h-[350px] bg-slate-100 relative'>
              {!isMapLoaded ? (
                <MapSkeleton />
              ) : mapCenter ? (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={mapCenter}
                  zoom={18}
                  options={{ 
                    disableDefaultUI: true, 
                    mapId: 'DEMO_MAP_ID',
                    zoomControl: true,
                    gestureHandling: 'cooperative'
                  }}
                  onLoad={(map) => {
                    if (window.google?.maps?.marker?.AdvancedMarkerElement) {
                      new window.google.maps.marker.AdvancedMarkerElement({
                        map,
                        position: mapCenter,
                      });
                    }
                  }}
                />
              ) : (
                <div className='flex items-center justify-center h-full text-slate-400 font-bold uppercase text-[10px] tracking-widest'>
                  <FiMapPin className='mr-2 text-lg' /> Map Data Loading...
                </div>
              )}
            </div>
            
            {!lead ? (
              <PropertyInfoSkeleton />
            ) : (
              <div className='p-6 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-6'>
                <div className='flex-1'>
                  <span className='bg-indigo-600 text-white text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-widest mb-3 inline-block'>
                    {lead.type}
                  </span>
                  <h2 className='text-2xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight'>
                    {displayAddress}
                  </h2>
                </div>
                <div className='bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-100 text-right min-w-[200px] md:min-w-[240px] w-full md:w-auto'>
                  <p className='text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1'>
                    Zestimate® Value
                  </p>
                  <p className='text-2xl md:text-4xl font-black text-indigo-600 tracking-tighter'>
                    {access.isAdmin || access.isPro
                      ? formatCurrency(valuation?.zestimate)
                      : '$XX,XXX (PRO Only)'}
                  </p>
                </div>
              </div>
            )}
          </section>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8'>
            <CardWrapper
              title='Owner & Contacts'
              isEditable
              onEditToggle={setIsCoreInfoEditing}
            >
              <CoreLeadInfo
                lead={lead}
                onUpdate={setLead}
                client={client}
                isEditing={isCoreInfoEditing}
                onEditToggle={setIsCoreInfoEditing}
              />
            </CardWrapper>

            <CardWrapper title='Skip Trace Results'>
              <div className='space-y-6'>
                {/* Skip Trace Status and Dates */}
                <div className='bg-slate-50 p-4 rounded-xl border border-slate-100'>
                  <div className='grid grid-cols-2 gap-4 text-xs'>
                    <div>
                      <span className='font-bold text-slate-400 uppercase tracking-wide'>Lead Uploaded:</span>
                      <p className='text-slate-700 font-medium'>
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZone: 'America/New_York'
                        }) : 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <span className='font-bold text-slate-400 uppercase tracking-wide'>Skip Traced:</span>
                      <p className='text-slate-700 font-medium'>
                        {lead.skipTraceCompletedAt ? new Date(lead.skipTraceCompletedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZone: 'America/New_York'
                        }) : lead.skipTraceStatus === 'COMPLETED' ? 'Completed (date unknown)' : 'Not completed'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quality Contacts Section */}
                <div>
                  <h4 className='text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-2'>
                    <HiOutlinePhone className='text-lg text-indigo-500' />{' '}
                    Phones (Quality Contacts)
                  </h4>
                  <div className='space-y-2'>
                    {lead.phones && lead.phones.length > 0 ? (
                      lead.phones.map((p: any, idx) => (
                        <div
                          key={idx}
                          className='flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100'
                        >
                          <span className='font-mono font-bold text-slate-700'>
                            {formatPhone(p.number || p)}
                          </span>
                          <span className='text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase'>
                            {p.type || 'Mobile'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className='text-xs text-slate-400 italic'>
                        No quality phone numbers found.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className='text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-2'>
                    <HiOutlineEnvelope className='text-lg text-indigo-500' />{' '}
                    Emails (Quality Contacts)
                  </h4>
                  <div className='space-y-2'>
                    {lead.emails && lead.emails.length > 0 ? (
                      lead.emails.map((e: any, idx) => (
                        <div
                          key={idx}
                          className='p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm font-medium text-slate-600'
                        >
                          {e.address || e}
                        </div>
                      ))
                    ) : (
                      <p className='text-xs text-slate-400 italic'>
                        No quality email addresses found.
                      </p>
                    )}
                  </div>
                </div>

                {/* Raw Skip Trace Data Section */}
                {lead.skipTraceStatus === 'COMPLETED' && lead.rawSkipTraceData && (() => {
                  const rawData = typeof lead.rawSkipTraceData === 'string' 
                    ? JSON.parse(lead.rawSkipTraceData) 
                    : lead.rawSkipTraceData;
                  
                  // Filter out DNC phone numbers completely
                  const nonDncPhones = (rawData.allPhones || []).filter((p: any) => !p.dnc);
                  const allEmails = rawData.allEmails || [];
                  
                  // Calculate comprehensive counts
                  const totalPhonesFound = rawData.allPhones?.length || 0;
                  const totalEmailsFound = allEmails.length;
                  const qualifiedPhones = lead.phones?.length || 0;
                  const qualifiedEmails = lead.emails?.length || 0;
                  const dncPhonesFiltered = totalPhonesFound - nonDncPhones.length;
                  
                  const hasUnqualifiedData = nonDncPhones.length > 0 || allEmails.length > 0;
                  
                  if (!hasUnqualifiedData) return null;
                  
                  return (
                  <div className='border-t pt-6'>
                    <div className='bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4'>
                      <p className='text-xs text-amber-800 mb-2'>
                        <strong>⚠️ Additional contacts found:</strong> {totalPhonesFound} phones, {totalEmailsFound} emails
                      </p>
                      <p className='text-xs text-amber-700 mb-2'>
                        <strong>Passed filters:</strong> {qualifiedPhones} phones, {qualifiedEmails} emails
                      </p>
                      <p className='text-xs text-amber-700 mb-2'>
                        <strong>Filter criteria:</strong> Mobile phones 90+ score, not DNC, verified emails only
                      </p>
                      {dncPhonesFiltered > 0 && (
                        <p className='text-xs text-red-700'>
                          <strong>Note:</strong> {dncPhonesFiltered} phone(s) hidden due to DNC status
                        </p>
                      )}
                    </div>
                    
                    {nonDncPhones.length > 0 && (
                      <div className='mb-4'>
                        <h4 className='text-[10px] font-black uppercase text-slate-400 mb-3'>
                          Additional Phone Numbers (Non-DNC)
                        </h4>
                        <div className='space-y-2'>
                          {nonDncPhones.map((p: any, idx: number) => (
                            <div
                              key={idx}
                              className='flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100'
                            >
                              <span className='font-mono text-sm text-slate-700'>
                                {formatPhone(p.number)}
                              </span>
                              <div className='flex gap-2 text-[9px] font-bold'>
                                <span className='bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase'>
                                  {p.type}
                                </span>
                                <span className='bg-slate-100 text-slate-600 px-2 py-0.5 rounded'>
                                  Score: {p.score}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {allEmails.length > 0 && (
                      <div>
                        <h4 className='text-[10px] font-black uppercase text-slate-400 mb-3'>
                          All Email Addresses Found
                        </h4>
                        <div className='space-y-2'>
                          {allEmails.map((e: any, idx: number) => (
                            <div
                              key={idx}
                              className='flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100'
                            >
                              <span className='text-sm text-slate-600'>
                                {e.email}
                              </span>
                              {!e.tested && (
                                <span className='text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded'>
                                  Not Verified
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {rawData.batchDataMailingAddress && (
                      <div className='mt-4'>
                        <h4 className='text-[10px] font-black uppercase text-slate-400 mb-3'>
                          BatchData Mailing Address
                        </h4>
                        <div className='p-3 bg-blue-50 rounded-xl border border-blue-100'>
                          <p className='text-sm text-slate-700'>
                            {rawData.batchDataMailingAddress.mailingAddress}
                          </p>
                          <p className='text-sm text-slate-700'>
                            {rawData.batchDataMailingAddress.mailingCity}, {rawData.batchDataMailingAddress.mailingState} {rawData.batchDataMailingAddress.mailingZip}
                          </p>
                        </div>
                        <p className='text-xs text-slate-500 mt-2'>
                          This is the mailing address returned by BatchData. Your current mailing address (from CSV) is shown above.
                        </p>
                      </div>
                    )}
                  </div>
                  );
                })()}
                
                {/* Skip Trace History */}
                <SkipTraceHistory history={lead.skipTraceHistory} />
              </div>
            </CardWrapper>
          </div>

          <CardWrapper title='Technical Property Analysis'>
            {isAnalyzing ? (
              <div className='py-10 flex justify-center'>
                <Loader size='large' />
              </div>
            ) : marketDataError ? (
              <div className='py-10 text-center'>
                <div className='text-red-500 mb-4'>
                  <svg className='w-8 h-8 mx-auto' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className='text-gray-600 mb-4'>{marketDataError}</p>
                <button
                  onClick={fetchMarketIntel}
                  className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors'
                >
                  Retry Analysis
                </button>
              </div>
            ) : (
              <div className='grid grid-cols-2 md:grid-cols-4 gap-y-6 md:gap-y-10 gap-x-4 md:gap-x-8'>
                <InfoRow label='APN' value={parcel?.apn} />
                <InfoRow
                  label='Living Area'
                  value={
                    parcel?.buildingSizeSquareFeet
                      ? `${parcel.buildingSizeSquareFeet.toLocaleString()} SqFt`
                      : null
                  }
                />
                <InfoRow
                  label='Lot Size'
                  value={
                    parcel?.lotSizeSquareFeet
                      ? `${parcel.lotSizeSquareFeet.toLocaleString()} SqFt`
                      : null
                  }
                />
                <InfoRow label='Year Built' value={building?.yearBuilt} />
                <InfoRow
                  label='Beds / Baths'
                  value={`${building?.bedrooms || '-'} / ${building?.baths || '-'}`}
                />
                <InfoRow label='Stories' value={building?.totalStories} />
                <InfoRow label='Zoning' value={parcel?.zoningDescription} />
                <InfoRow label='County' value={parcel?.county} />
              </div>
            )}
          </CardWrapper>
        </div>

        {/* SIDEBAR - Mobile Optimized */}
        <div className='lg:col-span-3 space-y-6'>
          <div className='lg:sticky lg:top-8 space-y-6'>
            {!lead ? (
              <SidebarSkeleton />
            ) : (
              <>
                <div className='bg-slate-900 rounded-[2.5rem] p-6 md:p-10 shadow-2xl border border-slate-800'>
                  <h3 className='text-white text-[10px] font-black uppercase mb-6 md:mb-10 flex items-center gap-3 tracking-widest'>
                    <span className='w-2 h-2 bg-green-500 rounded-full animate-pulse' />{' '}
                    Progression
                  </h3>
                  <div className='space-y-4 md:space-y-5'>
                    <button
                      onClick={handleSkipTrace}
                      disabled={
                        isSkipTracing || lead.skipTraceStatus === 'COMPLETED'
                      }
                      className='w-full bg-white text-slate-900 font-black text-[10px] uppercase py-4 md:py-5 rounded-2xl shadow-lg disabled:opacity-40 flex items-center justify-center gap-2 touch-manipulation'
                    >
                      {isSkipTracing ? (
                        <Loader size='small' />
                      ) : lead.skipTraceStatus === 'COMPLETED' ? (
                        '✓ Traced'
                      ) : (
                        'Run Skip Trace'
                      )}
                    </button>
                    <GhlActions
                      leadId={lead.id}
                      ghlContactId={lead.ghlContactId}
                      ghlSyncStatus={lead.ghlSyncStatus}
                      skipTraceStatus={lead.skipTraceStatus}
                      onSyncComplete={refreshLeadData}
                      client={client}
                    />
                  </div>
                </div>

                <CardWrapper title='Lead Pipeline'>
                  <div className='space-y-4 pt-2'>
                    <div className='flex justify-between items-center'>
                      <span className='text-[10px] font-bold text-slate-400 uppercase tracking-tighter'>
                        Discovery
                      </span>
                      <LeadStatusBadge
                        type='SKIP_TRACE'
                        status={lead.skipTraceStatus}
                      />
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='text-[10px] font-bold text-slate-400 uppercase tracking-tighter'>
                        CRM Sync
                      </span>
                      <LeadStatusBadge
                        type='GHL_SYNC'
                        status={lead.ghlSyncStatus}
                      />
                    </div>
                  </div>
                </CardWrapper>

                <OutreachStatus 
                  ghlContactId={lead.ghlContactId}
                  outreachData={outreachData}
                  onDataUpdate={setOutreachData}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  const getDisplayValue = (val: any) =>
    val === null || val === undefined || val === '' ? '---' : String(val);
  return (
    <div>
      <p className='text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest'>
        {label}
      </p>
      <p className='text-sm font-bold text-slate-700 leading-tight'>
        {getDisplayValue(value)}
      </p>
    </div>
  );
}
