'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { useAccess } from '@/app/context/AccessContext';
import { LeadTable } from './LeadTable';
import { DashboardFilters } from './DashboardFilters';
import { GhlConnection } from './GhlConnection';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import type { Schema } from '@/amplify/data/resource';

type Lead = Schema['PropertyLead']['type'];
type UserAccount = Schema['UserAccount']['type'];

interface Props {
  initialLeads: Lead[];
}

export default function LeadDashboardClient({ initialLeads }: Props) {
  const router = useRouter();
  const { hasPaidPlan, isAdmin } = useAccess();

  // --- State ---
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [allLeads, setAllLeads] = useState<Lead[]>(initialLeads); // Store all leads
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100); // Show 100 leads per page

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCrmStatus, setFilterCrmStatus] = useState('');
  const [filterHasPhone, setFilterHasPhone] = useState('');

  // --- Effects ---

  // 1. Listen for Real-time Lead updates
  useEffect(() => {
    const sub = client.models.PropertyLead.observeQuery().subscribe({
      next: ({ items, isSynced }) => {
        setAllLeads([...items]); // Store all leads
        setIsSynced(isSynced);
      },
      error: (err) => console.error('Subscription error:', err),
    });
    return () => sub.unsubscribe();
  }, []);

  // 2. Ensure UserAccount exists (Wallet Initialization)
  useEffect(() => {
    async function syncUserAccount() {
      try {
        const user = await getFrontEndUser();
        if (!user) return;

        // Fix: Only fetch existing account, don't create new ones
        const { data: accounts } = await client.models.UserAccount.list({
          filter: { owner: { eq: user.userId } },
        });

        if (accounts.length > 0) {
          setUserAccount(accounts[0]);
        }
        // Note: Account creation is handled by AccessContext
      } catch (err) {
        console.error('UserAccount error:', err);
      }
    }
    syncUserAccount();
  }, []);

  // --- Filter Logic ---
  const filteredLeads = useMemo(() => {
    return allLeads.filter((lead) => {
      const search = searchQuery.toLowerCase();
      const matchesSearch =
        lead.ownerAddress?.toLowerCase().includes(search) ||
        lead.ownerLastName?.toLowerCase().includes(search);

      const matchesType = !filterType || lead.type === filterType;
      const matchesStatus =
        !filterStatus || lead.skipTraceStatus === filterStatus;

      const matchesCrm =
        !filterCrmStatus ||
        (filterCrmStatus === 'NULL'
          ? !lead.ghlSyncStatus
          : lead.ghlSyncStatus === filterCrmStatus);

      const matchesPhone = !filterHasPhone || 
        (filterHasPhone === 'HAS_PHONE' 
          ? lead.phones && lead.phones.length > 0
          : filterHasPhone === 'NO_PHONE'
          ? !lead.phones || lead.phones.length === 0
          : true);

      return matchesSearch && matchesType && matchesStatus && matchesCrm && matchesPhone;
    });
  }, [allLeads, searchQuery, filterType, filterStatus, filterCrmStatus, filterHasPhone]);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, filterStatus, filterCrmStatus, filterHasPhone]);

  // --- Action Handlers ---

  const handleBulkGHLSync = async () => {
    if (selectedIds.length === 0) return;

    if (!hasPaidPlan) {
      alert('CRM Sync requires a PRO or AI membership.');
      router.push('/pricing');
      return;
    }

    if (!confirm(`Sync ${selectedIds.length} leads to your CRM?`)) return;

    setIsProcessing(true);
    try {
      // Loop through selected leads and trigger the manual sync mutation
      await Promise.all(
        selectedIds.map((id) => client.mutations.manualGhlSync({ leadId: id }))
      );
      alert(`Successfully initiated CRM sync for ${selectedIds.length} leads.`);
      setSelectedIds([]);
    } catch (err) {
      console.error('Sync error:', err);
      alert('Error initiating CRM sync. Ensure leads are skip-traced first.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkSkipTrace = async () => {
    if (selectedIds.length === 0) return;

    // Skip credit check for admins
    if (!isAdmin) {
      const currentCredits = userAccount?.credits || 0;
      if (currentCredits < selectedIds.length) {
        alert(`Insufficient Credits! You need ${selectedIds.length}...`);
        return;
      }
    }

    if (!confirm(`Skip-trace ${selectedIds.length} leads?`)) return;

    setIsProcessing(true);
    try {
      // 1. Capture the data result
      const { data, errors } = await client.mutations.skipTraceLeads({
        leadIds: selectedIds,
      });

      if (errors) throw new Error(errors[0].message);

      // 2. Since your handler returns the 'results' array:
      // data looks like: [{ id: '...', status: 'SUCCESS', phones: 2 }, ...]
      const results = data as Array<{ id: string; status: string }>;
      const successful = results.filter((r) => r.status === 'SUCCESS').length;
      const failed = results.filter(
        (r) => r.status === 'FAILED' || r.status === 'ERROR'
      ).length;

      // 3. Precise Feedback
      alert(
        `Skip-trace complete!\n✅ Successful: ${successful}\n❌ Failed/No Match: ${failed}`
      );

      setSelectedIds([]);
    } catch (err) {
      console.error('Skip-trace error:', err);
      alert('Error during skip-trace. Check your network connection.');
    } finally {
      setIsProcessing(false);
    }
  };
  const handleDeleteLeads = async () => {
    if (!isAdmin) {
      alert('Unauthorized: Only Admins can bulk delete leads.');
      return;
    }
    if (
      !confirm(
        `Are you sure you want to permanently delete ${selectedIds.length} leads?`
      )
    )
      return;

    setIsProcessing(true);
    try {
      await Promise.all(
        selectedIds.map((id) => client.models.PropertyLead.delete({ id }))
      );
      setSelectedIds([]);
      alert('Leads deleted successfully.');
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className='space-y-4'>
      <DashboardFilters
        filterType={filterType}
        setFilterType={setFilterType}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterGhlStatus={filterCrmStatus}
        setFilterGhlStatus={setFilterCrmStatus}
        filterHasPhone={filterHasPhone}
        setFilterHasPhone={setFilterHasPhone}
        selectedLeadsCount={selectedIds.length}
        isSkipTracing={isProcessing}
        isGhlSyncing={isProcessing}
        handleBulkSkipTrace={handleBulkSkipTrace}
        handleBulkGHLSync={handleBulkGHLSync}
        handleDelete={handleDeleteLeads}
        handleExport={() => alert('Exporting leads to CSV...')}
      />

      {/* GHL Connection Status */}
      <GhlConnection />

      {/* Wallet Status Bar */}
      <div className='flex justify-end items-center gap-4 px-2'>
        {!isSynced && (
          <div className='flex items-center gap-2 text-[11px] font-bold uppercase tracking-tighter text-blue-600 bg-blue-50 border border-blue-200 px-4 py-1.5 rounded-full shadow-sm'>
            <span className='w-2 h-2 rounded-full bg-blue-500 animate-pulse' />
            Syncing...
          </div>
        )}
        <div className='flex items-center gap-2 text-[11px] font-bold uppercase tracking-tighter text-slate-500 bg-white border border-slate-200 px-4 py-1.5 rounded-full shadow-sm'>
          <span className='w-2 h-2 rounded-full bg-green-500 animate-pulse' />
          Available Wallet:{' '}
          <span className='text-slate-900'>
            {userAccount?.credits || 0} Credits
          </span>
        </div>
      </div>

      {/* Lead Count and Pagination Controls */}
      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white border border-gray-200 rounded-lg px-3 sm:px-4 py-3 gap-3 sm:gap-4'>
        <div className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4'>
          <div className='text-sm text-gray-700'>
            <span className='font-semibold'>{filteredLeads.length}</span> total leads
            {filteredLeads.length !== allLeads.length && (
              <span className='text-gray-500'> (filtered from {allLeads.length})</span>
            )}
          </div>
          <div className='text-xs sm:text-sm text-gray-500'>
            Showing {startIndex + 1}-{Math.min(endIndex, filteredLeads.length)} of {filteredLeads.length}
          </div>
        </div>

        {totalPages > 1 && (
          <div className='flex items-center justify-center sm:justify-end gap-1 sm:gap-2 overflow-x-auto'>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className='px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 whitespace-nowrap'
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className='px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
            >
              ←
            </button>
            
            <div className='flex items-center gap-1'>
              {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 3) {
                  pageNum = i + 1;
                } else if (currentPage <= 2) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 1) {
                  pageNum = totalPages - 2 + i;
                } else {
                  pageNum = currentPage - 1 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-2 sm:px-3 py-1 text-xs sm:text-sm border rounded ${
                      currentPage === pageNum
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className='px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
            >
              →
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className='px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 whitespace-nowrap'
            >
              Last
            </button>
          </div>
        )}
      </div>

      <LeadTable
        leads={paginatedLeads}
        selectedIds={selectedIds}
        isLoading={false}
        onToggleAll={() => {
          setSelectedIds(
            selectedIds.length === paginatedLeads.length
              ? []
              : paginatedLeads.map((l) => l.id)
          );
        }}
        onToggleOne={(id) => {
          setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
          );
        }}
        onRowClick={(id) => {
          // Set navigation context for lead details page
          const leadIds = filteredLeads.map(lead => lead.id);
          const navContext = {
            ids: leadIds,
            filterType: filterType || null
          };
          sessionStorage.setItem('leadNavContext', JSON.stringify(navContext));
          router.push(`/lead/${id}`);
        }}
      />

      {/* Bottom Pagination Controls */}
      {totalPages > 1 && (
        <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white border border-gray-200 rounded-lg px-3 sm:px-4 py-3 gap-3 sm:gap-4'>
          <div className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4'>
            <div className='text-sm text-gray-700'>
              <span className='font-semibold'>{filteredLeads.length}</span> total leads
              {filteredLeads.length !== allLeads.length && (
                <span className='text-gray-500'> (filtered from {allLeads.length})</span>
              )}
            </div>
            <div className='text-xs sm:text-sm text-gray-500'>
              Showing {startIndex + 1}-{Math.min(endIndex, filteredLeads.length)} of {filteredLeads.length}
            </div>
          </div>

          <div className='flex items-center justify-center sm:justify-end gap-1 sm:gap-2 overflow-x-auto'>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className='px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 whitespace-nowrap'
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className='px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
            >
              ←
            </button>
            
            <div className='flex items-center gap-1'>
              {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 3) {
                  pageNum = i + 1;
                } else if (currentPage <= 2) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 1) {
                  pageNum = totalPages - 2 + i;
                } else {
                  pageNum = currentPage - 1 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-2 sm:px-3 py-1 text-xs sm:text-sm border rounded ${
                      currentPage === pageNum
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className='px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
            >
              →
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className='px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 whitespace-nowrap'
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
