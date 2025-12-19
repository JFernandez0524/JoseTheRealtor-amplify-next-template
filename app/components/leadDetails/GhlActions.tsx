// app/components/leadDetails/GhlActions.tsx

import { useState } from 'react';
import { Loader } from '@aws-amplify/ui-react';

interface GhlActionsProps {
  leadId: string;
  ghlContactId: string | null | undefined;
  ghlSyncStatus: string | null | undefined;
  skipTraceStatus: string | null | undefined; // 🎯 Ensure this is here
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
        // 🎯 Pull the specific error message (e.g., "Invalid JWT") from the result
        const errorDetail =
          syncResult?.message || errors?.[0]?.message || 'Unknown Error';
        throw new Error(errorDetail);
      }

      alert('✅ Sync Success!');
    } catch (err: any) {
      // 🎯 This alert will now match the CloudWatch alarm trigger
      alert(`❌ Production Error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // 🎯 THE FIX: Enable button only if lead has phone (COMPLETED) and isn't already synced (SUCCESS)
  const isReadyToSync = currentSkipStatus === 'COMPLETED';
  const isAlreadySynced = currentGhlStatus === 'SUCCESS';
  const canClickSync = isReadyToSync && !isSyncing && !isAlreadySynced;

  return (
    <div className='bg-white shadow border rounded-lg p-6 border-l-4 border-l-purple-500'>
      <h2 className='text-xl font-semibold mb-4'>GHL Actions & Status</h2>
      <div className='space-y-4'>
        <div className='flex justify-between items-center'>
          <label className='text-sm font-medium text-gray-500'>
            Sync Status
          </label>
          <span
            className={`px-2 py-0.5 rounded text-xs font-bold ${currentGhlStatus === 'SUCCESS' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100'}`}
          >
            {ghlSyncStatus || 'N/A'}
          </span>
        </div>

        <button
          onClick={handleManualGhlSync}
          disabled={!canClickSync} // 🎯 This is now gated by the new logic
          className={`w-full text-sm px-3 py-2 rounded transition-colors flex items-center justify-center gap-2 font-medium ${
            !canClickSync
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {isSyncing ? (
            <>
              <Loader size='small' variation='linear' /> Syncing...
            </>
          ) : isAlreadySynced ? (
            '✓ Synced to GHL'
          ) : !isReadyToSync ? (
            'Awaiting Contact Info'
          ) : (
            'Manual Sync to GHL'
          )}
        </button>
      </div>
    </div>
  );
}
