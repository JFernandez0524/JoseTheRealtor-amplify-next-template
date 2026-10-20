'use client';

// app/components/leadDetails/GhlActions.tsx

import { useState } from 'react';
import { Loader } from '@aws-amplify/ui-react';
import { useAccess } from '@/app/context/AccessContext';
import Link from 'next/link';

interface GhlActionsProps {
  leadId: string;
  ghlContactId: string | null | undefined;
  ghlSyncStatus: string | null | undefined;
  skipTraceStatus: string | null | undefined;
  listingStatus?: string | null;
  leadLabels?: (string | null)[] | null;
  onSyncComplete: () => void;
  client: any;
}

export function GhlActions({
  leadId,
  ghlContactId,
  ghlSyncStatus,
  skipTraceStatus,
  listingStatus,
  leadLabels,
  onSyncComplete,
  client,
}: GhlActionsProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const { hasPaidPlan } = useAccess();

  // Status Check Helpers (Case-Insensitive)
  const currentGhlStatus = ghlSyncStatus?.toUpperCase();
  const currentSkipStatus = skipTraceStatus?.toUpperCase();

  const handleManualGhlSync = async () => {
    setIsSyncing(true);
    try {
      const { data: syncResult, errors } = await client.mutations.manualGhlSync(
        {
          leadId,
        }
      );

      if (errors || syncResult?.status === 'FAILED') {
        // 🎯 Pull the specific error message from the Lambda result
        const errorDetail =
          syncResult?.message || errors?.[0]?.message || 'Unknown Error';
        throw new Error(errorDetail);
      }

      if (syncResult?.status === 'SKIPPED') {
        alert(`⚠️ Sync Skipped: ${syncResult?.message || 'Lead not eligible for sync'}`);
        onSyncComplete();
        return;
      }

      alert('✅ Sync Success!');
      // 🎯 Refresh the lead data in the parent component
      onSyncComplete();
    } catch (err: any) {
      alert(`❌ Sync Error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * 🎯 THE FIX: Button Logic
   * 1. Must be off-market (not active/sold/skip/etc.)
   * 2. Must have completed skip trace (COMPLETED or NO_QUALITY_CONTACTS). NO_MATCH is blocked.
   * 3. Must not be currently syncing.
   */
  const normListingStatus = (listingStatus || '').trim().toLowerCase();
  const labels = Array.isArray(leadLabels) ? leadLabels : [];
  const isOffMarket =
    (!normListingStatus || normListingStatus === 'off_market') &&
    !labels.some((l) => l === 'ACTIVE_MLS' || l === 'RECENTLY_SOLD');
  const isSkipTraceCompleted =
    currentSkipStatus === 'COMPLETED' || currentSkipStatus === 'NO_QUALITY_CONTACTS';
  const isReadyToSync = isOffMarket && isSkipTraceCompleted;
  const canClickSync = isReadyToSync && !isSyncing;
  const isAlreadySynced = currentGhlStatus === 'SUCCESS';

  const disabledLabel = !isOffMarket
    ? `Blocked (${listingStatus || 'Not Off-Market'})`
    : currentSkipStatus === 'NO_MATCH'
      ? 'No Match — Cannot Sync'
      : 'Awaiting Skip Trace';

  if (!hasPaidPlan) {
    return (
      <div className='bg-white shadow border rounded-lg p-6 border-l-4 border-l-purple-500'>
        <h2 className='text-xl font-semibold mb-2'>Launch AI Actions & Status</h2>
        <p className='text-sm text-slate-500 mb-4'>CRM sync requires a Sync Plan or higher.</p>
        <Link
          href='/pricing'
          className='block w-full text-center bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded hover:bg-indigo-700 transition-colors'
        >
          Upgrade to Sync Plan
        </Link>
      </div>
    );
  }

  return (
    <div className='bg-white shadow border rounded-lg p-6 border-l-4 border-l-purple-500'>
      <h2 className='text-xl font-semibold mb-4'>Launch AI Actions & Status</h2>
      <div className='space-y-4'>
        <div className='flex justify-between items-center'>
          <label className='text-sm font-medium text-gray-500'>
            Sync Status
          </label>
          <span
            className={`px-2 py-0.5 rounded text-xs font-bold ${
              currentGhlStatus === 'SUCCESS'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {ghlSyncStatus || 'NOT SYNCED'}
          </span>
        </div>

        <button
          onClick={handleManualGhlSync}
          disabled={!canClickSync}
          className={`w-full text-sm px-3 py-2 rounded transition-colors flex items-center justify-center gap-2 font-medium ${
            !canClickSync
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : isAlreadySynced
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-300 hover:bg-indigo-200'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {isSyncing ? (
            <>
              <Loader size='small' /> Updating...
            </>
          ) : !isReadyToSync ? (
            disabledLabel
          ) : isAlreadySynced ? (
            'Push Update to Launch AI'
          ) : (
            'Initial Sync to Launch AI'
          )}
        </button>

        {isAlreadySynced && !isSyncing && (
          <p className='text-[10px] text-gray-400 text-center italic'>
            Lead already in Launch AI. Click above to sync recent changes.
          </p>
        )}
      </div>
    </div>
  );
}
