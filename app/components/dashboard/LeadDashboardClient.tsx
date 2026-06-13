'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { 
  fetchLeads, 
  bulkDeleteLeads, 
  bulkUpdateStatus, 
  skipTraceLeads, 
  syncToGHL
} from '@/app/utils/aws/data/lead.client';
import { useAccess } from '@/app/context/AccessContext';
import { useGhl } from '@/app/context/GhlContext';
import { useToast } from '@/app/components/leadDetails/ToastProvider';
import { LeadTable } from './LeadTable';
import { DashboardFilters } from './DashboardFilters';
import { GhlConnection } from './GhlConnection';
import { RouteExplanationModal } from './RouteExplanationModal';
import { SyncConfirmModal } from './SyncConfirmModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import type { Schema } from '@/amplify/data/resource';

type Lead = Schema['PropertyLead']['type'];
type UserAccount = Schema['UserAccount']['type'];

interface Props {}

export default function LeadDashboardClient({}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPaidPlan, isAdmin, isAI } = useAccess();
  const { isConnected: isGhlConnected } = useGhl();
  const { addToast } = useToast();

  // --- State ---
  const [leads, setLeads] = useState<Lead[]>([]);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedLeadType, setSelectedLeadType] = useState<'PROBATE' | 'PREFORECLOSURE' | null>(null);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'skipTrace' | 'enrich' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [isPopulatingQueue, setIsPopulatingQueue] = useState(false);
  const [alreadyTracedCount, setAlreadyTracedCount] = useState(0);
  const [isLargeBatch, setIsLargeBatch] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [syncCounts, setSyncCounts] = useState({ calling: 0, emailOnly: 0, digitalOnly: 0 });
  const [alreadySyncedCount, setAlreadySyncedCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [failedSyncIds, setFailedSyncIds] = useState<string[]>([]);
  const [skippedSyncIds, setSkippedSyncIds] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100); // Show 100 leads per page

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCrmStatus, setFilterCrmStatus] = useState('');
  const [filterHasPhone, setFilterHasPhone] = useState('');
  const [filterListingStatus, setFilterListingStatus] = useState('');
  const [filterDateAdded, setFilterDateAdded] = useState('');
  const [filterDateAddedTo, setFilterDateAddedTo] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [skipTraceFromDate, setSkipTraceFromDate] = useState('');
  const [skipTraceToDate, setSkipTraceToDate] = useState('');

  // Debug: Log unique skipTraceStatus values
  useEffect(() => {
    const statuses = new Set(leads.map(l => l.skipTraceStatus).filter(Boolean));
    console.log('Unique skipTraceStatus values:', Array.from(statuses));
  }, [leads]);

  // Sort States
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // --- Effects ---

  // Check for upload completion and refresh
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('upload') === 'processing') {
      // Remove the parameter from URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // Set up polling to check for upload completion
      const checkUploadStatus = async () => {
        try {
          // Refresh leads to see if new ones appeared
          await refreshLeads();
        } catch (error) {
          console.error('Error checking upload status:', error);
        }
      };

      // Check immediately and then every 3 seconds for 30 seconds
      checkUploadStatus();
      const interval = setInterval(checkUploadStatus, 3000);
      setTimeout(() => clearInterval(interval), 30000);
    }
  }, []);

  // Fetch leads on mount (no real-time subscription to prevent memory leak)
  useEffect(() => {
    async function loadLeads() {
      try {
        const data = await fetchLeads();
        setLeads(data);
        setIsLoading(false);
        console.log('📊 Loaded leads:', data.length);
        
        // Warn if dataset is very large
        if (data.length > 10000) {
          console.warn('⚠️ Large dataset detected:', data.length, 'leads. Consider archiving old data.');
        }
      } catch (err) {
        console.error('Failed to load leads:', err);
        setIsLoading(false);
      }
    }
    loadLeads();
  }, []);

  // Background refresh every 60 seconds to keep data fresh
  useEffect(() => {
    const interval = setInterval(async () => {
      // Skip refresh during processing operations
      if (isProcessing) return;
      
      try {
        const data = await fetchLeads();
        setLeads(data);
        console.log('🔄 Background refresh:', data.length, 'leads');
      } catch (err) {
        console.error('Background refresh failed:', err);
      }
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [isProcessing]);



  // Manual refresh function for immediate updates
  const refreshLeads = async () => {
    try {
      const data = await fetchLeads();
      setLeads([...data]);
    } catch (err) {
      console.error('Failed to refresh leads:', err);
    }
  };

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

  // 3. Handle refresh parameter from upload redirect
  useEffect(() => {
    const refresh = searchParams.get('refresh');
    if (refresh === 'true') {
      console.log(
        '🔄 Upload redirect detected, triggering refresh'
      );
      refreshLeads();
      router.replace('/dashboard', { scroll: false });
    }
  }, [searchParams, router]);

  // --- Filter Logic ---
  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        const search = searchQuery.toLowerCase();
        const matchesSearch =
          lead.ownerAddress?.toLowerCase().includes(search) ||
          lead.ownerLastName?.toLowerCase().includes(search) ||
          lead.ownerFirstName?.toLowerCase().includes(search) ||
          lead.ownerCity?.toLowerCase().includes(search) ||
          lead.ownerState?.toLowerCase().includes(search) ||
          lead.ownerZip?.includes(search) ||
          lead.ownerCounty?.toLowerCase().includes(search) ||
          lead.adminFirstName?.toLowerCase().includes(search) ||
          lead.adminLastName?.toLowerCase().includes(search) ||
          (lead.phones &&
            lead.phones.some((phone) => phone?.includes(search))) ||
          (lead.emails &&
            lead.emails.some((email) =>
              email?.toLowerCase().includes(search)
            )) ||
          (lead.customTags &&
            lead.customTags.some((tag) => tag?.toLowerCase().includes(search)));

        const matchesType = !filterType || lead.type === filterType;
        const matchesStatus =
          filterStatus === '' || 
          lead.skipTraceStatus === filterStatus;

        const matchesCrm =
          !filterCrmStatus ||
          (filterCrmStatus === 'NULL'
            ? !lead.ghlSyncStatus
            : lead.ghlSyncStatus === filterCrmStatus);

        const matchesPhone =
          !filterHasPhone ||
          (filterHasPhone === 'HAS_PHONE'
            ? lead.phones && lead.phones.length > 0
            : filterHasPhone === 'NO_PHONE'
              ? !lead.phones || lead.phones.length === 0
              : true);

        const matchesListingStatus =
          !filterListingStatus ||
          (filterListingStatus === 'NULL'
            ? !lead.listingStatus
            : lead.listingStatus === filterListingStatus);

        const matchesDateAdded = (() => {
          if (!filterDateAdded && !filterDateAddedTo) return true;
          if (!lead.createdAt) return false;
          const leadDate = new Date(lead.createdAt).toISOString().split('T')[0];
          
          // Debug logging
          if (filterDateAdded || filterDateAddedTo) {
            console.log('Date filter check:', {
              leadDate,
              filterDateAdded,
              filterDateAddedTo,
              matches: (filterDateAdded && filterDateAddedTo) 
                ? (leadDate >= filterDateAdded && leadDate <= filterDateAddedTo)
                : filterDateAdded 
                  ? leadDate >= filterDateAdded
                  : leadDate <= filterDateAddedTo
            });
          }
          
          if (filterDateAdded && filterDateAddedTo) {
            return leadDate >= filterDateAdded && leadDate <= filterDateAddedTo;
          } else if (filterDateAdded) {
            return leadDate >= filterDateAdded;
          } else if (filterDateAddedTo) {
            return leadDate <= filterDateAddedTo;
          }
          return true;
        })();

        const matchesSource = !filterSource || lead.uploadSource === filterSource;

        // Date filtering for skip trace completion
        const matchesDateRange = (() => {
          if (!skipTraceFromDate && !skipTraceToDate) return true;
          if (!lead.skipTraceCompletedAt) return false;

          const completedDate = new Date(lead.skipTraceCompletedAt)
            .toISOString()
            .split('T')[0];
          const fromMatch =
            !skipTraceFromDate || completedDate >= skipTraceFromDate;
          const toMatch = !skipTraceToDate || completedDate <= skipTraceToDate;

          return fromMatch && toMatch;
        })();

        return (
          matchesSearch &&
          matchesType &&
          matchesStatus &&
          matchesCrm &&
          matchesPhone &&
          matchesListingStatus &&
          matchesDateAdded &&
          matchesSource &&
          matchesDateRange
        );
      })
      .sort((a, b) => {
        // Sort the filtered results
        let aValue: any = a[sortField as keyof Lead];
        let bValue: any = b[sortField as keyof Lead];

        // Handle date sorting
        if (
          sortField === 'createdAt' ||
          sortField === 'updatedAt' ||
          sortField === 'skipTraceCompletedAt'
        ) {
          aValue = new Date(aValue || 0).getTime();
          bValue = new Date(bValue || 0).getTime();
        }

        // Handle number sorting
        if (sortField === 'zestimate') {
          aValue = parseFloat(aValue || 0);
          bValue = parseFloat(bValue || 0);
        }

        // Handle array sorting (phones, emails)
        if (Array.isArray(aValue) || Array.isArray(bValue)) {
          aValue = (aValue || []).length;
          bValue = (bValue || []).length;
        }

        // Handle string sorting
        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = (bValue || '').toLowerCase();
        }

        // Handle null/undefined values
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return sortDirection === 'asc' ? -1 : 1;
        if (bValue == null) return sortDirection === 'asc' ? 1 : -1;

        if (sortDirection === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
  }, [
    leads,
    searchQuery,
    filterType,
    filterStatus,
    filterCrmStatus,
    filterHasPhone,
    filterListingStatus,
    filterDateAdded,
    filterDateAddedTo,
    filterSource,
    skipTraceFromDate,
    skipTraceToDate,
    sortField,
    sortDirection,
  ]);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  // Debug pagination
  console.log('📄 Pagination:', {
    totalLeads: filteredLeads.length,
    itemsPerPage,
    totalPages,
    currentPage,
    showing: `${startIndex + 1}-${Math.min(endIndex, filteredLeads.length)}`,
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    filterType,
    filterStatus,
    filterCrmStatus,
    filterHasPhone,
    filterListingStatus,
    skipTraceFromDate,
    skipTraceToDate,
    sortField,
    sortDirection,
  ]);

  // --- Sort Handler ---
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // --- Action Handlers ---

  const handleViewDetails = () => {
    if (selectedIds.length === 1) {
      router.push(`/lead/${selectedIds[0]}`);
    }
  };

  const handleBulkGHLSync = async () => {
    if (selectedIds.length === 0) return;

    if (!hasPaidPlan) {
      addToast({ type: 'warning', title: 'PRO Plan Required', message: 'CRM Sync requires a PRO or AI membership.' });
      router.push('/pricing');
      return;
    }

    if (!isGhlConnected) {
      addToast({ type: 'warning', title: 'Laynch AI Not Connected', message: 'Connect your Laynch AI system before syncing leads.' });
      return;
    }

    // Categorize leads by skip trace results and property value
    const selectedLeads = leads.filter(lead => selectedIds.includes(lead.id));
    
    const callingLeads = selectedLeads.filter(lead => {
      return lead.phones && lead.phones.length > 0;
    });
    
    const emailOnlyLeads = selectedLeads.filter(lead => {
      const value = lead.zestimate || lead.estimatedValue || 0;
      return (!lead.phones || lead.phones.length === 0) && 
             value >= 300000 && value <= 850000;
    });
    
    const digitalOnlyLeads = selectedLeads.filter(lead => {
      const value = lead.zestimate || lead.estimatedValue || 0;
      return value < 300000 || value > 850000;
    });

    const alreadySynced = selectedLeads.filter(lead => lead.ghlSyncStatus === 'SUCCESS').length;
    setAlreadySyncedCount(alreadySynced);
    setSyncCounts({ calling: callingLeads.length, emailOnly: emailOnlyLeads.length, digitalOnly: digitalOnlyLeads.length });
    setFailedSyncIds([]);
    setSkippedSyncIds([]);
    setShowSyncModal(true);
  };

  const executeBulkGHLSync = async (idsToSync?: string[]) => {
    const ids = idsToSync ?? selectedIds;
    setShowSyncModal(false);
    setIsProcessing(true);
    setSyncProgress({ current: 0, total: ids.length });
    setProcessingMessage('Starting Laynch AI sync...');
    try {
      const { successful, skipped, failed, failedIds, skippedIds } = await syncToGHL(ids, (current, total) => {
        setSyncProgress({ current, total });
        setProcessingMessage(`Syncing leads to Laynch AI... (${current}/${total})`);
      });

      setIsProcessing(false);
      setSyncProgress(null);
      setProcessingMessage('');
      setSelectedIds([]);
      setFailedSyncIds(failedIds);
      setSkippedSyncIds(skippedIds);

      const parts = [`Synced: ${successful}`];
      if (skipped > 0) parts.push(`Skipped: ${skipped}`);
      if (failed > 0) parts.push(`Failed: ${failed}`);
      addToast({
        type: failed > 0 ? 'warning' : 'success',
        title: 'CRM Sync Complete',
        message: parts.join(' · '),
        duration: 8000,
      });

      await refreshLeads();

    } catch (err) {
      console.error('Sync error:', err);
      setIsProcessing(false);
      setSyncProgress(null);
      setProcessingMessage('');
      addToast({ type: 'error', title: 'CRM Sync Failed', message: 'Ensure leads are skip-traced first.' });
    }
  };

  const skipTraceInFlight = useRef(false);

  const handleBulkSkipTrace = async () => {
    if (selectedIds.length === 0) return;

    // Show modal first
    if (!selectedLeadType) {
      addToast({ type: 'warning', title: 'No leads selected', message: 'Please select leads first.' });
      return;
    }

    const alreadyTraced = leads.filter(
      l => selectedIds.includes(l.id) && l.skipTraceStatus === 'COMPLETED'
    );
    const chargeableCount = selectedIds.length - alreadyTraced.length;

    setAlreadyTracedCount(alreadyTraced.length);
    setIsLargeBatch(chargeableCount > 25);
    setPendingAction('skipTrace');
    setShowRouteModal(true);
  };

  const SKIP_TRACE_CHUNK_SIZE = 25;

  const executeSkipTrace = async () => {
    if (skipTraceInFlight.current) return;
    skipTraceInFlight.current = true;

    // Filter out already-completed leads
    const idsToProcess = selectedIds.filter(id => {
      const lead = leads.find(l => l.id === id);
      return lead?.skipTraceStatus !== 'COMPLETED';
    });

    if (idsToProcess.length === 0) {
      addToast({ type: 'info', title: 'Already Traced', message: 'All selected leads have already been skip traced.' });
      skipTraceInFlight.current = false;
      return;
    }

    // Skip credit check for admins
    if (!isAdmin) {
      const currentCredits = userAccount?.credits || 0;
      if (currentCredits < idsToProcess.length) {
        addToast({ type: 'error', title: 'Insufficient Credits', message: `You need ${idsToProcess.length} credits but only have ${currentCredits}. Purchase more credits to continue.` });
        skipTraceInFlight.current = false;
        return;
      }
    }

    setIsProcessing(true);

    // Split into chunks and process sequentially to avoid Lambda timeout
    const chunks: string[][] = [];
    for (let i = 0; i < idsToProcess.length; i += SKIP_TRACE_CHUNK_SIZE) {
      chunks.push(idsToProcess.slice(i, i + SKIP_TRACE_CHUNK_SIZE));
    }

    const allResults: any[] = [];

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        setProcessingMessage(
          chunks.length > 1
            ? `Skip tracing batch ${i + 1} of ${chunks.length} (${chunk.length} leads)...`
            : `Skip tracing ${chunk.length} lead${chunk.length !== 1 ? 's' : ''}...`
        );
        const results = await skipTraceLeads(chunk).then(r => Array.isArray(r) ? r : []);
        allResults.push(...results);
      }

      const successful = allResults.filter((r: any) => r?.status === 'SUCCESS').length;
      const failed = allResults.filter((r: any) => r?.status === 'FAILED' || r?.status === 'ERROR').length;
      const noMatch = allResults.filter((r: any) => r?.status === 'NO_MATCH').length;
      const noQuality = allResults.filter((r: any) => r?.status === 'NO_QUALITY_CONTACTS').length;

      addToast({ type: 'success', title: 'Skip-trace complete!', message: `Successful: ${successful} | Failed: ${failed} | No Match: ${noMatch} | No Quality: ${noQuality}`, duration: 8000 });

      setSelectedIds([]);

      // Refresh page after 1 second
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      console.error('Skip-trace error:', err);
      addToast({ type: 'error', title: 'Skip-trace Error', message: err.message || 'Check your network connection' });
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
      skipTraceInFlight.current = false;
    }
  };
  const handleDeleteLeads = async () => {
    if (!isAdmin) {
      addToast({ type: 'error', title: 'Unauthorized', message: 'Only Admins can bulk delete leads.' });
      return;
    }
    setShowDeleteModal(true);
  };

  const confirmDeleteLeads = async () => {
    setShowDeleteModal(false);
    setIsProcessing(true);
    setProcessingMessage(`Deleting ${selectedIds.length} leads...`);
    try {
      console.log('🗑️ Calling bulkDeleteLeads with ids:', selectedIds);
      await bulkDeleteLeads(selectedIds);
      console.log('✅ Delete completed, reloading page...');
      // Wait 2 seconds for deletes to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Immediately reload - don't wait for anything else
      window.location.reload();
    } catch (err) {
      console.error('❌ Delete error:', err);
      addToast({ type: 'error', title: 'Delete Failed', message: err instanceof Error ? err.message : 'Unknown error' });
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedIds.length === 0) return;

    if (!confirm(`Set ${selectedIds.length} leads to ${status}?`)) return;

    setIsProcessing(true);
    try {
      await bulkUpdateStatus(
        selectedIds,
        status as 'off_market' | 'active' | 'sold' | 'pending' | 'fsbo' | 'auction' | 'skip' | 'door_knock'
      );
      addToast({ type: 'success', title: 'Status Updated', message: `Successfully updated ${selectedIds.length} leads to ${status}` });
      setSelectedIds([]);
      await refreshLeads();
    } catch (err) {
      console.error('Bulk status update error:', err);
      addToast({ type: 'error', title: 'Update Failed', message: 'Error updating lead statuses' });
    } finally {
      setIsProcessing(false);
      // Force page refresh to ensure all data is updated
      window.location.reload();
    }
  };

  const handleBulkEnrichLeads = async () => {
    if (selectedIds.length === 0) return;

    // Filter to preforeclosure only
    const selectedLeads = leads.filter((lead) => selectedIds.includes(lead.id));
    const preforeclosureLeads = selectedLeads.filter(
      (lead) => lead.type?.toUpperCase() === 'PREFORECLOSURE'
    );

    if (preforeclosureLeads.length === 0) {
      addToast({ type: 'warning', title: 'No Eligible Leads', message: 'BatchData enrichment is only for preforeclosure leads.' });
      return;
    }

    // Show modal first
    const alreadyEnriched = preforeclosureLeads.filter(lead => lead.batchDataEnriched);
    setAlreadyTracedCount(alreadyEnriched.length);
    setIsLargeBatch((preforeclosureLeads.length - alreadyEnriched.length) > 50);
    setPendingAction('enrich');
    setShowRouteModal(true);
  };

  const executeEnrich = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/v1/enrich-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedIds }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      addToast({ type: 'success', title: 'Enrichment Complete!', message: `Enriched: ${result.enriched} | Skipped: ${result.skipped} | Failed: ${result.failed} | Cost: $${result.cost.toFixed(2)}`, duration: 8000 });
      setSelectedIds([]);
      await refreshLeads();
    } catch (err) {
      console.error('Enrichment error:', err);
      addToast({ type: 'error', title: 'Enrichment Failed', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsProcessing(false);
      // Force page refresh to ensure all data is updated
      window.location.reload();
    }
  };

  const handleBulkDirectMail = async () => {
    if (selectedIds.length === 0) return;

    const cost = selectedIds.length * 1.0; // ~$1 per letter
    if (
      !confirm(
        `Generate and send ${selectedIds.length} letters via Click2Mail?\n\nEstimated cost: $${cost.toFixed(2)}\n\nLetters will be sent automatically.`
      )
    )
      return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/v1/ai/generate-bulk-letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: selectedIds,
          options: {
            includeListingOption: true,
            includeCashOption: true,
            productId: 1, // First Class Letter
            color: false,
          },
          sendNow: true, // Send immediately via Click2Mail
        }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      const { sent, failed } = result.mailResults;

      addToast({ type: 'success', title: 'Direct Mail Campaign Complete!', message: `Sent ${sent}/${result.generated} letters | Failed: ${failed} | Delivery: 3-5 business days`, duration: 10000 });

      setSelectedIds([]);
    } catch (err) {
      console.error('Direct mail generation error:', err);
      addToast({ type: 'error', title: 'Direct Mail Failed', message: 'Error sending letters via Click2Mail' });
    } finally {
      setIsProcessing(false);
      // Force page refresh to ensure all data is updated
      window.location.reload();
    }
  };

  const handlePopulateQueue = async () => {
    if (
      !confirm(
        `Populate outreach queue from Laynch AI?\n\nThis will fetch ALL contacts with "ai outreach" tag from Laynch AI and add them to the outreach queue for automated messaging.`
      )
    )
      return;

    setIsPopulatingQueue(true);
    try {
      const { data, errors } = await client.queries.populateQueueFromGhl();

      if (errors) {
        throw new Error(errors[0]?.message || 'Failed to populate queue');
      }

      const result = JSON.parse(data as string);

      addToast({ type: 'success', title: 'Queue Population Complete!', message: `Laynch AI contacts: ${result.totalContacts} | AI outreach: ${result.aiOutreachContacts} | Added: ${result.queueEntriesAdded}${result.errors ? ` | Errors: ${result.errors.length}` : ''}`, duration: 8000 });
    } catch (err: any) {
      console.error('Queue population error:', err);
      addToast({ type: 'error', title: 'Queue Population Failed', message: err.message });
    } finally {
      setIsPopulatingQueue(false);
    }
  };

  const handleAddToDoorKnock = async () => {
    if (selectedIds.length === 0) {
      addToast({ type: 'warning', title: 'No leads selected', message: 'Please select leads to add to door knock queue.' });
      return;
    }

    if (!confirm(`Add ${selectedIds.length} leads to door knock queue?`)) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/v1/add-to-door-knock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedIds })
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      addToast({ type: 'success', title: 'Door Knock Queue Updated', message: `Added ${result.added} leads to door knock queue.` });
      setSelectedIds([]);
      
    } catch (err: any) {
      console.error('Door knock add error:', err);
      addToast({ type: 'error', title: 'Door Knock Failed', message: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncListingStatus = async () => {
    if (!confirm('Sync listing_status field to all existing Laynch AI contacts?\n\nThis will update contacts that were synced before the field was created.')) return;

    setIsProcessing(true);
    setProcessingMessage('Syncing listing status to Laynch AI...');
    try {
      const response = await fetch('/api/v1/sync-listing-status', {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      addToast({ type: 'success', title: 'Listing Status Sync Complete!', message: `Updated: ${result.updated}/${result.total} contacts` });
    } catch (err: any) {
      console.error('Listing status sync error:', err);
      addToast({ type: 'error', title: 'Sync Failed', message: err.message });
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const handleDownloadSkipTraced = () => {
    if (selectedIds.length === 0) {
      addToast({ type: 'warning', title: 'No leads selected', message: 'Please select leads to download.' });
      return;
    }

    const selectedLeads = filteredLeads.filter((lead) =>
      selectedIds.includes(lead.id)
    );

    if (selectedLeads.length === 0) {
      addToast({ type: 'warning', title: 'No leads found', message: 'No selected leads found.' });
      return;
    }

    const formatPhone = (phone: string | null) => {
      if (!phone) return '';
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
      }
      return phone;
    };

    const headers = [
      'Type',
      'Manual Status',
      'Status',
      'Laynch AI Sync',
      'Owner Name',
      'Address',
      'Quality Phones',
      'Quality Emails',
      'All Phones Found',
      'All Emails Found',
      'County',
      'City',
      'State',
      'Zip',
      'Zestimate',
      'Admin Name',
      'Admin Address',
      'Created At',
      'Skip Traced Date',
      'Estimated Value',
    ];

    const csvContent = [
      headers.join(','),
      ...selectedLeads.map((lead) => {
        const rawData = lead.rawSkipTraceData 
          ? (typeof lead.rawSkipTraceData === 'string' ? JSON.parse(lead.rawSkipTraceData) : lead.rawSkipTraceData)
          : null;
        
        const allPhones = rawData?.allPhones?.map((p: any) => formatPhone(p.number)).join('; ') || '';
        const allEmails = rawData?.allEmails?.map((e: any) => e.email).join('; ') || '';
        
        return [
          `"${lead.type || ''}"`,
          `"${lead.listingStatus || ''}"`,
          `"${lead.skipTraceStatus || ''}"`,
          `"${lead.ghlSyncStatus || ''}"`,
          `"${lead.ownerFirstName || ''} ${lead.ownerLastName || ''}"`.trim(),
          `"${lead.ownerAddress || ''}"`,
          `"${(lead.phones || []).map(formatPhone).join('; ')}"`,
          `"${(lead.emails || []).join('; ')}"`,
          `"${allPhones}"`,
          `"${allEmails}"`,
          `"${lead.ownerCounty || ''}"`,
          `"${lead.ownerCity || ''}"`,
          `"${lead.ownerState || ''}"`,
          `"${lead.ownerZip || ''}"`,
          `"${lead.zestimate || ''}"`,
          `"${lead.adminFirstName || ''} ${lead.adminLastName || ''}"`.trim(),
          `"${lead.adminAddress || ''}"`,
          `"${lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : ''}"`,
          `"${lead.skipTraceCompletedAt ? new Date(lead.skipTraceCompletedAt).toLocaleDateString() : ''}"`,
          `"${lead.estimatedValue || ''}"`,
        ].join(',');
      }),
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selected-leads-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    addToast({ type: 'success', title: 'Download Complete', message: `Downloaded ${selectedLeads.length} leads to CSV.` });
  };

  return (
    <div className='space-y-4'>
      {/* Processing Status */}
      {isProcessing && (
        <div className="fixed top-4 right-4 bg-white border border-gray-200 rounded-xl shadow-xl z-50 min-w-[280px] max-w-xs p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent shrink-0"></div>
            <span className="text-sm font-medium text-gray-800 truncate">{processingMessage || 'Processing...'}</span>
          </div>
          {syncProgress && syncProgress.total > 0 && (
            <div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1 text-right">
                {syncProgress.current} / {syncProgress.total}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Failed sync retry banner */}
      {!isProcessing && failedSyncIds.length > 0 && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm text-red-800">
            <span className="font-semibold">{failedSyncIds.length} lead{failedSyncIds.length !== 1 ? 's' : ''}</span> failed to sync.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => executeBulkGHLSync(failedSyncIds)}
              className="text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Retry Failed
            </button>
            <button
              onClick={() => setFailedSyncIds([])}
              className="text-xs text-red-500 hover:text-red-700 px-2 py-1.5"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Skipped sync banner */}
      {!isProcessing && skippedSyncIds.length > 0 && (
        <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">{skippedSyncIds.length} lead{skippedSyncIds.length !== 1 ? 's' : ''}</span> skipped — skip trace not completed.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedIds(skippedSyncIds);
                setSkippedSyncIds([]);
              }}
              className="text-xs font-semibold text-yellow-700 bg-yellow-100 hover:bg-yellow-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Select &amp; Skip Trace
            </button>
            <button
              onClick={() => setSkippedSyncIds([])}
              className="text-xs text-yellow-600 hover:text-yellow-800 px-2 py-1.5"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Mobile Loading Overlay */}
      {isLoading && (
        <div className='flex flex-col items-center justify-center py-32 sm:hidden'>
          <div className='animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3'></div>
          <p className='text-gray-600 font-medium'>Loading your leads...</p>
        </div>
      )}

      <div className={isLoading ? 'hidden sm:contents' : ''}>

      {/* Free Plan Upsell Banner */}
      {!hasPaidPlan && (
        <div className='bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 flex items-center justify-between'>
          <p className='text-sm text-indigo-800'>
            You're on the <strong>Free Plan</strong> — Laynch AI sync, lead enrichment, and automated outreach are locked.
          </p>
          <a
            href='/pricing'
            className='text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap ml-4'
          >
            Upgrade Now
          </a>
        </div>
      )}

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
        filterListingStatus={filterListingStatus}
        setFilterListingStatus={setFilterListingStatus}
        filterDateAdded={filterDateAdded}
        setFilterDateAdded={setFilterDateAdded}
        filterDateAddedTo={filterDateAddedTo}
        setFilterDateAddedTo={setFilterDateAddedTo}
        filterSource={filterSource}
        setFilterSource={setFilterSource}
        skipTraceFromDate={skipTraceFromDate}
        setSkipTraceFromDate={setSkipTraceFromDate}
        skipTraceToDate={skipTraceToDate}
        setSkipTraceToDate={setSkipTraceToDate}
        selectedLeadsCount={selectedIds.length}
        selectedLeadTypes={leads.filter(l => selectedIds.includes(l.id)).map(l => l.type)}
        selectedLeadType={selectedLeadType}
        hasPaidPlan={hasPaidPlan}
        isSkipTracing={isProcessing}
        isGhlSyncing={isProcessing}
        isEnriching={isProcessing}
        isGeneratingLetters={isProcessing}
        handleBulkSkipTrace={handleBulkSkipTrace}
        handleBulkGHLSync={handleBulkGHLSync}
        handleBulkStatusUpdate={handleBulkStatusUpdate}
        handleBulkEnrichLeads={handleBulkEnrichLeads}
        handleBulkDirectMail={handleBulkDirectMail}
        handlePopulateQueue={handlePopulateQueue}
        handleAddToDoorKnock={handleAddToDoorKnock}
        handleSyncListingStatus={handleSyncListingStatus}
        handleDelete={handleDeleteLeads}
        handleExport={() => addToast({ type: 'info', title: 'Export', message: 'Exporting leads to CSV...' })}
        handleDownloadSkipTraced={handleDownloadSkipTraced}
        handleViewDetails={handleViewDetails}
        isEmailCampaigning={false}
        isPopulatingQueue={isPopulatingQueue}
      />

      {/* GHL Connection Status */}
      <GhlConnection />

      {/* Wallet Status Bar */}
      <div className='flex justify-end items-center gap-4 px-2'>
        <div className='flex items-center gap-2 text-[11px] font-bold uppercase tracking-tighter text-slate-500 bg-white border border-slate-200 px-4 py-1.5 rounded-full shadow-sm'>
          <span className='w-2 h-2 rounded-full bg-green-500 animate-pulse' />
          Wallet:{' '}
          <span className='text-slate-900'>
            {userAccount?.credits || 0} credits
          </span>
          <span className='normal-case font-normal text-slate-400'>
            · $0.10/skip trace
          </span>
        </div>
      </div>

      {/* Lead Count and Pagination Controls */}
      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white border border-gray-200 rounded-lg px-3 sm:px-4 py-3 gap-3 sm:gap-4'>
        <div className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4'>
          <div className='text-sm text-gray-700'>
            <span className='font-semibold'>{filteredLeads.length}</span> total
            leads
            {filteredLeads.length !== leads.length && (
              <span className='text-gray-500'>
                {' '}
                (filtered from {leads.length})
              </span>
            )}
          </div>
          <div className='text-xs sm:text-sm text-gray-500'>
            Showing {startIndex + 1}-{Math.min(endIndex, filteredLeads.length)}{' '}
            of {filteredLeads.length}
          </div>
        </div>

        {/* Always show pagination info for debugging */}
        <div className='flex items-center justify-center sm:justify-end gap-1 sm:gap-2 overflow-x-auto'>
          <span className='text-xs text-gray-500 mr-2'>
            Page {currentPage} of {totalPages}
          </span>
          {totalPages > 1 && (
            <>
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className='px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 whitespace-nowrap'
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
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
            </>
          )}
        </div>
      </div>

      <LeadTable
        leads={paginatedLeads}
        selectedIds={selectedIds}
        selectedLeadType={selectedLeadType}
        isLoading={isLoading}
        totalFilteredCount={filteredLeads.length}
        onRefresh={refreshLeads}
        onToggleAll={() => {
          const newSelection = selectedIds.length === paginatedLeads.length
            ? []
            : paginatedLeads.slice(0, 100).map((l) => l.id);

          if (paginatedLeads.length > 100 && selectedIds.length !== paginatedLeads.length) {
            addToast({ type: 'warning', title: 'Selection Limit', message: 'Maximum 100 leads can be selected at once.' });
          }

          setSelectedIds(newSelection);
          if (newSelection.length === 0) {
            setSelectedLeadType(null);
          } else {
            const firstLead = paginatedLeads[0];
            if (firstLead) setSelectedLeadType(firstLead.type as 'PROBATE' | 'PREFORECLOSURE');
          }
        }}
        onToggleAllFiltered={() => {
          const newSelection = selectedIds.length === filteredLeads.length
            ? []
            : filteredLeads.slice(0, 100).map((l) => l.id);

          if (filteredLeads.length > 100 && selectedIds.length !== filteredLeads.length) {
            addToast({ type: 'warning', title: 'Selection Limit', message: 'Maximum 100 leads can be selected at once.' });
          }

          setSelectedIds(newSelection);
          if (newSelection.length === 0) {
            setSelectedLeadType(null);
          } else {
            const firstLead = filteredLeads[0];
            if (firstLead) setSelectedLeadType(firstLead.type as 'PROBATE' | 'PREFORECLOSURE');
          }
        }}
        onToggleOne={(id) => {
          if (!selectedIds.includes(id) && selectedIds.length >= 100) {
            addToast({ type: 'warning', title: 'Selection Limit', message: 'Maximum 100 leads can be selected at once.' });
            return;
          }
          setSelectedIds((prev) => {
            const newSelection = prev.includes(id)
              ? prev.filter((i) => i !== id)
              : [...prev, id];

            if (newSelection.length === 0) {
              setSelectedLeadType(null);
            } else if (prev.length === 0) {
              const lead = leads.find(l => l.id === id);
              if (lead) setSelectedLeadType(lead.type as 'PROBATE' | 'PREFORECLOSURE');
            }

            return newSelection;
          });
        }}
        onRowClick={(id) => {
          // Set navigation context for lead details page
          const leadIds = filteredLeads.map((lead) => lead.id);
          const navContext = {
            ids: leadIds,
            filterType: filterType || null,
          };
          sessionStorage.setItem('leadNavContext', JSON.stringify(navContext));
          router.push(`/lead/${id}`);
        }}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
      />

      {/* Bottom Pagination Controls */}
      {totalPages > 1 && (
        <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white border border-gray-200 rounded-lg px-3 sm:px-4 py-3 gap-3 sm:gap-4'>
          <div className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4'>
            <div className='text-sm text-gray-700'>
              <span className='font-semibold'>{filteredLeads.length}</span>{' '}
              total leads
              {filteredLeads.length !== leads.length && (
                <span className='text-gray-500'>
                  {' '}
                  (filtered from {leads.length})
                </span>
              )}
            </div>
            <div className='text-xs sm:text-sm text-gray-500'>
              Showing {startIndex + 1}-
              {Math.min(endIndex, filteredLeads.length)} of{' '}
              {filteredLeads.length}
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
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
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

      {/* GHL Sync Confirmation Modal */}
      <SyncConfirmModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onConfirm={() => executeBulkGHLSync()}
        totalCount={selectedIds.length}
        callingCount={syncCounts.calling}
        emailOnlyCount={syncCounts.emailOnly}
        digitalOnlyCount={syncCounts.digitalOnly}
        alreadySyncedCount={alreadySyncedCount}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteLeads}
        count={selectedIds.length}
      />

      {/* Route Explanation Modal */}
      {showRouteModal && selectedLeadType && (
        <RouteExplanationModal
          isOpen={showRouteModal}
          onClose={() => {
            setShowRouteModal(false);
            setPendingAction(null);
          }}
          onConfirm={async () => {
            setShowRouteModal(false);
            if (pendingAction === 'skipTrace') {
              await executeSkipTrace();
            } else if (pendingAction === 'enrich') {
              await executeEnrich();
            }
            setPendingAction(null);
          }}
          leadType={selectedLeadType}
          leadCount={selectedIds.length}
          alreadyTracedCount={alreadyTracedCount}
          action={pendingAction ?? 'skipTrace'}
          isLargeBatch={isLargeBatch}
        />
      )}
      </div>
    </div>
  );
}
