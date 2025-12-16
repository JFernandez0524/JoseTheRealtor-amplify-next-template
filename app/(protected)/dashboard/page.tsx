'use client';

import React from 'react';
import { useState, useEffect, Dispatch, SetStateAction } from 'react'; // 💥 Import Dispatch/SetStateAction for clarity
import { useRouter } from 'next/navigation';
import { client } from '../../../app/utils/aws/data/frontEndClient';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { type Schema } from '@/amplify/data/resource';
import { downloadLeadsAsCsv } from '@/app/utils/csvExport';
// Import Amplify UI Components
import { Alert, Flex } from '@aws-amplify/ui-react';

// Import New Modular Components
import { DashboardFilters } from '@/app/components/dashboard/DashboardFilters';
import { LeadTable } from '@/app/components/dashboard/LeadTable';

// 1. CORRECT TYPE DEFINITION
type Lead = Schema['PropertyLead']['type'] & {
  ghlSyncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  ghlContactId?: string;
  ghlSyncDate?: string;
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

  // Filter States
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterGhlStatus, setFilterGhlStatus] = useState<string>(''); // 💥 NEW GHL FILTER STATE

  const [isLoading, setIsLoading] = useState(true);
  const [isSkipTracing, setIsSkipTracing] = useState(false);
  const [isGhlSyncing, setIsGhlSyncing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 🟢 STATE FOR AMPLIFY ALERT
  const [alertState, setAlertState] = useState<AlertState>({
    isVisible: false,
    variation: 'info',
    heading: '',
    body: '',
  });

  const router = useRouter();

  // 🟢 HELPER FUNCTION TO DISPLAY ALERT
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

  // Debounced fetch on filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads();
    }, 500);
    return () => clearTimeout(timer);
  }, [filterType, filterStatus, searchQuery, filterGhlStatus]); // 💥 ADD NEW FILTER TO DEPENDENCIES

  const fetchLeads = async () => {
    setIsLoading(true);
    handleDismissAlert(); // Clear previous alerts on refresh

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

      // 💥 NEW: ADD GHL STATUS FILTER LOGIC
      if (filterGhlStatus === 'NULL') {
        // Find leads where ghlSyncStatus is NOT set (null/undefined)
        filterInput.ghlSyncStatus = {
          notContains: 'SUCCESS|FAILED|SKIPPED|PENDING',
        };
      } else if (filterGhlStatus) {
        filterInput.ghlSyncStatus = { eq: filterGhlStatus };
      }
      // END NEW BLOCK

      const hasFilters = Object.keys(filterInput).length > 0;

      // SAVE NAVIGATION CONTEXT TO SESSION STORAGE BEFORE QUERY
      // This is crucial for the detail page navigation to work
      // Note: We cannot rely on the query result directly, we must save the list of IDs from the query.

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

      // 💥 SAVE NAVIGATION CONTEXT TO SESSION STORAGE
      const leadIds = sortedLeads.map((l) => l.id);
      sessionStorage.setItem(
        'leadNavContext',
        JSON.stringify({
          ids: leadIds,
          filterType: filterType,
          filterStatus: filterStatus,
          filterGhlStatus: filterGhlStatus, // Save new filter state
          timestamp: new Date().toISOString(),
        })
      );
      // END NEW BLOCK
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
      // Only select leads that have been completed skip-trace (COMPLETED status)
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
      // Optional check: only allow selecting leads with COMPLETED status for sync
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
    // ... (Skip Trace logic remains the same) ...
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
    // Filter to only allow leads with COMPLETED status for GHL sync (safety check)
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
            await client.mutations.syncLeadToGHL({
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
    // ... (Delete logic remains the same) ...
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
    // ... (Export logic remains the same) ...
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
    <main className='p-6 max-w-[95%] mx-auto'>
      {/* 🟢 AMPLIFY ALERT COMPONENT */}
      {alertState.isVisible && (
        <Alert
          variation={alertState.variation}
          heading={alertState.heading}
          isDismissible={true}
          onDismiss={handleDismissAlert}
          hasIcon={true}
          marginBottom='size.large'
        >
          {alertState.body}
        </Alert>
      )}

      {/* Header & Actions */}
      <div className='flex flex-col md:flex-row justify-between items-center mb-6 gap-4'>
        <div>
          <h1 className='text-3xl font-bold text-gray-800'>All Leads Data</h1>
          {currentUserId && (
            <p className='text-xs text-gray-500 font-mono'>
              User: {currentUserId}
            </p>
          )}
        </div>

        <div className='flex flex-wrap gap-2'>
          <button
            onClick={fetchLeads}
            className='bg-white border text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50'
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => router.push('/upload')}
            className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700'
          >
            Upload CSV
          </button>

          {selectedLeads.length > 0 && (
            <>
              {/* Skip Trace Button */}
              <button
                onClick={handleBulkSkipTrace}
                disabled={isSkipTracing}
                className='bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50'
              >
                {isSkipTracing
                  ? 'Processing...'
                  : `🔍 Skip Trace (${selectedLeads.length})`}
              </button>

              {/* 💥 NEW GHL SYNC BUTTON */}
              <button
                onClick={handleBulkGHLSync}
                disabled={isGhlSyncing || isSkipTracing}
                className='bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50'
              >
                {isGhlSyncing
                  ? 'Syncing GHL...'
                  : `⬆️ Sync GHL (${selectedLeads.length})`}
              </button>

              {/* Delete Button */}
              <button
                onClick={handleDelete}
                className='bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600'
              >
                🗑️ Delete ({selectedLeads.length})
              </button>

              {/* Export Button */}
              <button
                onClick={handleExport}
                className='bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition shadow-sm flex items-center gap-2'
              >
                📥 Export CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Invalid Warning */}
      {invalidLeadsCount > 0 && (
        <div className='bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6 flex items-center gap-3'>
          <span className='text-xl'>⚠️</span>
          <div>
            <strong>Attention Needed: </strong> Found
            {invalidLeadsCount} invalid addresses. Check rows marked "INVALID".
          </div>
        </div>
      )}

      {/* Filters Component */}
      <DashboardFilters
        filterType={filterType}
        setFilterType={setFilterType}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterGhlStatus={filterGhlStatus} // 💥 PASS NEW STATE
        setFilterGhlStatus={setFilterGhlStatus} // 💥 PASS NEW SETTER
      />

      {/* Stats (Updated with GHL stats) */}
      <div className='grid grid-cols-2 sm:grid-cols-2 md:grid-cols-6 gap-4 mb-6'>
        <div className='bg-white rounded-lg shadow p-4 border'>
          <p className='text-gray-600 text-sm'>Total Leads</p>
          <p className='text-3xl font-bold text-gray-900'>{leads.length}</p>
        </div>

        <div className='bg-white rounded-lg shadow p-4 border'>
          <p className='text-gray-600 text-sm'>Pending Trace</p>
          <p className='text-3xl font-bold text-yellow-600'>
            {leads.filter((l) => l.skipTraceStatus === 'PENDING').length}
          </p>
        </div>

        <div className='bg-white rounded-lg shadow p-4 border'>
          <p className='text-gray-600 text-sm'>Enriched</p>
          <p className='text-3xl font-bold text-green-600'>
            {leads.filter((l) => l.skipTraceStatus === 'COMPLETED').length}
          </p>
        </div>

        {/* GHL SYNC STATS */}
        <div className='bg-white rounded-lg shadow p-4 border'>
          <p className='text-gray-600 text-sm'>GHL Synced</p>
          <p className='text-3xl font-bold text-purple-600'>{ghlSyncedCount}</p>
        </div>
        <div className='bg-white rounded-lg shadow p-4 border'>
          <p className='text-gray-600 text-sm'>GHL Failed</p>
          <p className='text-3xl font-bold text-orange-600'>{ghlFailedCount}</p>
        </div>

        <div className='bg-white rounded-lg shadow p-4 border'>
          <p className='text-gray-600 text-sm'>Failed/No Match</p>
          <p className='text-3xl font-bold text-red-600'>
            {
              leads.filter(
                (l) =>
                  l.skipTraceStatus === 'FAILED' ||
                  l.skipTraceStatus === 'NO_MATCH'
              ).length
            }
          </p>
        </div>
      </div>

      {/* Table Component */}
      <LeadTable
        leads={leads}
        selectedIds={selectedLeads}
        isLoading={isLoading}
        onToggleAll={toggleSelectAll}
        onToggleOne={toggleSelectLead}
        onRowClick={(id) => router.push(`/lead/${id}`)}
      />
    </main>
  );
}
