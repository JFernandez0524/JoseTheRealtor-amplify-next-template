'use client';

import React from 'react';
import { useState, useEffect } from 'react';
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

type Lead = Schema['PropertyLead']['type'];

// Define the shape for the Alert state
type AlertState = {
  isVisible: boolean;
  variation: 'success' | 'error' | 'warning' | 'info';
  heading: string;
  body: string;
};

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]); // Filter States

  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSkipTracing, setIsSkipTracing] = useState(false); // Removed 'error' state, all errors handled by alertState
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // 🟢 STATE FOR AMPLIFY ALERT

  const [alertState, setAlertState] = useState<AlertState>({
    isVisible: false,
    variation: 'info',
    heading: '',
    body: '',
  });

  const router = useRouter(); // 🟢 HELPER FUNCTION TO DISPLAY ALERT

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
  }; // Debounced fetch on filter change

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads();
    }, 500);
    return () => clearTimeout(timer);
  }, [filterType, filterStatus, searchQuery]);

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

      const hasFilters = Object.keys(filterInput).length > 0;

      const { data, errors } = await client.models.PropertyLead.list({
        authMode: 'userPool',
        filter: hasFilters ? filterInput : undefined,
      });

      if (errors && errors.length > 0) throw new Error(errors[0].message);
      if (!data) throw new Error('No data returned');

      const sortedLeads = data.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setLeads(sortedLeads);
    } catch (err: any) {
      console.error(err); // 🟢 FIX: Use showAlert for fetch errors
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
      setSelectedLeads(leads.map((l) => l.id));
    }
  };

  const toggleSelectLead = (id: string) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter((l) => l !== id));
    } else {
      setSelectedLeads([...selectedLeads, id]);
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
    } // Retain the native confirm for bulk action safety
    if (!confirm(`Skip Trace ${selectedLeads.length} leads?`)) return;

    setIsSkipTracing(true);
    handleDismissAlert();

    try {
      await client.mutations.skipTraceLeads({
        leadIds: selectedLeads,
        targetCrm: 'NONE',
      }); // 🟢 SUCCESS ALERT FOR SKIP TRACE

      showAlert(
        'success',
        'Skip Trace Complete!',
        `${selectedLeads.length} leads have been processed and synced to GHL.`
      );
      setSelectedLeads([]);
      await fetchLeads();
    } catch (err: any) {
      console.error(err); // 🛑 ERROR ALERT FOR SKIP TRACE
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

  const handleDelete = async () => {
    if (!confirm(`Delete ${selectedLeads.length} leads?`)) return;
    handleDismissAlert();

    try {
      await Promise.all(
        selectedLeads.map((id) => client.models.PropertyLead.delete({ id }))
      ); // 🟢 SUCCESS ALERT FOR DELETE
      showAlert(
        'success',
        'Delete Complete',
        `${selectedLeads.length} leads have been successfully deleted.`
      );
      setSelectedLeads([]);
      await fetchLeads();
    } catch (err: any) {
      console.error(err); // 🛑 ERROR ALERT FOR DELETE
      showAlert(
        'error',
        'Delete Failed',
        err.message || 'Failed to delete selected leads.'
      );
    }
  };

  const handleExport = () => {
    // Filter leads to only get the selected ones
    const leadsToExport = leads.filter((l) => selectedLeads.includes(l.id));
    handleDismissAlert();

    if (leadsToExport.length === 0) {
      // ⚠️ WARNING ALERT FOR EXPORT
      showAlert(
        'warning',
        'Selection Required',
        'Please select leads to export first.'
      );
      return;
    }

    const date = new Date().toISOString().split('T')[0];
    downloadLeadsAsCsv(leadsToExport, `mojo_export_${date}.csv`); // 🟢 INFO ALERT FOR EXPORT START
    showAlert(
      'info',
      'Export Started',
      'CSV export file generation has started.'
    );
  };

  const invalidLeadsCount = leads.filter(
    (l) => l.validationStatus === 'INVALID'
  ).length;

  return (
    <main className='p-6 max-w-[95%] mx-auto'>
            {/* 🟢 AMPLIFY ALERT COMPONENT */}     {' '}
      {alertState.isVisible && (
        <Alert
          variation={alertState.variation}
          heading={alertState.heading}
          isDismissible={true}
          onDismiss={handleDismissAlert}
          hasIcon={true}
          marginBottom='size.large'
        >
                    {alertState.body}       {' '}
        </Alert>
      )}
            {/* Header & Actions */}     {' '}
      <div className='flex flex-col md:flex-row justify-between items-center mb-6 gap-4'>
               {' '}
        <div>
                   {' '}
          <h1 className='text-3xl font-bold text-gray-800'>All Leads Data</h1> 
                 {' '}
          {currentUserId && (
            <p className='text-xs text-gray-500 font-mono'>
                            User: {currentUserId}           {' '}
            </p>
          )}
                 {' '}
        </div>
               {' '}
        <div className='flex flex-wrap gap-2'>
                   {' '}
          <button
            onClick={fetchLeads}
            className='bg-white border text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50'
          >
                        🔄 Refresh          {' '}
          </button>
                   {' '}
          <button
            onClick={() => router.push('/upload')}
            className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700'
          >
                        Upload CSV          {' '}
          </button>
                   {' '}
          {selectedLeads.length > 0 && (
            <>
                           {' '}
              <button
                onClick={handleBulkSkipTrace}
                disabled={isSkipTracing}
                className='bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50'
              >
                               {' '}
                {isSkipTracing
                  ? 'Processing...'
                  : `🔍 Skip Trace (${selectedLeads.length})`}
                             {' '}
              </button>
                           {' '}
              <button
                onClick={handleDelete}
                className='bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600'
              >
                                Delete ({selectedLeads.length})            
                 {' '}
              </button>
                           {' '}
              <button
                onClick={handleExport}
                className='bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition shadow-sm flex items-center gap-2'
              >
                                📥 Export CSV              {' '}
              </button>
                         {' '}
            </>
          )}
                 {' '}
        </div>
             {' '}
      </div>
            {/* Invalid Warning */}     {' '}
      {invalidLeadsCount > 0 && (
        <div className='bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6 flex items-center gap-3'>
                    <span className='text-xl'>⚠️</span>         {' '}
          <div>
                        <strong>Attention Needed: </strong>            Found{' '}
            {invalidLeadsCount} invalid addresses. Check rows marked            
            "INVALID".          {' '}
          </div>
                 {' '}
        </div>
      )}
            {/* Filters Component */}     {' '}
      <DashboardFilters
        filterType={filterType}
        setFilterType={setFilterType}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
            {/* Stats (Fixed for Responsiveness) */}     {' '}
      <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6'>
               {' '}
        <div className='bg-white rounded-lg shadow p-4 border'>
                    <p className='text-gray-600 text-sm'>Total Leads</p>       
            <p className='text-3xl font-bold text-gray-900'>{leads.length}</p> 
               {' '}
        </div>
               {' '}
        <div className='bg-white rounded-lg shadow p-4 border'>
                    <p className='text-gray-600 text-sm'>Pending Trace</p>     
             {' '}
          <p className='text-3xl font-bold text-yellow-600'>
                       {' '}
            {leads.filter((l) => l.skipTraceStatus === 'PENDING').length}       
             {' '}
          </p>
                 {' '}
        </div>
               {' '}
        <div className='bg-white rounded-lg shadow p-4 border'>
                    <p className='text-gray-600 text-sm'>Enriched</p>         {' '}
          <p className='text-3xl font-bold text-green-600'>
                       {' '}
            {leads.filter((l) => l.skipTraceStatus === 'COMPLETED').length}     
               {' '}
          </p>
                 {' '}
        </div>
               {' '}
        <div className='bg-white rounded-lg shadow p-4 border'>
                    <p className='text-gray-600 text-sm'>Failed/No Match</p>   
               {' '}
          <p className='text-3xl font-bold text-red-600'>
                       {' '}
            {
              leads.filter(
                (l) =>
                  l.skipTraceStatus === 'FAILED' ||
                  l.skipTraceStatus === 'NO_MATCH'
              ).length
            }
                     {' '}
          </p>{' '}
        </div>
             {' '}
      </div>
      {/* Table Component */}{' '}
      <LeadTable
        leads={leads}
        selectedIds={selectedLeads}
        isLoading={isLoading}
        onToggleAll={toggleSelectAll}
        onToggleOne={toggleSelectLead}
        onRowClick={(id) => router.push(`/lead/${id}`)}
      />{' '}
    </main>
  );
}
