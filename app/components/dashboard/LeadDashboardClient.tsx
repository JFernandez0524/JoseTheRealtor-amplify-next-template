'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { useAccess } from '@/app/context/AccessContext';
import { LeadTable } from './LeadTable';
import { DashboardFilters } from './DashboardFilters';
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
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCrmStatus, setFilterCrmStatus] = useState('');

  // --- Effects ---

  // 1. Listen for Real-time Lead updates
  useEffect(() => {
    const sub = client.models.PropertyLead.observeQuery().subscribe({
      next: ({ items }) => setLeads([...items]),
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

        const { data: accounts } = await client.models.UserAccount.list();

        if (accounts.length > 0) {
          setUserAccount(accounts[0]);
        } else {
          // No profile found: Initialize the user's wallet
          const { data: newAccount } = await client.models.UserAccount.create({
            email: user.signInDetails?.loginId || 'user@email.com',
            credits: 10, // Starter credits
            totalLeadsSynced: 0,
            totalSkipsPerformed: 0,
          });
          if (newAccount) setUserAccount(newAccount);
        }
      } catch (err) {
        console.error('UserAccount error:', err);
      }
    }
    syncUserAccount();
  }, []);

  // --- Filter Logic ---
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
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

      return matchesSearch && matchesType && matchesStatus && matchesCrm;
    });
  }, [leads, searchQuery, filterType, filterStatus, filterCrmStatus]);

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

    // Check Wallet Balance
    const currentCredits = userAccount?.credits || 0;
    if (currentCredits < selectedIds.length) {
      alert(
        `Insufficient Credits! You need ${selectedIds.length} but only have ${currentCredits}. Please refill your wallet.`
      );
      return;
    }

    if (
      !confirm(
        `Skip-trace ${selectedIds.length} leads? (Cost: ${selectedIds.length} credits)`
      )
    )
      return;

    setIsProcessing(true);
    try {
      const { errors } = await client.mutations.skipTraceLeads({
        leadIds: selectedIds,
      });
      if (errors) throw new Error(errors[0].message);

      alert('Bulk skip-trace initiated! Data will appear shortly.');
      setSelectedIds([]);
    } catch (err) {
      console.error('Skip-trace error:', err);
      alert('Error starting skip-trace. Check your network connection.');
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
        selectedLeadsCount={selectedIds.length}
        isSkipTracing={isProcessing}
        isGhlSyncing={isProcessing}
        handleBulkSkipTrace={handleBulkSkipTrace}
        handleBulkGHLSync={handleBulkGHLSync}
        handleDelete={handleDeleteLeads}
        handleExport={() => alert('Exporting leads to CSV...')}
      />

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

      <LeadTable
        leads={filteredLeads}
        selectedIds={selectedIds}
        isLoading={false}
        onToggleAll={() => {
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
        onRowClick={(id) => router.push(`/lead/${id}`)}
      />
    </div>
  );
}
