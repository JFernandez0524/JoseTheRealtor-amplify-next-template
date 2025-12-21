'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation'; // ✅ 1. Import useRouter
import { client } from '@/app/utils/aws/data/frontEndClient';
import {
  getFrontEndUser,
  getFrontEndAuthSession,
} from '@/app/utils/aws/auth/amplifyFrontEndUser';

// Import Child Components
import { LeadTable } from './LeadTable';
import { DashboardFilters } from './DashboardFilters';

import type { Schema } from '@/amplify/data/resource';

type Lead = Schema['PropertyLead']['type'];

interface Props {
  initialLeads: Lead[];
}

export default function LeadDashboardClient({ initialLeads }: Props) {
  const router = useRouter(); // ✅ 2. Initialize router

  // --- State ---
  const [access, setAccess] = useState({ isPro: false, isAdmin: false });
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterGhlStatus, setFilterGhlStatus] = useState('');

  // --- Effects ---

  useEffect(() => {
    getFrontEndUser().then((user) => setCurrentUser(user));
  }, []);

  useEffect(() => {
    const sub = client.models.PropertyLead.observeQuery().subscribe({
      next: ({ items }) => {
        setLeads([...items]);
      },
      error: (err) => console.error('Subscription error:', err),
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    async function checkAccess() {
      const session = await getFrontEndAuthSession();
      if (session) {
        const groups =
          (session.tokens?.accessToken.payload['cognito:groups'] as string[]) ||
          [];
        setAccess({
          isPro: groups.includes('PRO'),
          isAdmin: groups.includes('ADMINS'), // ✅ 3. Updated to match 'ADMINS'
        });
      }
    }
    checkAccess();
  }, []);

  const canUsePremium = access.isPro || access.isAdmin;

  // --- Logic ---

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const search = searchQuery.toLowerCase();
      const matchesSearch =
        lead.ownerAddress?.toLowerCase().includes(search) ||
        lead.ownerLastName?.toLowerCase().includes(search);

      const matchesType = !filterType || lead.type === filterType;
      const matchesStatus =
        !filterStatus || lead.skipTraceStatus === filterStatus;
      const matchesGhl =
        !filterGhlStatus ||
        (filterGhlStatus === 'NULL'
          ? !lead.ghlSyncStatus
          : lead.ghlSyncStatus === filterGhlStatus);

      return matchesSearch && matchesType && matchesStatus && matchesGhl;
    });
  }, [leads, searchQuery, filterType, filterStatus, filterGhlStatus]);

  const handleToggleOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleAll = () => {
    setSelectedIds(
      selectedIds.length === filteredLeads.length
        ? []
        : filteredLeads.map((l) => l.id)
    );
  };

  const handleDeleteLeads = async () => {
    if (!confirm(`Delete ${selectedIds.length} leads?`)) return;
    setIsProcessing(true);
    try {
      await Promise.all(
        selectedIds.map((id) => client.models.PropertyLead.delete({ id }))
      );
      setSelectedIds([]);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // ✅ 4. Updated Navigation Handler
  const handleRowClick = (id: string) => {
    router.push(`/lead/${id}`);
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
        filterGhlStatus={filterGhlStatus}
        setFilterGhlStatus={setFilterGhlStatus}
        selectedLeadsCount={selectedIds.length}
        isSkipTracing={false}
        isGhlSyncing={isProcessing}
        handleBulkSkipTrace={async () => {}}
        handleBulkGHLSync={async () => {}}
        handleDelete={handleDeleteLeads}
        handleExport={() => {}}
      />

      <LeadTable
        leads={filteredLeads}
        selectedIds={selectedIds}
        isLoading={false}
        onToggleAll={handleToggleAll}
        onToggleOne={handleToggleOne}
        onRowClick={handleRowClick} // ✅ Pass the updated handler
      />
    </div>
  );
}
