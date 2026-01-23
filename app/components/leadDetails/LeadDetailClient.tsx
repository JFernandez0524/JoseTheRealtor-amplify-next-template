'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  GoogleMap,
  MarkerF,
  useJsApiLoader,
  Libraries,
} from '@react-google-maps/api';
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
import { TagsManager } from './TagsManager';
import { OutreachStatus } from './OutreachStatus';

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

const libraries: Libraries = ['places'];
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

export function LeadDetailClient({ initialLead }: { initialLead: Lead }) {
  const router = useRouter();
  const [lead, setLead] = useState<Lead>(initialLead);
  const [marketData, setMarketData] = useState<any | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSkipTracing, setIsSkipTracing] = useState(false);
  const [navContext, setNavContext] = useState<NavContext | null>(null);
  const [isCoreInfoEditing, setIsCoreInfoEditing] = useState(false);
  const [access, setAccess] = useState({ isAdmin: false, isPro: false });

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

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
      if (data) setLead(data as Lead);
    } catch (err: any) {
      alert(err.message);
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
    <main className='max-w-[1600px] mx-auto py-6 px-8 bg-slate-50 min-h-screen'>
      {/* HEADER / NAV */}
      <div className='flex items-center justify-between mb-8'>
        <div className='flex items-center gap-6'>
          <button
            onClick={() => router.push('/dashboard')}
            className='p-2 hover:bg-white rounded-full border border-slate-200 transition'
          >
            <HiChevronLeft className='text-xl text-slate-600' />
          </button>
          <h1 className='text-xl font-bold text-slate-800 uppercase tracking-tight'>
            PROPERTY RECORD
          </h1>
        </div>

        <div className='flex items-center gap-4'>
          <button
            onClick={handlePrevious}
            disabled={!navContext || navContext.isFirst}
            className='px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 disabled:opacity-30 transition-colors'
          >
            PREV
          </button>
          <div className='px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm'>
            <span className='text-xs font-black text-slate-800'>
              {navContext
                ? `${navContext.currentIndex + 1} / ${navContext.ids.length}`
                : '- / -'}
            </span>
          </div>
          <button
            onClick={handleNext}
            disabled={!navContext || navContext.isLast}
            className='px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 disabled:opacity-30 transition-colors'
          >
            NEXT
          </button>
        </div>
      </div>

      <div className='grid grid-cols-12 gap-8'>
        <div className='col-span-12 lg:col-span-9 space-y-8'>
          {/* MAP & HERO */}
          <section className='bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden'>
            <div className='h-[350px] bg-slate-100 relative'>
              {isMapLoaded && mapCenter ? (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={mapCenter}
                  zoom={18}
                  options={{ disableDefaultUI: true }}
                >
                  <MarkerF position={mapCenter} />
                </GoogleMap>
              ) : (
                <div className='flex items-center justify-center h-full text-slate-400 font-bold uppercase text-[10px] tracking-widest'>
                  <FiMapPin className='mr-2 text-lg' /> Map Data Loading...
                </div>
              )}
            </div>
            <div className='p-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6'>
              <div className='flex-1'>
                <span className='bg-indigo-600 text-white text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-widest mb-3 inline-block'>
                  {lead.type}
                </span>
                <h2 className='text-4xl font-black text-slate-900 tracking-tight leading-tight'>
                  {displayAddress}
                </h2>
              </div>
              <div className='bg-slate-50 p-6 rounded-2xl border border-slate-100 text-right min-w-[240px]'>
                <p className='text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1'>
                  Zestimate® Value
                </p>
                <p className='text-4xl font-black text-indigo-600 tracking-tighter'>
                  {access.isAdmin || access.isPro
                    ? formatCurrency(valuation?.zestimate)
                    : '$XX,XXX (PRO Only)'}
                </p>
              </div>
            </div>
          </section>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
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
                  
                  const hasUnqualifiedData = rawData.allPhones?.length > 0 || rawData.allEmails?.length > 0;
                  
                  if (!hasUnqualifiedData) return null;
                  
                  return (
                  <div className='border-t pt-6'>
                    <div className='bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4'>
                      <p className='text-xs text-amber-800'>
                        <strong>⚠️ Additional contacts found</strong> but didn't pass quality filters (Mobile 90+ score, not DNC, tested emails). Use at your discretion.
                      </p>
                    </div>
                    
                    {rawData.allPhones?.length > 0 && (
                      <div className='mb-4'>
                        <h4 className='text-[10px] font-black uppercase text-slate-400 mb-3'>
                          All Phone Numbers Found
                        </h4>
                        <div className='space-y-2'>
                          {rawData.allPhones.map((p: any, idx: number) => (
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
                                {p.dnc && (
                                  <span className='bg-red-100 text-red-700 px-2 py-0.5 rounded'>
                                    DNC
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {rawData.allEmails?.length > 0 && (
                      <div>
                        <h4 className='text-[10px] font-black uppercase text-slate-400 mb-3'>
                          All Email Addresses Found
                        </h4>
                        <div className='space-y-2'>
                          {rawData.allEmails.map((e: any, idx: number) => (
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
                  </div>
                  );
                })()}
              </div>
            </CardWrapper>

            {/* Tags Management */}
            <TagsManager
              lead={lead}
              onUpdate={(updatedLead) => setLead(updatedLead as any)}
            />
          </div>

          <CardWrapper title='Technical Property Analysis'>
            {isAnalyzing ? (
              <div className='py-10 flex justify-center'>
                <Loader size='large' />
              </div>
            ) : (
              <div className='grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-8'>
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

        {/* SIDEBAR */}
        <div className='col-span-12 lg:col-span-3 space-y-6'>
          <div className='sticky top-8 space-y-6'>
            <div className='bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl border border-slate-800'>
              <h3 className='text-white text-[10px] font-black uppercase mb-10 flex items-center gap-3 tracking-widest'>
                <span className='w-2 h-2 bg-green-500 rounded-full animate-pulse' />{' '}
                Progression
              </h3>
              <div className='space-y-5'>
                <button
                  onClick={handleSkipTrace}
                  disabled={
                    isSkipTracing || lead.skipTraceStatus === 'COMPLETED'
                  }
                  className='w-full bg-white text-slate-900 font-black text-[10px] uppercase py-5 rounded-2xl shadow-lg disabled:opacity-40 flex items-center justify-center gap-2'
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
              outreachData={lead.ghlOutreachData as any}
            />
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
