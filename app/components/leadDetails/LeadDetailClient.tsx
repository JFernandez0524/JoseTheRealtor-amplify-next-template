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
import { Loader } from '@aws-amplify/ui-react';

// 👇 YOUR MODULAR COMPONENTS
import { CoreLeadInfo } from './CoreLeadInfo';
import { GhlActions } from './GhlActions';
import { LeadStatusBadge } from './LeadStatusBadge';
import { CardWrapper } from './CardWrapper';
import { ContactActionItem } from './ContactActionItem';

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

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

  // 1. DATA FETCHING (ANALYZER)
  useEffect(() => {
    const fetchMarketIntel = async () => {
      setIsAnalyzing(true);
      try {
        const response = await axios.post('/api/v1/analyze-property', {
          lat: Number(initialLead.latitude),
          lng: Number(initialLead.longitude),
          standardizedAddress: initialLead.standardizedAddress,
        });

        if (response.data.success) {
          setMarketData(response.data);
        }
      } catch (err) {
        console.error('Analysis Failed:', err);
      } finally {
        setIsAnalyzing(false);
      }
    };

    setLead(initialLead);
    fetchMarketIntel();
  }, [initialLead]);

  // 2. NAVIGATION LOGIC
  const loadNav = useCallback(() => {
    if (typeof window === 'undefined') return;
    const contextString = sessionStorage.getItem('leadNavContext');
    if (!contextString) return;
    try {
      const context = JSON.parse(contextString);
      const leadIds = context.ids || [];
      const idx = leadIds.indexOf(initialLead.id);
      if (idx !== -1) {
        setNavContext({
          ids: leadIds,
          currentIndex: idx,
          isFirst: idx === 0,
          isLast: idx === leadIds.length - 1,
        });
      }
    } catch (e) {
      console.error('Nav Context Load Error:', e);
    }
  }, [initialLead.id]);

  useEffect(() => {
    loadNav();
  }, [loadNav]);

  // 3. ACTION HANDLERS
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

  // DATA MAPPING SHORTCUTS
  const parcel = marketData?.parcel;
  const valuation = marketData?.valuation;
  const building = parcel?.building?.[0] || {};
  const legal = parcel?.legal || {};
  const garage = parcel?.garages?.[0] || {};
  const mapCenter =
    lead.latitude && lead.longitude
      ? { lat: Number(lead.latitude), lng: Number(lead.longitude) }
      : null;

  /**
   * ✅ CLEAN ADDRESS HELPER
   * Handles raw strings OR JSON strings from the database
   */
  const getCleanAddress = (val: any): string => {
    if (typeof val !== 'string' || val.trim() === '') return '';

    // Detect JSON string (common when objects are stored in string fields)
    if (val.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(val);
        const { street, city, state, zip } = parsed;
        // Construct standard format: 123 Main St, City, ST 12345
        return [street, city, state ? `${state} ${zip || ''}`.trim() : zip]
          .filter(Boolean)
          .join(', ');
      } catch (e) {
        return val; // Fallback to raw string if parsing fails
      }
    }
    return val;
  };

  const cleanStandardized = getCleanAddress(lead.standardizedAddress);
  const cleanOwner = getCleanAddress(lead.ownerAddress);

  const displayAddress: React.ReactNode =
    cleanStandardized !== ''
      ? cleanStandardized
      : cleanOwner !== ''
        ? cleanOwner
        : 'No Address Provided';

  const showSubAddress = cleanStandardized === '';

  return (
    <main className='max-w-[1600px] mx-auto py-6 px-8 bg-slate-50 min-h-screen'>
      {/* 🔝 TOP NAVIGATION BAR */}
      <div className='flex items-center justify-between mb-8'>
        <div className='flex items-center gap-4'>
          <button
            onClick={() => router.push('/dashboard')}
            className='p-2 hover:bg-white rounded-full border hover:border-slate-200 transition'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='20'
              height='20'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
            >
              <path d='m15 18-6-6 6-6' />
            </svg>
          </button>
          <h1 className='text-xl font-bold text-slate-800 uppercase tracking-tight'>
            Property Record
          </h1>
          {navContext && (
            <div className='flex items-center gap-3 ml-4 bg-white border rounded-full px-4 py-1.5 shadow-sm text-[10px] font-black tracking-widest text-slate-500'>
              <button
                disabled={navContext.isFirst}
                onClick={() =>
                  router.push(
                    `/lead/${navContext.ids[navContext.currentIndex - 1]}`
                  )
                }
                className='hover:text-indigo-600 disabled:opacity-20 uppercase'
              >
                Prev
              </button>
              <span className='text-slate-200'>|</span>
              <span>
                {navContext.currentIndex + 1} / {navContext.ids.length}
              </span>
              <span className='text-slate-200'>|</span>
              <button
                disabled={navContext.isLast}
                onClick={() =>
                  router.push(
                    `/lead/${navContext.ids[navContext.currentIndex + 1]}`
                  )
                }
                className='hover:text-indigo-600 disabled:opacity-20 uppercase'
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <div className='grid grid-cols-12 gap-8'>
        <div className='col-span-12 lg:col-span-9 space-y-8'>
          {/* HERO SECTION */}
          <section className='bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden'>
            <div className='h-[350px] bg-slate-100 relative'>
              {isMapLoaded && mapCenter && (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={mapCenter}
                  zoom={18}
                  options={{ disableDefaultUI: true }}
                >
                  <MarkerF position={mapCenter} />
                </GoogleMap>
              )}
            </div>
            <div className='p-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6'>
              <div>
                <div className='flex items-center gap-3 mb-3'>
                  <span className='bg-indigo-600 text-white text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-widest'>
                    {lead.type}
                  </span>
                </div>
                <h2 className='text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight max-w-4xl'>
                  {displayAddress}
                </h2>
                {showSubAddress && (
                  <p className='text-2xl text-slate-500 font-medium'>
                    {lead.ownerCity}, {lead.ownerState} {lead.ownerZip}
                  </p>
                )}
              </div>
              <div className='bg-slate-50 p-6 rounded-2xl border border-slate-100 text-right min-w-[240px]'>
                <p className='text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1'>
                  Zestimate® Value
                </p>
                <p className='text-4xl font-black text-indigo-600 tracking-tighter'>
                  {formatCurrency(valuation?.zestimate)}
                </p>
              </div>
            </div>
          </section>

          {/* SECOND ROW */}
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
              <div className='mt-6 pt-6 border-t space-y-3'>
                <p className='text-[10px] font-bold text-slate-400 uppercase italic'>
                  Verified Contact Methods
                </p>
                {lead.phones?.map((p, i) => (
                  <ContactActionItem key={i} value={p} type='phone' />
                ))}
                {lead.emails?.map((e, i) => (
                  <ContactActionItem key={i} value={e} type='email' />
                ))}
                {!lead.phones?.length && !lead.emails?.length && (
                  <p className='text-sm italic text-slate-300'>
                    No verified contacts. Run skip trace.
                  </p>
                )}
              </div>
            </CardWrapper>

            <CardWrapper title='Market Intel & Taxes'>
              <div className='space-y-6'>
                <MarketRow
                  label='Total Assessed'
                  value={formatCurrency(parcel?.totalValue)}
                />
                <MarketRow
                  label='Tax Amount'
                  value={formatCurrency(parcel?.taxAmount)}
                  subtitle={`Year: ${parcel?.taxYear || '---'}`}
                />
                <div className='mt-8 p-6 bg-indigo-900 rounded-2xl text-white shadow-xl'>
                  <p className='text-[10px] font-black text-indigo-300 uppercase mb-2 tracking-widest'>
                    Valuation Confidence
                  </p>
                  <p className='text-3xl font-black'>
                    {valuation?.highPercent
                      ? 100 - valuation.highPercent
                      : '---'}
                    %
                  </p>
                  <p className='text-[10px] text-indigo-400 mt-2 italic leading-relaxed uppercase'>
                    Range: {formatCurrency(valuation?.minus30)} —{' '}
                    {formatCurrency(valuation?.zestimate * 1.1)}
                  </p>
                </div>
              </div>
            </CardWrapper>
          </div>

          {/* THIRD ROW: TECHNICAL DATA */}
          <CardWrapper title='Technical Property Analysis'>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-y-12 gap-x-8'>
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
                label='Lot Size Sqft'
                value={
                  parcel?.lotSizeSquareFeet
                    ? `${parcel.lotSizeSquareFeet.toLocaleString()} SqFt`
                    : null
                }
              />
              <InfoRow
                label='Lot Size (Acres)'
                value={
                  parcel?.lotSizeAcres ? `${parcel.lotSizeAcres} Acres` : null
                }
              />
              <InfoRow label='Year Built' value={building?.yearBuilt} />
              <InfoRow label='Stories' value={building?.totalStories} />
              <InfoRow
                label='Beds / Baths'
                value={`${building?.bedrooms || '-'} / ${building?.baths || '-'}`}
              />
              <InfoRow label='Zoning' value={parcel?.zoningDescription} />
              <InfoRow label='Construction' value={building?.foundation} />
              <InfoRow label='Land Use' value={parcel?.landUseDescription} />
              <InfoRow
                label='Air Conditioning'
                value={building?.airConditioning}
              />
              <InfoRow label='Heating' value={building?.heating} />
              <InfoRow label='Condition' value={building?.condition} />
              <InfoRow label='County' value={parcel?.county} />
              <InfoRow label='Township' value={legal?.township} />
              <InfoRow
                label='Block / Lot'
                value={`${legal?.block || '-'} / ${legal?.lot || '-'}`}
              />
              <InfoRow
                label='Garage'
                value={
                  garage?.carCount
                    ? `${garage.carCount} Car (${garage.type})`
                    : null
                }
              />
              <InfoRow
                label='Building Count'
                value={parcel?.numberOfBuildings}
              />
            </div>
          </CardWrapper>
        </div>

        {/* ⚡ ACTION SIDEBAR */}
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
                  className='w-full bg-white text-slate-900 font-black text-[10px] uppercase tracking-widest py-5 rounded-2xl hover:bg-slate-100 shadow-lg disabled:opacity-40 flex items-center justify-center gap-2'
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
                  onSyncComplete={() => {}}
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
          </div>
        </div>
      </div>
    </main>
  );
}

// ✅ REUSABLE HELPERS WITH TYPE-SAFE RENDERING
function InfoRow({ label, value }: { label: string; value: any }) {
  const getDisplayValue = (val: any): React.ReactNode => {
    if (val === null || val === undefined || val === '') return '---';
    if (typeof val === 'object' || typeof val === 'boolean') return '---';
    return String(val);
  };

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

function MarketRow({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: any;
  subtitle?: string;
}) {
  const getDisplayValue = (val: any): React.ReactNode => {
    if (val === null || val === undefined || val === '') return '---';
    if (typeof val === 'object' || typeof val === 'boolean') return '---';
    return String(val);
  };

  return (
    <div className='flex justify-between items-start py-2.5 border-b border-slate-50'>
      <div>
        <p className='text-xs font-bold text-slate-600 tracking-tight'>
          {label}
        </p>
        {subtitle && (
          <p className='text-[9px] text-slate-400 uppercase mt-0.5'>
            {subtitle}
          </p>
        )}
      </div>
      <p className='text-sm font-black text-slate-900 tracking-tighter'>
        {getDisplayValue(value)}
      </p>
    </div>
  );
}
