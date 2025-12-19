'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { client } from '../../../app/utils/aws/data/frontEndClient';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { type Schema } from '@/amplify/data/resource';
import { downloadLeadsAsCsv } from '@/app/utils/csvExport';
import { Alert, Flex, Loader } from '@aws-amplify/ui-react';

// Modular Components
import { DashboardFilters } from '@/app/components/dashboard/DashboardFilters';
import { LeadTable } from '@/app/components/dashboard/LeadTable';

type Lead = Schema['PropertyLead']['type'] & {
  ghlSyncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  ghlContactId?: string | null;
  ghlSyncDate?: string | null;
  notes?: string | null;
};

type AlertState = {
  isVisible: boolean;
  variation: 'success' | 'error' | 'warning' | 'info';
  heading: string;
  body: string;
};

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterGhlStatus, setFilterGhlStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSkipTracing, setIsSkipTracing] = useState(false);
  const [isGhlSyncing, setIsGhlSyncing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [alertState, setAlertState] = useState<AlertState>({
    isVisible: false,
    variation: 'info',
    heading: '',
    body: '',
  });

  const router = useRouter();

  const showAlert = (
    variation: AlertState['variation'],
    heading: string,
    body: string
  ) => {
    setAlertState({ isVisible: true, variation, heading, body });
  };

  const handleDismissAlert = () => {
    setAlertState((prev) => ({ ...prev, isVisible: false }));
  };

  // 🎯 INITIAL DATA LOAD
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads();
    }, 500);
    return () => clearTimeout(timer);
  }, [filterType, filterStatus, searchQuery, filterGhlStatus]);

  // 🚀 REAL-TIME SUBSCRIPTION
  // This catches new leads as the Lambda handler finishes geocoding them
  useEffect(() => {
    if (!currentUserId) return;

    const subscription = client.models.PropertyLead.onCreate().subscribe({
      next: (newLead) => {
        // Only update if the lead belongs to the current user
        if (newLead.owner === currentUserId) {
          console.log('🚀 Real-time Lead Received:', newLead);
          setLeads((prevLeads) => {
            // Check for duplicates in case of race condition with fetch
            if (prevLeads.some((l) => l.id === newLead.id)) return prevLeads;
            return [newLead as Lead, ...prevLeads];
          });
        }
      },
      error: (error) => console.warn('Subscription error:', error),
    });

    return () => subscription.unsubscribe();
  }, [currentUserId]);

  const fetchLeads = async () => {
    setIsLoading(true);
    handleDismissAlert();

    try {
      const user = await getFrontEndUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setCurrentUserId(user.userId);

      const filterInput: any = {};
      if (filterType) filterInput.type = { eq: filterType };
      if (filterStatus) filterInput.skipTraceStatus = { eq: filterStatus };
      if (searchQuery) filterInput.ownerAddress = { contains: searchQuery };

      if (filterGhlStatus === 'NULL') {
        filterInput.ghlSyncStatus = {
          notContains: 'SUCCESS|FAILED|SKIPPED|PENDING',
        };
      } else if (filterGhlStatus) {
        filterInput.ghlSyncStatus = { eq: filterGhlStatus };
      }

      const hasFilters = Object.keys(filterInput).length > 0;
      const { data, errors } = await client.models.PropertyLead.list({
        authMode: 'userPool',
        filter: hasFilters ? filterInput : undefined,
      });

      if (errors && errors.length > 0) throw new Error(errors[0].message);
      if (!data) throw new Error('No data returned');

      const sortedLeads = (data as Lead[]).sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setLeads(sortedLeads);
    } catch (err: any) {
      console.error(err);
      showAlert(
        'error',
        'Failed to Load Leads',
        err.message || 'Server error.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else {
      const readyLeads = leads
        .filter((l) => l.skipTraceStatus === 'COMPLETED')
        .map((l) => l.id);
      setSelectedLeads(readyLeads);
    }
  };

  const toggleSelectLead = (id: string) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter((l) => l !== id));
    } else {
      const lead = leads.find((l) => l.id === id);
      if (lead?.skipTraceStatus === 'COMPLETED') {
        setSelectedLeads([...selectedLeads, id]);
      } else {
        showAlert(
          'warning',
          'Lead Not Ready',
          'This lead must be Skip Traced first.'
        );
      }
    }
  };

  const handleBulkSkipTrace = async () => {
    if (selectedLeads.length === 0)
      return showAlert('warning', 'Selection Required', 'Select a lead.');
    if (!confirm(`Skip Trace ${selectedLeads.length} leads?`)) return;

    setIsSkipTracing(true);
    handleDismissAlert();

    try {
      await client.mutations.skipTraceLeads({ leadIds: selectedLeads });
      showAlert(
        'success',
        'Skip Trace Complete!',
        `${selectedLeads.length} leads processed.`
      );
      setSelectedLeads([]);
      await fetchLeads();
    } catch (err: any) {
      showAlert('error', 'Skip Trace Failed.', err.message);
    } finally {
      setIsSkipTracing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${selectedLeads.length} leads?`)) return;
    try {
      await Promise.all(
        selectedLeads.map((id) => client.models.PropertyLead.delete({ id }))
      );
      showAlert('success', 'Delete Complete', 'Leads successfully deleted.');
      setSelectedLeads([]);
      await fetchLeads();
    } catch (err: any) {
      showAlert('error', 'Delete Failed', err.message);
    }
  };

  const handleExport = () => {
    const leadsToExport = leads.filter((l) => selectedLeads.includes(l.id));
    if (leadsToExport.length === 0)
      return showAlert('warning', 'Selection Required', 'Select leads.');
    downloadLeadsAsCsv(
      leadsToExport,
      `export_${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const invalidLeadsCount = leads.filter(
    (l) => l.validationStatus === 'INVALID'
  ).length;
  const ghlSyncedCount = leads.filter(
    (l) => l.ghlSyncStatus === 'SUCCESS'
  ).length;
  const ghlFailedCount = leads.filter(
    (l) => l.ghlSyncStatus === 'FAILED' || l.ghlSyncStatus === 'PENDING'
  ).length;

  return (
    <main className='max-w-6xl mx-auto py-10 px-6'>
      <div className='flex justify-between items-center mb-8'>
        <h1 className='text-3xl font-bold text-gray-800'>Leads Dashboard</h1>
        <button
          onClick={() => router.push('/upload')}
          className='bg-green-600 text-white px-6 py-2 rounded-xl hover:bg-green-700 transition shadow-sm font-bold'
        >
          Upload New Leads
        </button>
      </div>

      {alertState.isVisible && (
        <Alert
          variation={alertState.variation}
          isDismissible
          onDismiss={handleDismissAlert}
          className='mb-6'
        >
          <Flex direction='column'>
            <strong className='text-lg'>{alertState.heading}</strong>
            <p>{alertState.body}</p>
          </Flex>
        </Alert>
      )}

      <div className='bg-white shadow-sm border rounded-[1.5rem] p-6 mb-8'>
        <Flex alignItems='center' gap='1.5rem' className='flex-wrap'>
          <div className='text-gray-700'>
            <span className='font-bold text-lg'>{leads.length}</span> Total
            Leads
          </div>
          <div className='text-gray-300 hidden md:block'>|</div>
          <div className='text-red-700'>
            <span className='font-bold text-lg'>{invalidLeadsCount}</span>{' '}
            Invalid Addresses
          </div>
          <div className='text-gray-300 hidden md:block'>|</div>
          <div className='text-purple-700'>
            <span className='font-bold text-lg'>{ghlSyncedCount}</span> GHL
            Synced
          </div>
          <div className='text-gray-300 hidden md:block'>|</div>
          <div className='text-gray-600'>
            <span className='font-bold text-lg'>{ghlFailedCount}</span>{' '}
            Failed/Pending
          </div>
        </Flex>
      </div>

      <DashboardFilters
        filterType={filterType}
        setFilterType={setFilterType}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterGhlStatus={filterGhlStatus}
        setFilterGhlStatus={setFilterGhlStatus}
        selectedLeadsCount={selectedLeads.length}
        handleBulkSkipTrace={handleBulkSkipTrace}
        handleBulkGHLSync={async () => {}} // Implementation omitted for brevity
        handleDelete={handleDelete}
        handleExport={handleExport}
        isSkipTracing={isSkipTracing}
        isGhlSyncing={isGhlSyncing}
      />

      <LeadTable
        leads={leads}
        isLoading={isLoading}
        selectedIds={selectedLeads}
        onToggleAll={toggleSelectAll}
        onToggleOne={toggleSelectLead}
        onRowClick={(id: string) => router.push(`/lead/${id}`)}
      />
    </main>
  );
}
