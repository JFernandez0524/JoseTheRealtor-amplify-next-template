'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { 
  fetchLeads, 
  observeLeads, 
  bulkDeleteLeads, 
  bulkUpdateStatus, 
  skipTraceLeads, 
  syncToGHL
} from '@/app/utils/aws/data/lead.client';
import { useAccess } from '@/app/context/AccessContext';
import { LeadTable } from './LeadTable';
import { DashboardFilters } from './DashboardFilters';
import { GhlConnection } from './GhlConnection';
import { AIInsightsDashboard } from './AIInsightsDashboard';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import type { Schema } from '@/amplify/data/resource';

type Lead = Schema['PropertyLead']['type'];
type UserAccount = Schema['UserAccount']['type'];

interface Props {}

export default function LeadDashboardClient({}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPaidPlan, isAdmin, isAI } = useAccess();

  // --- State ---
  const [leads, setLeads] = useState<Lead[]>([]);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100); // Show 100 leads per page

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCrmStatus, setFilterCrmStatus] = useState('');
  const [filterHasPhone, setFilterHasPhone] = useState('');
  const [filterManualStatus, setFilterManualStatus] = useState('');
  const [filterAiPriority, setFilterAiPriority] = useState('');
  const [skipTraceFromDate, setSkipTraceFromDate] = useState('');
  const [skipTraceToDate, setSkipTraceToDate] = useState('');

  // Debug: Log unique skipTraceStatus values
  useEffect(() => {
    const statuses = new Set(leads.map(l => l.skipTraceStatus).filter(Boolean));
    console.log('Unique skipTraceStatus values:', Array.from(statuses));
  }, [leads]);

  // Sort States
  const [sortField, setSortField] = useState<
    | 'createdAt'
    | 'updatedAt'
    | 'ownerLastName'
    | 'ownerCounty'
    | 'zestimate'
    | 'skipTraceCompletedAt'
    | 'aiScore'
  >('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // --- Effects ---

  // Fetch leads with observeQuery
  useEffect(() => {
    const sub = observeLeads((items) => {
      setLeads([...items]);
      console.log('📊 Loaded leads:', items.length);
    });

    return () => sub.unsubscribe();
  }, []);



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
        '🔄 Upload redirect detected, observeQuery will sync automatically'
      );
      router.replace('/dashboard', { scroll: false });
    }
  }, [searchParams, router]);

  // 4. Remove visibility change handler - observeQuery handles real-time sync
  // (removed)

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
          !filterStatus || 
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

        const matchesManualStatus =
          !filterManualStatus ||
          (filterManualStatus === 'NULL'
            ? !lead.manualStatus
            : lead.manualStatus === filterManualStatus);

        const matchesAiPriority =
          !filterAiPriority || lead.aiPriority === filterAiPriority;

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
          matchesManualStatus &&
          matchesAiPriority &&
          matchesDateRange
        );
      })
      .sort((a, b) => {
        // Sort the filtered results
        let aValue: any = a[sortField];
        let bValue: any = b[sortField];

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
        if (sortField === 'zestimate' || sortField === 'aiScore') {
          aValue = parseFloat(aValue || 0);
          bValue = parseFloat(bValue || 0);
        }

        // Handle string sorting
        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = (bValue || '').toLowerCase();
        }

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
    filterManualStatus,
    filterAiPriority,
    skipTraceFromDate,
    skipTraceToDate,
    sortField,
    sortDirection,
  ]);

  // --- Sort Handler ---
  const handleSort = (
    field:
      | 'createdAt'
      | 'updatedAt'
      | 'ownerLastName'
      | 'ownerCounty'
      | 'zestimate'
      | 'skipTraceCompletedAt'
      | 'aiScore'
  ) => {
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
      alert('CRM Sync requires a PRO or AI membership.');
      router.push('/pricing');
      return;
    }

    if (!confirm(`Sync ${selectedIds.length} leads to your CRM?`)) return;

    setIsProcessing(true);
    try {
      const { successful, failed } = await syncToGHL(selectedIds);
      alert(`CRM Sync Complete!\n✅ Successful: ${successful}\n❌ Failed: ${failed}`);
      setSelectedIds([]);
      
      // Wait for Lambda to complete processing, then refresh
      await new Promise(resolve => setTimeout(resolve, 1000));
      await refreshLeads();
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

    // Warn if batch is too large
    if (selectedIds.length > 50) {
      if (!confirm(
        `⚠️ Large batch detected (${selectedIds.length} leads)\n\n` +
        `This will take several minutes to complete.\n` +
        `Consider processing in smaller batches of 50 or less for faster results.\n\n` +
        `Continue anyway?`
      )) return;
    }

    setIsProcessing(true);
    
    // Safety timeout - reset processing state after 2 minutes max
    const safetyTimeout = setTimeout(() => {
      console.warn('⚠️ Skip trace timeout - resetting processing state');
      setIsProcessing(false);
    }, 120000);
    
    try {
      const data = await skipTraceLeads(selectedIds);

      console.log('Skip trace response:', JSON.stringify(data, null, 2));
      console.log('Response type:', typeof data);
      console.log('Is array?:', Array.isArray(data));

      // Handle response - data is the array directly
      const results = Array.isArray(data) ? data : [];
      console.log('Results array:', results);
      console.log('Results length:', results.length);
      
      const successful = results.filter((r: any) => {
        console.log('Checking result:', r, 'status:', r?.status);
        return r?.status === 'SUCCESS';
      }).length;
      
      const failed = results.filter(
        (r: any) => r?.status === 'FAILED' || r?.status === 'ERROR'
      ).length;
      
      const noMatch = results.filter(
        (r: any) => r?.status === 'NO_MATCH'
      ).length;
      
      const noQuality = results.filter(
        (r: any) => r?.status === 'NO_QUALITY_CONTACTS'
      ).length;

      console.log('Successful count:', successful);
      console.log('Failed count:', failed);
      console.log('No Match count:', noMatch);
      console.log('No Quality count:', noQuality);

      alert(
        `Skip-trace complete!\n✅ Successful: ${successful}\n❌ Failed: ${failed}\n⚠️ No Match: ${noMatch}\n📭 No Quality Contacts: ${noQuality}\n\nPage will refresh in 1 second...`
      );

      setSelectedIds([]);
      
      // Refresh page after 1 second
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      console.error('Skip-trace error:', err);
      alert(`Error during skip-trace: ${err.message || 'Check your network connection'}`);
    } finally {
      clearTimeout(safetyTimeout);
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
      await bulkDeleteLeads(selectedIds);
      setSelectedIds([]);
      alert('Leads deleted successfully.');
      await refreshLeads();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedIds.length === 0) return;

    if (!confirm(`Set ${selectedIds.length} leads to ${status}?`)) return;

    setIsProcessing(true);
    try {
      await bulkUpdateStatus(
        selectedIds,
        status as 'ACTIVE' | 'SOLD' | 'PENDING' | 'OFF_MARKET' | 'SKIP' | 'DIRECT_MAIL'
      );
      alert(`Successfully updated ${selectedIds.length} leads to ${status}`);
      setSelectedIds([]);
      await refreshLeads();
    } catch (err) {
      console.error('Bulk status update error:', err);
      alert('Error updating lead statuses');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkAIScore = async () => {
    if (selectedIds.length === 0) return;

    // Filter to preforeclosure only
    const selectedLeads = leads.filter((lead) => selectedIds.includes(lead.id));
    const preforeclosureLeads = selectedLeads.filter(
      (lead) => lead.type === 'PREFORECLOSURE'
    );

    if (preforeclosureLeads.length === 0) {
      alert(
        'AI scoring is only for preforeclosure leads (where we have equity data).'
      );
      return;
    }

    if (
      !confirm(
        `Calculate AI scores for ${preforeclosureLeads.length} preforeclosure leads?`
      )
    )
      return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/v1/ai/score-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: preforeclosureLeads.map((l) => l.id) }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      alert(
        `✅ AI Scoring Complete!\nScored: ${result.scored}/${result.total} preforeclosure leads`
      );
      setSelectedIds([]);
      await refreshLeads();
    } catch (err) {
      console.error('AI scoring error:', err);
      alert('Error calculating AI scores');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkEnrichLeads = async () => {
    if (selectedIds.length === 0) return;

    // Filter to preforeclosure only
    const selectedLeads = leads.filter((lead) => selectedIds.includes(lead.id));
    const preforeclosureLeads = selectedLeads.filter(
      (lead) => lead.type === 'PREFORECLOSURE'
    );

    if (preforeclosureLeads.length === 0) {
      alert(
        'No preforeclosure leads selected. BatchData enrichment is only for preforeclosure leads.'
      );
      return;
    }

    const cost = preforeclosureLeads.length * 0.29;
    if (
      !confirm(
        `Enrich ${preforeclosureLeads.length} preforeclosure leads with BatchData?\n\n` +
          `Cost: $${cost.toFixed(2)}\n\n` +
          `You'll get:\n` +
          `• Real equity % and mortgage balances\n` +
          `• Owner emails and phone numbers\n` +
          `• Property flags (owner occupied, high equity, etc.)`
      )
    )
      return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/v1/enrich-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedIds }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      alert(
        `✅ Enrichment Complete!\n\n` +
          `Enriched: ${result.enriched} leads\n` +
          `Skipped: ${result.skipped} (already enriched)\n` +
          `Failed: ${result.failed}\n` +
          `Cost: $${result.cost.toFixed(2)}`
      );
      setSelectedIds([]);
      await refreshLeads();
    } catch (err) {
      console.error('Enrichment error:', err);
      alert(
        'Error enriching leads: ' +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setIsProcessing(false);
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

      alert(
        `✅ Direct Mail Campaign Complete!\n\nSent: ${sent}/${result.generated} letters\nFailed: ${failed}\n\nTracking numbers saved to leads.\nExpected delivery: 3-5 business days`
      );

      setSelectedIds([]);
    } catch (err) {
      console.error('Direct mail generation error:', err);
      alert('Error sending letters via Click2Mail');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkEmailCampaign = async () => {
    if (
      !confirm(
        `Start email campaign for all eligible contacts in GHL?\n\nThis will send prospecting emails to contacts that haven't been emailed yet.`
      )
    )
      return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/v1/start-email-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      alert(
        `✅ Email Campaign Complete!\n\nEmails sent: ${result.successCount}\nFailed: ${result.failCount}\nTotal contacts: ${result.totalContacts}`
      );
    } catch (err: any) {
      console.error('Email campaign error:', err);
      alert(`Error starting email campaign: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSkipTraced = () => {
    if (selectedIds.length === 0) {
      alert('Please select leads to download.');
      return;
    }

    const selectedLeads = filteredLeads.filter((lead) =>
      selectedIds.includes(lead.id)
    );

    if (selectedLeads.length === 0) {
      alert('No selected leads found.');
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
      'GHL Sync',
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
          `"${lead.manualStatus || ''}"`,
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

    alert(`Downloaded ${selectedLeads.length} selected leads to CSV.`);
  };

  return (
    <div className='space-y-4'>
      {/* AI Insights Dashboard */}
      <AIInsightsDashboard
        leads={filteredLeads}
        onLeadClick={(leadId) => {
          const leadIds = filteredLeads.map((lead) => lead.id);
          const navContext = {
            ids: leadIds,
            filterType: filterType || null,
          };
          sessionStorage.setItem('leadNavContext', JSON.stringify(navContext));
          router.push(`/lead/${leadId}`);
        }}
      />

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
        filterManualStatus={filterManualStatus}
        setFilterManualStatus={setFilterManualStatus}
        filterAiPriority={filterAiPriority}
        setFilterAiPriority={setFilterAiPriority}
        skipTraceFromDate={skipTraceFromDate}
        setSkipTraceFromDate={setSkipTraceFromDate}
        skipTraceToDate={skipTraceToDate}
        setSkipTraceToDate={setSkipTraceToDate}
        hasAI={isAI}
        selectedLeadsCount={selectedIds.length}
        selectedLeadTypes={leads.filter(l => selectedIds.includes(l.id)).map(l => l.type)}
        isSkipTracing={isProcessing}
        isGhlSyncing={isProcessing}
        isAiScoring={isProcessing}
        isEnriching={isProcessing}
        isGeneratingLetters={isProcessing}
        handleBulkSkipTrace={handleBulkSkipTrace}
        handleBulkGHLSync={handleBulkGHLSync}
        handleBulkStatusUpdate={handleBulkStatusUpdate}
        handleBulkAIScore={handleBulkAIScore}
        handleBulkEnrichLeads={handleBulkEnrichLeads}
        handleBulkDirectMail={handleBulkDirectMail}
        handleBulkEmailCampaign={handleBulkEmailCampaign}
        handleDelete={handleDeleteLeads}
        handleExport={() => alert('Exporting leads to CSV...')}
        handleDownloadSkipTraced={handleDownloadSkipTraced}
        handleViewDetails={handleViewDetails}
        isEmailCampaigning={isProcessing}
      />

      {/* GHL Connection Status */}
      <GhlConnection />

      {/* Wallet Status Bar */}
      <div className='flex justify-end items-center gap-4 px-2'>
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
        isLoading={false}
        totalFilteredCount={filteredLeads.length}
        onRefresh={refreshLeads}
        onToggleAll={() => {
          setSelectedIds(
            selectedIds.length === paginatedLeads.length
              ? []
              : paginatedLeads.map((l) => l.id)
          );
        }}
        onToggleAllFiltered={() => {
          setSelectedIds(
            selectedIds.length === filteredLeads.length
              ? []
              : filteredLeads.map((l) => l.id)
          );
        }}
        onToggleOne={(id) => {
          setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
          );
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
    </div>
  );
}
