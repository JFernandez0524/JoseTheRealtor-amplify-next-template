// app/components/leadDetails/GhlActions.tsx

import { useState } from 'react';
import { Loader } from '@aws-amplify/ui-react';

interface GhlActionsProps {
  leadId: string;
  ghlContactId: string | null | undefined;
  ghlSyncStatus: string | null | undefined;
  skipTraceStatus: string | null | undefined;
  onSyncComplete: () => void;
  client: any;
}

export function GhlActions({
  leadId,
  ghlContactId,
  ghlSyncStatus,
  skipTraceStatus,
  onSyncComplete,
  client,
}: GhlActionsProps) {
  const [isSyncing, setIsSyncing] = useState(false);

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
   * 1. Must be COMPLETED (has phone numbers).
   * 2. Must not be currently syncing.
   * 3. We NO LONGER block if status is 'SUCCESS' so we can push updates.
   */
  const isReadyToSync = currentSkipStatus === 'COMPLETED';
  const canClickSync = isReadyToSync && !isSyncing;
  const isAlreadySynced = currentGhlStatus === 'SUCCESS';

  return (
    <div className='bg-white shadow border rounded-lg p-6 border-l-4 border-l-purple-500'>
      <h2 className='text-xl font-semibold mb-4'>GHL Actions & Status</h2>
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
            'Awaiting Contact Info'
          ) : isAlreadySynced ? (
            'Push Update to GHL' // 🎯 Visual cue that this is an update, not first sync
          ) : (
            'Initial Sync to GHL'
          )}
        </button>

        {isAlreadySynced && !isSyncing && (
          <p className='text-[10px] text-gray-400 text-center italic'>
            Lead already in GHL. Click above to sync recent changes.
          </p>
        )}
      </div>
    </div>
  );
}
