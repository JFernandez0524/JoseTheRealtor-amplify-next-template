// app/(protected)/dashboard/page.tsx

'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { client } from '../../../app/utils/aws/data/frontEndClient';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { type Schema } from '@/amplify/data/resource';
import { downloadLeadsAsCsv } from '@/app/utils/csvExport';
// Import Amplify UI Components
import { Alert, Flex, Loader } from '@aws-amplify/ui-react';

// Import New Modular Components
import { DashboardFilters } from '@/app/components/dashboard/DashboardFilters';
import { LeadTable } from '@/app/components/dashboard/LeadTable';

// 1. CORRECT TYPE DEFINITION
type Lead = Schema['PropertyLead']['type'] & {
  ghlSyncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  ghlContactId?: string | null;
  ghlSyncDate?: string | null;
  notes?: string | null;
};

// Define the shape for the Alert state
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
    setAlertState({
      isVisible: true,
      variation,
      heading,
      body,
    });
  };

  const handleDismissAlert = () => {
    setAlertState((prev) => ({ ...prev, isVisible: false }));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads();
    }, 500);
    return () => clearTimeout(timer);
  }, [filterType, filterStatus, searchQuery, filterGhlStatus]);

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

      const leadIds = sortedLeads.map((l) => l.id);
      sessionStorage.setItem(
        'leadNavContext',
        JSON.stringify({
          ids: leadIds,
          filterType: filterType,
          filterStatus: filterStatus,
          filterGhlStatus: filterGhlStatus,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (err: any) {
      console.error(err);
      showAlert(
        'error',
        'Failed to Load Leads',
        err.message || 'Failed to retrieve data from the server.'
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
      if (lead && lead.skipTraceStatus === 'COMPLETED') {
        setSelectedLeads([...selectedLeads, id]);
      } else {
        showAlert(
          'warning',
          'Lead Not Ready',
          'This lead must be Skip Traced (COMPLETED status) before syncing to GHL.'
        );
      }
    }
  };

  const handleBulkSkipTrace = async () => {
    if (selectedLeads.length === 0) {
      showAlert(
        'warning',
        'Selection Required',
        'Please select at least one lead to skip trace.'
      );
      return;
    }
    if (!confirm(`Skip Trace ${selectedLeads.length} leads?`)) return;

    setIsSkipTracing(true);
    handleDismissAlert();

    try {
      await client.mutations.skipTraceLeads({
        leadIds: selectedLeads,
      });

      showAlert(
        'success',
        'Skip Trace Complete!',
        `${selectedLeads.length} leads have been processed and synced to GHL (if successful).`
      );
      setSelectedLeads([]);
      await fetchLeads();
    } catch (err: any) {
      console.error(err);
      showAlert(
        'error',
        'Skip Trace Failed.',
        err.message ||
          'An unexpected error occurred during the skip trace process.'
      );
    } finally {
      setIsSkipTracing(false);
    }
  };

  const handleBulkGHLSync = async () => {
    const leadsToSync = leads.filter(
      (l) => selectedLeads.includes(l.id) && l.skipTraceStatus === 'COMPLETED'
    );

    if (leadsToSync.length === 0) {
      showAlert(
        'warning',
        'Selection Required',
        'Please select at least one *completed* lead to sync to GHL.'
      );
      return;
    }

    if (!confirm(`Sync ${leadsToSync.length} leads to GoHighLevel?`)) return;

    setIsGhlSyncing(true);
    handleDismissAlert();
    let successfulSyncs = 0;

    try {
      await Promise.all(
        leadsToSync.map(async (lead) => {
          try {
            await client.mutations.manualGhlSync({
              leadId: lead.id,
            });
            successfulSyncs++;
          } catch (error) {
            console.error(`Failed to sync lead ${lead.id}:`, error);
          }
        })
      );

      showAlert(
        'success',
        'GHL Sync Initiated',
        `${successfulSyncs} of ${leadsToSync.length} leads are successfully syncing to GoHighLevel. Check the GHL Status column.`
      );

      setSelectedLeads([]);
      await fetchLeads();
    } catch (err: any) {
      console.error(err);
      showAlert(
        'error',
        'GHL Sync Failed',
        err.message ||
          'An unexpected error occurred during the GHL sync process.'
      );
    } finally {
      setIsGhlSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${selectedLeads.length} leads?`)) return;
    handleDismissAlert();

    try {
      await Promise.all(
        selectedLeads.map((id) => client.models.PropertyLead.delete({ id }))
      );
      showAlert(
        'success',
        'Delete Complete',
        `${selectedLeads.length} leads have been successfully deleted.`
      );
      setSelectedLeads([]);
      await fetchLeads();
    } catch (err: any) {
      console.error(err);
      showAlert(
        'error',
        'Delete Failed',
        err.message || 'Failed to delete selected leads.'
      );
    }
  };

  const handleExport = () => {
    const leadsToExport = leads.filter((l) => selectedLeads.includes(l.id));
    handleDismissAlert();

    if (leadsToExport.length === 0) {
      showAlert(
        'warning',
        'Selection Required',
        'Please select leads to export first.'
      );
      return;
    }

    const date = new Date().toISOString().split('T')[0];
    downloadLeadsAsCsv(leadsToExport, `mojo_export_${date}.csv`);
    showAlert(
      'info',
      'Export Started',
      'CSV export file generation has started.'
    );
  };

  const invalidLeadsCount = leads.filter(
    (l) => l.validationStatus === 'INVALID'
  ).length;

  const ghlSyncedCount = leads.filter(
    (l) => l.ghlSyncStatus === 'SUCCESS'
  ).length;
  const ghlFailedCount = leads.filter(
    (l) => l.ghlSyncStatus === 'FAILED'
  ).length;

  return (
    <main className='max-w-6xl mx-auto py-10 px-6'>
           {' '}
      <div className='flex justify-between items-center mb-8'>
               {' '}
        <h1 className='text-3xl font-bold text-gray-800'>Leads Dashboard</h1>   
           {' '}
        <div className='flex space-x-4'>
                   {' '}
          <button
            onClick={() => router.push('/upload')}
            className='bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition shadow-sm'
          >
                        Upload New Leads          {' '}
          </button>
                 {' '}
        </div>
             {' '}
      </div>
            {/* 🟢 ALERT BAR (Fix 1: Alert usage is correct here now) */}     {' '}
      {alertState.isVisible && (
        <Alert
          variation={alertState.variation}
          isDismissible
          onDismiss={handleDismissAlert}
          className='mb-6'
        >
                   {' '}
          <Flex direction='column'>
                       {' '}
            <strong className='text-lg'>{alertState.heading}</strong>           {' '}
            <p>{alertState.body}</p>         {' '}
          </Flex>
                 {' '}
        </Alert>
      )}
            {/* 🟢 NEW: CONDENSED HORIZONTAL STATS BAR (Fix 2: Modern Look) */} 
         {' '}
      <div className='bg-white shadow-sm border rounded-lg p-3 mb-6'>
               {' '}
        <Flex alignItems='center' gap='1.5rem' className='flex-wrap'>
                    {/* Metric 1: Total Leads */}         {' '}
          <div className='text-gray-700'>
                       {' '}
            <span className='font-bold text-lg'>{leads.length}</span> Total
            Leads          {' '}
          </div>
                   {/* Separator 1 */}         {' '}
          <div className='text-gray-300 hidden md:block'>|</div>         {' '}
          {/* Metric 2: Invalid Addresses (Red) */}         {' '}
          <div className='text-red-700'>
                       {' '}
            <span className='font-bold text-lg'>{invalidLeadsCount}</span>{' '}
            Invalid Addresses          {' '}
          </div>
          {/* Separator 2 */}         {' '}
          <div className='text-gray-300 hidden md:block'>|</div>         {' '}
          {/* Metric 3: GHL Synced (Purple) */}         {' '}
          <div className='text-purple-700'>
                       {' '}
            <span className='font-bold text-lg'>{ghlSyncedCount}</span> GHL
            Synced          {' '}
          </div>
          {/* Separator 3 */}         {' '}
          <div className='text-gray-300 hidden md:block'>|</div>         {' '}
          {/* Metric 4: GHL Failed/Pending (Gray/Default) */}         {' '}
          <div className='text-gray-600'>
                       {' '}
            <span className='font-bold text-lg'>
              {ghlFailedCount +
                leads.filter((l) => l.ghlSyncStatus === 'PENDING').length}
            </span>{' '}
            Failed/Pending          {' '}
          </div>
                 {' '}
        </Flex>
             {' '}
      </div>
            {/* 🟢 FILTERS AND BULK ACTIONS */}     {' '}
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
        handleBulkGHLSync={handleBulkGHLSync}
        handleDelete={handleDelete}
        handleExport={handleExport}
        isSkipTracing={isSkipTracing}
        isGhlSyncing={isGhlSyncing}
      />
            {/* 🟢 LEAD TABLE */}     {' '}
      <LeadTable
        leads={leads}
        isLoading={isLoading}
        selectedIds={selectedLeads}
        onToggleAll={toggleSelectAll}
        onToggleOne={toggleSelectLead}
        onRowClick={(id: string) => router.push(`/lead/${id}`)}
      />
         {' '}
    </main>
  );
}
