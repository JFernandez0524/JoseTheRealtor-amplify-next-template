'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  GoogleMap,
  MarkerF,
} from '@react-google-maps/api';
import { useGoogleMaps } from '../GoogleMapsProvider';
import { Loader } from '@aws-amplify/ui-react';

// Icons
import {
  HiOutlinePhone,
  HiOutlineEnvelope,
  HiChevronLeft,
} from 'react-icons/hi2';
import { FiMapPin, FiEdit2, FiPlus, FiTrash2, FiPhone, FiMail } from 'react-icons/fi';

// Modular Components
import { CoreLeadInfo } from './CoreLeadInfo';
import { EnrichmentDetails } from './EnrichmentDetails';
import { GhlActions } from './GhlActions';
import { LeadStatusBadge } from './LeadStatusBadge';
import { CardWrapper } from './CardWrapper';
import { PropertyMarketIntel } from './PropertyMarketIntel';
import { OutreachStatus } from './OutreachStatus';
import { SkipTraceHistory } from './SkipTraceHistory';
import { ErrorBoundary } from './ErrorBoundary';
import { ToastProvider, useToast } from './ToastProvider';
import { DeleteConfirmModal } from '../dashboard/DeleteConfirmModal';
import { AddressAutocomplete, ParsedAddress } from '@/app/components/address/AddressAutocomplete';
import { deleteLead, updateLead } from '@/app/utils/aws/data/lead.client';
import { formatPhoneE164 } from '@/app/utils/leadValidation';
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [outreachData, setOutreachData] = useState<any>(null);
  const [isLoadingOutreach, setIsLoadingOutreach] = useState(false);
  const [marketDataError, setMarketDataError] = useState<string | null>(null);
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [isEditingZestimate, setIsEditingZestimate] = useState(false);
  const [zestimateInput, setZestimateInput] = useState('');
  const [zestimateUrlInput, setZestimateUrlInput] = useState('');

  // 🏠 Address Editing State
  const [showEditAddressModal, setShowEditAddressModal] = useState(false);
  const [selectedNewAddress, setSelectedNewAddress] = useState<ParsedAddress | null>(null);
  const [manualStreet, setManualStreet] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualState, setManualState] = useState('');
  const [manualZip, setManualZip] = useState('');
  const [showManualFields, setShowManualFields] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // 📞 Contact Management State
  const [showAddPhoneModal, setShowAddPhoneModal] = useState(false);
  const [newPhoneInput, setNewPhoneInput] = useState('');
  const [newPhoneType, setNewPhoneType] = useState<'Mobile' | 'Landline'>('Mobile');
  const [showAddEmailModal, setShowAddEmailModal] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [isSavingContacts, setIsSavingContacts] = useState(false);

  // 🏷️ Pipeline / Disposition State
  const [isUpdatingDisposition, setIsUpdatingDisposition] = useState(false);

  const { isLoaded: isMapLoaded } = useGoogleMaps();

  /**
   * Save a manually-entered Zestimate for properties Zillow's feed doesn't cover.
   */
  const saveManualZestimate = async () => {
    const amount = Number(zestimateInput.replace(/[$,\s]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      addToast({ type: 'error', title: 'Invalid amount', message: 'Enter a dollar amount, e.g. 720700.' });
      return;
    }
    const urlRaw = zestimateUrlInput.trim();
    let zpid: string | undefined;
    if (urlRaw) {
      const m = urlRaw.match(/(\d+)_zpid/);
      if (!m) {
        addToast({ type: 'error', title: 'Invalid link', message: 'That URL has no _zpid/ — paste a full Zillow link or leave it blank.' });
        return;
      }
      zpid = m[1];
    }
    try {
      const updated = await updateLead(lead.id, {
        zestimate: amount,
        zestimateSource: 'MANUAL',
        zestimateDate: new Date().toISOString(),
        ...(urlRaw ? { zillowUrl: urlRaw, zillowZpid: zpid } : {}),
      });
      setLead(updated as Lead);
      setIsEditingZestimate(false);
      setZestimateInput('');
      setZestimateUrlInput('');
      addToast({ type: 'success', title: 'Value saved', message: `Zestimate set to ${formatCurrency(amount)}.` });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Save failed', message: err.message || 'Could not save value.' });
    }
  };

  /**
   * Save updated property address and refresh market intel & valuation
   */
  const handleSaveAddress = async () => {
    const street = selectedNewAddress?.street || manualStreet.trim();
    const city = selectedNewAddress?.city || manualCity.trim();
    const state = selectedNewAddress?.state || manualState.trim();
    const zip = selectedNewAddress?.zip || manualZip.trim();

    if (!street || !city || !state) {
      addToast({ type: 'error', title: 'Missing fields', message: 'Street, city, and state are required.' });
      return;
    }

    setIsSavingAddress(true);
    try {
      const updated = await updateLead(lead.id, {
        ownerAddress: street,
        ownerCity: city,
        ownerState: state,
        ownerZip: zip,
        ownerCounty: selectedNewAddress?.county || lead.ownerCounty || null,
        latitude: selectedNewAddress?.lat ?? undefined,
        longitude: selectedNewAddress?.lng ?? undefined,
        validationStatus: 'VALID',
      });

      setLead(updated as Lead);
      setShowEditAddressModal(false);
      addToast({ type: 'success', title: 'Address updated', message: `${street}, ${city}, ${state} saved.` });
      
      // Auto-trigger market intel refresh for the new address
      handleRefreshMarketIntel();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Update failed', message: err.message || 'Could not update address.' });
    } finally {
      setIsSavingAddress(false);
    }
  };

  /**
   * Contact Management: Add Phone
   */
  const handleAddPhone = async () => {
    if (!newPhoneInput.trim()) return;
    const normalized = formatPhoneE164(newPhoneInput.trim());
    if (!normalized) {
      addToast({ type: 'error', title: 'Invalid Phone', message: 'Enter a valid 10-digit US phone number.' });
      return;
    }

    setIsSavingContacts(true);
    try {
      const currentPhones = [...(lead.phones || [])];
      const currentLandlines = [...(lead.landlinePhones || [])];

      if (newPhoneType === 'Landline') {
        if (!currentLandlines.includes(normalized)) {
          currentLandlines.push(normalized);
        }
      } else {
        const exists = currentPhones.some((p: any) => (typeof p === 'string' ? p === normalized : p.number === normalized));
        if (!exists) {
          currentPhones.push(normalized);
        }
      }

      const updated = await updateLead(lead.id, {
        phones: currentPhones,
        landlinePhones: currentLandlines,
        skipTraceStatus: 'COMPLETED',
      });

      setLead(updated as Lead);
      setNewPhoneInput('');
      setShowAddPhoneModal(false);
      addToast({ type: 'success', title: 'Phone Added', message: `${normalized} added successfully.` });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to add phone', message: err.message });
    } finally {
      setIsSavingContacts(false);
    }
  };

  /**
   * Contact Management: Delete Phone
   */
  const handleDeletePhone = async (phoneToDelete: string, isLandline: boolean) => {
    setIsSavingContacts(true);
    try {
      let currentPhones = [...(lead.phones || [])];
      let currentLandlines = [...(lead.landlinePhones || [])];

      if (isLandline) {
        currentLandlines = currentLandlines.filter(p => p !== phoneToDelete);
      } else {
        currentPhones = currentPhones.filter((p: any) => (typeof p === 'string' ? p !== phoneToDelete : p.number !== phoneToDelete));
      }

      const updated = await updateLead(lead.id, {
        phones: currentPhones,
        landlinePhones: currentLandlines,
      });

      setLead(updated as Lead);
      addToast({ type: 'success', title: 'Phone Removed', message: 'Contact phone removed.' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to remove phone', message: err.message });
    } finally {
      setIsSavingContacts(false);
    }
  };

  /**
   * Contact Management: Add Email
   */
  const handleAddEmail = async () => {
    if (!newEmailInput.trim() || !newEmailInput.includes('@')) {
      addToast({ type: 'error', title: 'Invalid Email', message: 'Enter a valid email address.' });
      return;
    }

    setIsSavingContacts(true);
    try {
      const currentEmails = [...(lead.emails || [])];
      const exists = currentEmails.some((e: any) => (typeof e === 'string' ? e === newEmailInput.trim() : e.address === newEmailInput.trim()));
      if (!exists) {
        currentEmails.push(newEmailInput.trim());
      }

      const updated = await updateLead(lead.id, {
        emails: currentEmails,
      });

      setLead(updated as Lead);
      setNewEmailInput('');
      setShowAddEmailModal(false);
      addToast({ type: 'success', title: 'Email Added', message: `${newEmailInput.trim()} added.` });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to add email', message: err.message });
    } finally {
      setIsSavingContacts(false);
    }
  };

  /**
   * Contact Management: Delete Email
   */
  const handleDeleteEmail = async (emailToDelete: string) => {
    setIsSavingContacts(true);
    try {
      const currentEmails = (lead.emails || []).filter((e: any) => (typeof e === 'string' ? e !== emailToDelete : e.address !== emailToDelete));
      const updated = await updateLead(lead.id, {
        emails: currentEmails,
      });

      setLead(updated as Lead);
      addToast({ type: 'success', title: 'Email Removed', message: 'Email address removed.' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to remove email', message: err.message });
    } finally {
      setIsSavingContacts(false);
    }
  };

  /**
   * Pipeline: Update Call Outcome / Listing Status
   */
  const handleDispositionChange = async (newStatus: string) => {
    setIsUpdatingDisposition(true);
    try {
      const updated = await updateLead(lead.id, {
        listingStatus: newStatus as any,
      });
      setLead(updated as Lead);
      addToast({ type: 'success', title: 'Status Updated', message: `Lead status set to ${newStatus}.` });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Update Failed', message: err.message });
    } finally {
      setIsUpdatingDisposition(false);
    }
  };


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

  const [isRefreshingMarketIntel, setIsRefreshingMarketIntel] = useState(false);

  const handleRefreshMarketIntel = async () => {
    if (!lead?.id) return;
    setIsRefreshingMarketIntel(true);
    try {
      const res = await axios.post('/api/v1/refresh-zestimate', {
        leadId: lead.id,
        street: lead.ownerAddress,
        city: lead.ownerCity,
        state: lead.ownerState,
        zip: lead.ownerZip,
        latitude: lead.latitude,
        longitude: lead.longitude,
        zillowUrl: lead.zillowUrl,
        zillowZpid: lead.zillowZpid,
      });
      if (res.data.success) {
        addToast({
          type: 'success',
          title: 'Market Intel Refreshed',
          message: 'Updated Zestimate and listing status from live MLS/Zillow records.',
        });
        await refreshLeadData();
      } else {
        addToast({
          type: 'info',
          title: 'Refresh Complete',
          message: res.data.message || 'No new market data found.',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Refresh Failed',
        message: err.response?.data?.error || err.message || 'Could not refresh market intel.',
      });
    } finally {
      setIsRefreshingMarketIntel(false);
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

  useEffect(() => {
    fetchOutreachData();
  }, [fetchOutreachData]);

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

    setLead(initialLead);

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

  const handleDeleteConfirm = async () => {
    setShowDeleteModal(false);
    setIsDeleting(true);
    try {
      await deleteLead(lead.id);
      router.push('/dashboard');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Delete Failed', message: err.message || 'Please try again' });
      setIsDeleting(false);
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
          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={isDeleting}
            className='px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition shadow-sm disabled:opacity-50'
          >
            {isDeleting ? 'Deleting…' : 'Delete Lead'}
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
                >
                  <MarkerF position={mapCenter} />
                </GoogleMap>
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
                  <div className='flex items-center gap-3 mb-3'>
                    <span className='bg-indigo-600 text-white text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-widest inline-block'>
                      {lead.type}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedNewAddress(null);
                        setManualStreet(lead.ownerAddress || '');
                        setManualCity(lead.ownerCity || '');
                        setManualState(lead.ownerState || '');
                        setManualZip(lead.ownerZip || '');
                        setShowManualFields(false);
                        setShowEditAddressModal(true);
                      }}
                      className='flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg border border-indigo-200 shadow-sm transition'
                      title='Edit Property Address'
                    >
                      <FiEdit2 className='w-3.5 h-3.5' /> Edit Address
                    </button>
                  </div>
                  <h2 className='text-2xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight'>
                    {displayAddress}
                  </h2>
                </div>
                <div className='bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-100 text-right min-w-[200px] md:min-w-[240px] w-full md:w-auto'>
                  <p className='text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1'>
                    Zestimate® Value
                  </p>
                  {isEditingZestimate ? (
                    <div className='flex flex-col items-end gap-2'>
                      <input
                        type='text'
                        value={zestimateUrlInput}
                        onChange={(e) => setZestimateUrlInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveManualZestimate(); if (e.key === 'Escape') { setIsEditingZestimate(false); setZestimateInput(''); setZestimateUrlInput(''); } }}
                        placeholder='Zillow URL (optional)'
                        className='w-56 border border-indigo-400 rounded px-2 py-1 text-right text-xs'
                      />
                      <input
                        type='text'
                        autoFocus
                        value={zestimateInput}
                        onChange={(e) => setZestimateInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveManualZestimate(); if (e.key === 'Escape') { setIsEditingZestimate(false); setZestimateInput(''); setZestimateUrlInput(''); } }}
                        placeholder='$ value'
                        className='w-40 border border-indigo-400 rounded px-2 py-1 text-right text-lg font-bold'
                      />
                      <div className='flex gap-2'>
                        <button onClick={saveManualZestimate} className='text-xs font-bold text-green-600 hover:text-green-800'>✓ Save</button>
                        <button onClick={() => { setIsEditingZestimate(false); setZestimateInput(''); setZestimateUrlInput(''); }} className='text-xs text-slate-400 hover:text-slate-600'>✕ Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className='flex items-center justify-end gap-2'>
                        {lead.zillowUrl && lead.zestimate ? (
                          <a
                            href={lead.zillowUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-2xl md:text-4xl font-black text-indigo-600 tracking-tighter hover:text-indigo-800 underline underline-offset-4 transition-colors'
                          >
                            {formatCurrency(lead.zestimate)}
                          </a>
                        ) : (
                          <p className='text-2xl md:text-4xl font-black text-indigo-600 tracking-tighter'>
                            {formatCurrency(lead.zestimate ?? lead.estimatedValue)}
                          </p>
                        )}
                        <button
                          onClick={() => { setZestimateInput(''); setZestimateUrlInput(lead.zillowUrl || ''); setIsEditingZestimate(true); }}
                          title='Set value manually (Zillow URL and/or $ value)'
                          className='text-slate-400 hover:text-indigo-600 text-sm'
                        >
                          ✏️
                        </button>
                      </div>
                      {!lead.zestimate && lead.estimatedValue ? (
                        <p className='text-[10px] font-bold text-slate-400 mt-1'>from enrichment</p>
                      ) : lead.zestimateSource === 'MANUAL' ? (
                        <p className='text-[10px] font-bold text-slate-400 mt-1'>✏️ manual</p>
                      ) : null}
                    </>
                  )}
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
                  <div className='flex items-center justify-between mb-3'>
                    <h4 className='text-[10px] font-black uppercase text-slate-400 flex items-center gap-2'>
                      <HiOutlinePhone className='text-lg text-indigo-500' />{' '}
                      Phones (Quality Contacts)
                    </h4>
                    <button
                      onClick={() => { setNewPhoneInput(''); setNewPhoneType('Mobile'); setShowAddPhoneModal(true); }}
                      className='flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded border border-indigo-200 transition'
                    >
                      <FiPlus className='w-3 h-3' /> Add Phone
                    </button>
                  </div>
                  <div className='space-y-2'>
                    {lead.phones && lead.phones.length > 0 ? (
                      lead.phones.map((p: any, idx) => (
                        <div
                          key={idx}
                          className='flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group'
                        >
                          <div className='flex items-center gap-2'>
                            <span className='font-mono font-bold text-slate-700'>
                              {formatPhone(p.number || p)}
                            </span>
                            <span className='text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase'>
                              {p.type || 'Mobile'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeletePhone(p.number || p, false)}
                            disabled={isSavingContacts}
                            title='Remove Phone'
                            className='text-slate-300 hover:text-red-600 transition p-1'
                          >
                            <FiTrash2 className='w-3.5 h-3.5' />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className='text-xs text-slate-400 italic'>
                        No quality phone numbers found.
                      </p>
                    )}
                  </div>
                </div>
                {/* Landlines are stored apart from `phones` because they cannot receive SMS.
                    Shown as their own group so the channel is obvious before anyone dials or
                    tries to text. Only populated when the skip trace found no usable mobile. */}
                {(lead.landlinePhones?.length ?? 0) > 0 && (
                  <div>
                    <div className='flex items-center justify-between mb-3'>
                      <h4 className='text-[10px] font-black uppercase text-slate-400 flex items-center gap-2'>
                        <HiOutlinePhone className='text-lg text-amber-500' />{' '}
                        Landlines — call only, no SMS
                      </h4>
                      <button
                        onClick={() => { setNewPhoneInput(''); setNewPhoneType('Landline'); setShowAddPhoneModal(true); }}
                        className='flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded border border-amber-200 transition'
                      >
                        <FiPlus className='w-3 h-3' /> Add Landline
                      </button>
                    </div>
                    <div className='space-y-2'>
                      {lead.landlinePhones?.map((p: any, idx: number) => (
                        <div
                          key={idx}
                          className='flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100 group'
                        >
                          <div className='flex items-center gap-2'>
                            <span className='font-mono font-bold text-slate-700'>
                              {formatPhone(p)}
                            </span>
                            <span className='text-[9px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded uppercase'>
                              Landline
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeletePhone(p, true)}
                            disabled={isSavingContacts}
                            title='Remove Landline'
                            className='text-amber-300 hover:text-red-600 transition p-1'
                          >
                            <FiTrash2 className='w-3.5 h-3.5' />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className='flex items-center justify-between mb-3'>
                    <h4 className='text-[10px] font-black uppercase text-slate-400 flex items-center gap-2'>
                      <HiOutlineEnvelope className='text-lg text-indigo-500' />{' '}
                      Emails (Quality Contacts)
                    </h4>
                    <button
                      onClick={() => { setNewEmailInput(''); setShowAddEmailModal(true); }}
                      className='flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded border border-indigo-200 transition'
                    >
                      <FiPlus className='w-3 h-3' /> Add Email
                    </button>
                  </div>
                  <div className='space-y-2'>
                    {lead.emails && lead.emails.length > 0 ? (
                      lead.emails.map((e: any, idx) => (
                        <div
                          key={idx}
                          className='flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm font-medium text-slate-600 group'
                        >
                          <span>{e.address || e}</span>
                          <button
                            onClick={() => handleDeleteEmail(e.address || e)}
                            disabled={isSavingContacts}
                            title='Remove Email'
                            className='text-slate-300 hover:text-red-600 transition p-1'
                          >
                            <FiTrash2 className='w-3.5 h-3.5' />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className='text-xs text-slate-400 italic'>
                        No quality email addresses found.
                      </p>
                    )}
                  </div>
                </div>


                {/* #1 — What We Searched */}
                {['COMPLETED', 'NO_MATCH', 'FAILED', 'NO_QUALITY_CONTACTS'].includes(lead.skipTraceStatus || '') && (() => {
                  const isProbate = lead.type === 'PROBATE';
                  const searchedName = isProbate
                    ? [lead.adminFirstName, lead.adminLastName].filter(Boolean).join(' ')
                    : null;
                  const searchedAddr = isProbate
                    ? [lead.adminAddress || lead.mailingAddress, lead.adminCity || lead.mailingCity, lead.adminState || lead.mailingState, lead.adminZip || lead.mailingZip].filter(Boolean).join(', ')
                    : [lead.ownerAddress, lead.ownerCity, lead.ownerState, lead.ownerZip].filter(Boolean).join(', ');
                  return (
                    <div className='border-t pt-6'>
                      <h4 className='text-[10px] font-black uppercase text-slate-400 mb-3'>
                        What Was Searched
                      </h4>
                      <div className='p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1'>
                        {isProbate && searchedName && (
                          <p className='text-xs text-slate-500'>
                            <span className='font-semibold text-slate-700'>Name:</span> {searchedName}
                          </p>
                        )}
                        <p className='text-xs text-slate-500'>
                          <span className='font-semibold text-slate-700'>Address:</span> {searchedAddr || '—'}
                        </p>
                        {isProbate && (
                          <p className='text-[10px] text-slate-400 pt-1'>
                            Probate leads are skip traced using the estate administrator's address, not the property address.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* #2 — BatchData results with per-row filter breakdown */}
                {['COMPLETED', 'NO_QUALITY_CONTACTS'].includes(lead.skipTraceStatus || '') && lead.rawSkipTraceData && (() => {
                  const rawData = typeof lead.rawSkipTraceData === 'string'
                    ? JSON.parse(lead.rawSkipTraceData)
                    : lead.rawSkipTraceData;

                  const allPhones: any[] = rawData.allPhones || [];
                  const allEmails: any[] = rawData.allEmails || [];
                  const dncCount = allPhones.filter((p: any) => p.dnc).length;
                  const visiblePhones = allPhones.filter((p: any) => !p.dnc);

                  const phoneResult = (p: any): { passed: boolean; reason: string } => {
                    if (p.type !== 'Mobile') return { passed: false, reason: `Not mobile (${p.type || 'unknown type'})` };
                    if ((parseFloat(p.score) || 0) < 90) return { passed: false, reason: `Score too low (${p.score})` };
                    return { passed: true, reason: 'Sent to Launch AI' };
                  };

                  const emailResult = (e: any): { passed: boolean; reason: string } => {
                    if (!e.tested) return { passed: false, reason: 'Not verified' };
                    return { passed: true, reason: 'Sent to Launch AI' };
                  };

                  if (visiblePhones.length === 0 && allEmails.length === 0 && dncCount === 0) return null;

                  return (
                    <div className='border-t pt-6 space-y-5'>
                      <h4 className='text-[10px] font-black uppercase text-slate-400'>
                        BatchData Results
                      </h4>

                      {/* Phones */}
                      <div>
                        <p className='text-[10px] font-bold text-slate-500 uppercase mb-2'>
                          Phones ({allPhones.length} found · filter: mobile, score ≥ 90, not DNC)
                        </p>
                        <div className='space-y-1.5'>
                          {visiblePhones.map((p: any, idx: number) => {
                            const { passed, reason } = phoneResult(p);
                            return (
                              <div key={idx} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${passed ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                                <div className='flex items-center gap-2'>
                                  <span className={`font-bold text-sm ${passed ? 'text-green-600' : 'text-slate-400'}`}>
                                    {passed ? '✓' : '✗'}
                                  </span>
                                  <span className={`font-mono ${passed ? 'text-slate-800 font-semibold' : 'text-slate-400'}`}>
                                    {formatPhone(p.number)}
                                  </span>
                                </div>
                                <div className='flex items-center gap-2 text-[9px] font-bold'>
                                  <span className='bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded uppercase'>{p.type}</span>
                                  <span className='bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded'>Score {p.score}</span>
                                  <span className={`px-1.5 py-0.5 rounded uppercase ${passed ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {reason}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                          {dncCount > 0 && (
                            <div className='flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs'>
                              <span className='font-bold text-red-400'>✗</span>
                              <span className='text-red-600 font-medium'>{dncCount} number{dncCount !== 1 ? 's' : ''} hidden — Do Not Call list</span>
                            </div>
                          )}
                          {visiblePhones.length === 0 && dncCount === 0 && (
                            <p className='text-xs text-slate-400 italic px-1'>No phones returned by BatchData.</p>
                          )}
                        </div>
                      </div>

                      {/* Emails */}
                      <div>
                        <p className='text-[10px] font-bold text-slate-500 uppercase mb-2'>
                          Emails ({allEmails.length} found · filter: verified only)
                        </p>
                        <div className='space-y-1.5'>
                          {allEmails.length === 0 ? (
                            <p className='text-xs text-slate-400 italic px-1'>No emails returned by BatchData.</p>
                          ) : allEmails.map((e: any, idx: number) => {
                            const { passed, reason } = emailResult(e);
                            return (
                              <div key={idx} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${passed ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                                <div className='flex items-center gap-2'>
                                  <span className={`font-bold text-sm ${passed ? 'text-green-600' : 'text-slate-400'}`}>
                                    {passed ? '✓' : '✗'}
                                  </span>
                                  <span className={passed ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                                    {e.email}
                                  </span>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${passed ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                  {reason}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Skip Trace History */}
                <SkipTraceHistory history={lead.skipTraceHistory} />

                {/* #4 — GHL Sync Result */}
                {lead.ghlSyncStatus === 'SUCCESS' && (
                  <div className='border-t pt-6 mt-6'>
                    <h4 className='text-[10px] font-black uppercase text-slate-400 mb-3'>
                      Launch AI Sync
                    </h4>
                    <div className='p-3 bg-green-50 rounded-xl border border-green-200 space-y-1.5'>
                      <div className='flex items-center justify-between'>
                        <span className='text-xs font-semibold text-green-800'>✓ Synced to Launch AI</span>
                        {lead.ghlSyncDate && (
                          <span className='text-[10px] text-slate-500'>
                            {new Date(lead.ghlSyncDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                      {(lead.phones?.length || 0) > 1 && (
                        <p className='text-[10px] text-slate-600'>
                          {lead.phones?.length} contacts created — one per phone number.
                        </p>
                      )}
                      {lead.ghlContactId && (
                        <p className='text-[10px] text-slate-400 font-mono pt-0.5'>
                          Contact ID: {lead.ghlContactId}
                        </p>
                      )}
                      {(lead.emails?.length || 0) > 0 && (
                        <p className='text-[10px] text-slate-500'>
                          {lead.emails?.length} email{(lead.emails?.length || 0) !== 1 ? 's' : ''} synced — automated email outreach will be triggered by Launch AI workflow.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardWrapper>
          </div>

          {/* Property & Market Intelligence (MLS, Zestimate, HOA, Specs) */}
          <PropertyMarketIntel
            lead={lead}
            onRefreshZestimate={handleRefreshMarketIntel}
            isRefreshing={isRefreshingMarketIntel}
          />

          {lead.type === 'PREFORECLOSURE' && lead.batchDataEnriched && (
            <CardWrapper title='Property Enrichment (BatchData)'>
              <EnrichmentDetails lead={lead} />
            </CardWrapper>
          )}

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
            ) : !marketData ? (
              <div className='py-8 text-center'>
                <button
                  onClick={fetchMarketIntel}
                  className='bg-slate-800 text-white px-5 py-2 rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium'
                >
                  Load Property Details
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
                <OutreachStatus 
                  ghlContactId={lead.ghlContactId}
                  outreachData={outreachData}
                  onDataUpdate={setOutreachData}
                />

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

                    <div className='pt-3 border-t border-slate-100 space-y-1.5'>
                      <label className='text-[10px] font-bold text-slate-400 uppercase tracking-wider block'>
                        Pipeline / Outcome Status
                      </label>
                      <select
                        value={lead.listingStatus || 'off_market'}
                        disabled={isUpdatingDisposition}
                        onChange={(e) => handleDispositionChange(e.target.value)}
                        className='w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500'
                      >
                        <option value='off_market'>Off Market (Active Lead)</option>
                        <option value='active'>Active MLS Listing</option>
                        <option value='pending'>Under Contract / Pending</option>
                        <option value='sold'>Sold Already</option>
                        <option value='not_interested'>Not Interested</option>
                        <option value='listed_with_realtor'>Listed With Realtor</option>
                        <option value='wrong_number'>Wrong Number / Invalid</option>
                        <option value='dnc'>Do Not Call (DNC)</option>
                      </select>
                    </div>
                  </div>
                </CardWrapper>
              </>
            )}
          </div>
        </div>
      </div>
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        count={1}
      />

      {/* 🏠 EDIT PROPERTY ADDRESS MODAL */}
      {showEditAddressModal && (
        <div className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
          <div className='bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150'>
            <div className='flex items-center justify-between border-b pb-3'>
              <h3 className='text-lg font-bold text-slate-900'>Edit Property Address</h3>
              <button
                onClick={() => setShowEditAddressModal(false)}
                className='text-slate-400 hover:text-slate-600 text-sm font-bold'
              >
                ✕
              </button>
            </div>

            <div>
              <label className='block text-xs font-bold text-slate-500 uppercase mb-1.5'>
                Search New Address *
              </label>
              <AddressAutocomplete
                key={lead.id}
                onSelect={(addr) => {
                  setSelectedNewAddress(addr);
                  setManualStreet(addr.street);
                  setManualCity(addr.city);
                  setManualState(addr.state);
                  setManualZip(addr.zip);
                }}
                className='w-full'
              />
              {selectedNewAddress && (
                <p className='mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md p-2'>
                  ✓ {[selectedNewAddress.street, selectedNewAddress.city, selectedNewAddress.state, selectedNewAddress.zip].filter(Boolean).join(', ')}
                </p>
              )}

              <div className='pt-3 mt-3 border-t'>
                <button
                  type='button'
                  onClick={() => setShowManualFields(!showManualFields)}
                  className='text-xs text-indigo-600 hover:text-indigo-800 underline font-medium'
                >
                  {showManualFields ? 'Hide manual fields' : '✏️ Or edit address fields manually'}
                </button>

                {showManualFields && (
                  <div className='grid grid-cols-2 gap-2 mt-2 bg-slate-50 p-3 rounded-lg border text-xs space-y-1'>
                    <div className='col-span-2'>
                      <label className='block text-slate-600 font-medium'>Street Address</label>
                      <input
                        type='text'
                        value={manualStreet}
                        onChange={(e) => setManualStreet(e.target.value)}
                        className='w-full p-2 border rounded text-xs mt-0.5'
                        placeholder='e.g. 508 2nd St'
                      />
                    </div>
                    <div>
                      <label className='block text-slate-600 font-medium'>City</label>
                      <input
                        type='text'
                        value={manualCity}
                        onChange={(e) => setManualCity(e.target.value)}
                        className='w-full p-2 border rounded text-xs mt-0.5'
                        placeholder='e.g. Carlstadt'
                      />
                    </div>
                    <div>
                      <label className='block text-slate-600 font-medium'>State</label>
                      <input
                        type='text'
                        value={manualState}
                        onChange={(e) => setManualState(e.target.value)}
                        className='w-full p-2 border rounded text-xs mt-0.5'
                        placeholder='e.g. NJ'
                      />
                    </div>
                    <div className='col-span-2'>
                      <label className='block text-slate-600 font-medium'>ZIP Code</label>
                      <input
                        type='text'
                        value={manualZip}
                        onChange={(e) => setManualZip(e.target.value)}
                        className='w-full p-2 border rounded text-xs mt-0.5'
                        placeholder='e.g. 07072'
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className='flex gap-3 pt-2'>
              <button
                onClick={handleSaveAddress}
                disabled={isSavingAddress || (!selectedNewAddress && (!manualStreet || !manualCity || !manualState))}
                className='flex-1 bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition shadow-md'
              >
                {isSavingAddress ? 'Saving & Refreshing...' : 'Save & Refresh Market Intel'}
              </button>
              <button
                onClick={() => setShowEditAddressModal(false)}
                className='px-4 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📞 ADD PHONE MODAL */}
      {showAddPhoneModal && (
        <div className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
          <div className='bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150'>
            <div className='flex items-center justify-between border-b pb-3'>
              <h3 className='text-lg font-bold text-slate-900'>Add Phone Number</h3>
              <button
                onClick={() => setShowAddPhoneModal(false)}
                className='text-slate-400 hover:text-slate-600 text-sm font-bold'
              >
                ✕
              </button>
            </div>

            <div className='space-y-3'>
              <div>
                <label className='block text-xs font-bold text-slate-500 uppercase mb-1'>Phone Number *</label>
                <input
                  type='tel'
                  placeholder='(201) 555-1234'
                  value={newPhoneInput}
                  onChange={(e) => setNewPhoneInput(e.target.value)}
                  className='w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500'
                />
              </div>
              <div>
                <label className='block text-xs font-bold text-slate-500 uppercase mb-1'>Phone Type</label>
                <select
                  value={newPhoneType}
                  onChange={(e) => setNewPhoneType(e.target.value as any)}
                  className='w-full p-2.5 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500'
                >
                  <option value='Mobile'>Mobile (SMS & Calls)</option>
                  <option value='Landline'>Landline (Call Only)</option>
                </select>
              </div>
            </div>

            <div className='flex gap-3 pt-2'>
              <button
                onClick={handleAddPhone}
                disabled={isSavingContacts || !newPhoneInput.trim()}
                className='flex-1 bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition shadow-md'
              >
                {isSavingContacts ? 'Saving...' : 'Add Phone'}
              </button>
              <button
                onClick={() => setShowAddPhoneModal(false)}
                className='px-4 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✉️ ADD EMAIL MODAL */}
      {showAddEmailModal && (
        <div className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
          <div className='bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150'>
            <div className='flex items-center justify-between border-b pb-3'>
              <h3 className='text-lg font-bold text-slate-900'>Add Email Address</h3>
              <button
                onClick={() => setShowAddEmailModal(false)}
                className='text-slate-400 hover:text-slate-600 text-sm font-bold'
              >
                ✕
              </button>
            </div>

            <div className='space-y-3'>
              <div>
                <label className='block text-xs font-bold text-slate-500 uppercase mb-1'>Email Address *</label>
                <input
                  type='email'
                  placeholder='owner@example.com'
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  className='w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500'
                />
              </div>
            </div>

            <div className='flex gap-3 pt-2'>
              <button
                onClick={handleAddEmail}
                disabled={isSavingContacts || !newEmailInput.trim()}
                className='flex-1 bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition shadow-md'
              >
                {isSavingContacts ? 'Saving...' : 'Add Email'}
              </button>
              <button
                onClick={() => setShowAddEmailModal(false)}
                className='px-4 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
