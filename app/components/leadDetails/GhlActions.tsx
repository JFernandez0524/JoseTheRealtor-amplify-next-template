// app/components/GhlActions.tsx

import { useState } from 'react';
import { Loader } from '@aws-amplify/ui-react';

interface GhlActionsProps {
  leadId: string;
  ghlContactId: string | null | undefined;
  ghlSyncStatus: string | null | undefined;
  onSyncComplete: () => void;
  client: any; // Use 'any' for the Amplify client
}

export function GhlActions({
  leadId,
  ghlContactId,
  ghlSyncStatus,
  onSyncComplete,
  client,
}: GhlActionsProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  // Base GHL URL (Replace with your actual GHL location URL template)
  const GHL_BASE_URL = 'https://app.gohighlevel.com/v2/location/';
  const GHL_LOCATION_ID = 'mHaAy3ZaUHgrbPyughDG'; // Replace with your actual location ID

  const handleManualGhlSync = async () => {
    if (!leadId) return;

    setIsSyncing(true);
    try {
      // NOTE: Calling the AppSync mutation
      const { data: syncResult, errors } = await client.mutations.manualGhlSync(
        { leadId }
      );

      if (
        errors ||
        syncResult?.status === 'ERROR' ||
        syncResult?.status === 'FAILED'
      ) {
        throw new Error(
          errors?.[0]?.message || syncResult?.message || 'GHL Sync failed.'
        );
      }

      alert(
        `GHL Sync Status: ${syncResult?.status || 'SUCCESS'}. Contact ID: ${syncResult?.ghlContactId || ghlContactId}`
      );
      onSyncComplete(); // Refresh parent data
    } catch (err: any) {
      console.error('Manual GHL Sync failed:', err);
      alert(`GHL Sync failed: ${err.message || 'Check console.'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncStatusColor = (status: string | null | undefined) => {
    switch (status) {
      case 'SUCCESS':
        return 'bg-purple-100 text-purple-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'SKIPPED':
      case null:
      case undefined:
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isSynced = ghlContactId && ghlSyncStatus === 'SUCCESS';

  return (
    <div className='bg-white shadow border rounded-lg p-6 border-l-4 border-l-purple-500'>
      <h2 className='text-xl font-semibold mb-4'>GHL Actions & Status</h2>
      <div className='space-y-4'>
        <div className='flex justify-between items-center'>
          <label className='text-sm font-medium text-gray-500'>
            Sync Status
          </label>
          <span
            className={`px-2 py-0.5 rounded text-xs font-bold ${syncStatusColor(ghlSyncStatus)}`}
          >
            {ghlSyncStatus || 'N/A'}
          </span>
        </div>

        {ghlContactId && (
          <div className='flex justify-between items-center'>
            <label className='text-sm font-medium text-gray-500'>
              Contact ID
            </label>
            <span className='text-sm font-mono bg-gray-50 px-2 py-1 rounded'>
              {ghlContactId}
            </span>
          </div>
        )}

        <button
          onClick={handleManualGhlSync}
          disabled={isSyncing || ghlSyncStatus === 'PENDING'}
          className={`w-full text-sm px-3 py-2 rounded transition-colors flex items-center justify-center gap-2 font-medium ${
            isSyncing || ghlSyncStatus === 'PENDING'
              ? 'bg-indigo-300 text-white cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {isSyncing || ghlSyncStatus === 'PENDING' ? (
            <>
              <Loader size='small' variation='linear' /> Syncing...
            </>
          ) : (
            'Manual Sync to GHL'
          )}
        </button>

        {isSynced && ghlContactId && (
          <a
            href={`${GHL_BASE_URL}${GHL_LOCATION_ID}/contacts/detail/${ghlContactId}`}
            target='_blank'
            rel='noopener noreferrer'
            className='block w-full text-center text-sm px-3 py-2 border border-purple-500 text-purple-600 rounded hover:bg-purple-50 transition'
          >
            View Contact in GoHighLevel
          </a>
        )}
      </div>
    </div>
  );
}
