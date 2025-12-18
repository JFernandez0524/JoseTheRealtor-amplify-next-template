// amplify/functions/manualGhlSync/handler.ts

import {
  getLead,
  updateLeadGhlStatus,
  DBLead,
} from '../../../app/utils/aws/data/lead.server';
import { syncToGoHighLevel } from './integrations/gohighlevel';
import { isAxiosError } from 'axios';

const GHL_API_KEY = process.env.GHL_API_KEY;

// ---------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------
type SyncResult = {
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED' | 'ERROR' | 'NO_CHANGE';
  message: string;
  ghlContactId?: string | null;
};

type ManualSyncMutationArguments = {
  leadId: string;
};

type AppSyncHandlerEvent = {
  arguments: ManualSyncMutationArguments;
  identity: {
    sub: string;
  } | null;
};

// ---------------------------------------------------------
// HELPER: Core GHL Sync Logic (processGhlSync)
// ---------------------------------------------------------

async function processGhlSync(lead: DBLead): Promise<SyncResult> {
  if (!GHL_API_KEY) {
    const message = `GHL Sync Skipped: GHL_API_KEY is missing.`;
    console.warn(`⚠️ ${message}`);
    await updateLeadGhlStatus(lead.id, 'SKIPPED');
    return { status: 'SKIPPED', message };
  }

  // Ensure skiptrace is done before attempting GHL sync
  if (lead.skipTraceStatus !== 'COMPLETED') {
    const message = `Sync Skipped: Lead skipTraceStatus is '${lead.skipTraceStatus}', not 'COMPLETED'.`;
    console.warn(`⚠️ ${message}`);
    if (lead.ghlSyncStatus !== 'SKIPPED') {
      await updateLeadGhlStatus(lead.id, 'SKIPPED');
    }
    return { status: 'SKIPPED', message };
  }

  await updateLeadGhlStatus(lead.id, 'PENDING');
  console.info(`🔄 Attempting GHL sync for lead ${lead.id}...`);

  try {
    // Perform the sync - this returns the GHL Contact ID
    const syncResponse = await syncToGoHighLevel(lead);

    // 1. Handle "UP_TO_DATE" from performUpdate helper
    if (syncResponse === 'UP_TO_DATE' || syncResponse === lead.ghlContactId) {
      const message = `No changes detected. Lead is already up-to-date in GoHighLevel.`;
      console.info(`ℹ️ ${message}`);

      // Update DB to reflect successful state check
      await updateLeadGhlStatus(
        lead.id,
        'SUCCESS',
        lead.ghlContactId ?? undefined
      );
      return { status: 'NO_CHANGE', message, ghlContactId: lead.ghlContactId };
    }

    // 2. Standard Success / New ID Found
    // This saves the ghlContactId to DynamoDB for future direct-ID updates
    await updateLeadGhlStatus(lead.id, 'SUCCESS', syncResponse ?? undefined);
    const message = `Successfully synced lead to GoHighLevel.`;
    console.info(`✅ ${message} Contact ID: ${syncResponse}`);

    return { status: 'SUCCESS', message, ghlContactId: syncResponse };
  } catch (error: any) {
    let message = `GHL Sync failed for lead ${lead.id}.`;
    let detail = '';

    if (isAxiosError(error) && error.response) {
      detail = `API responded with HTTP ${error.response.status}. Detail: ${JSON.stringify(error.response.data)}`;
    } else if (error.message) {
      detail = `Error: ${error.message}`;
    }

    message += ` ${detail}`;
    console.error(`❌ ${message}`);

    // Persist failure status to DB
    await updateLeadGhlStatus(lead.id, 'FAILED');

    return { status: 'FAILED', message };
  }
}

// ---------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------

export const handler = async (
  event: AppSyncHandlerEvent
): Promise<SyncResult & { leadId: string }> => {
  const { leadId } = event.arguments;
  const ownerId = event.identity?.sub;

  if (!ownerId) {
    return {
      status: 'ERROR',
      message: 'User identity missing.',
      leadId: leadId || 'unknown',
    };
  }

  try {
    const lead = await getLead(leadId);

    if (!lead) {
      return {
        status: 'ERROR',
        message: 'Lead not found in database.',
        leadId,
      };
    }

    // Security check: Only owners can sync their own leads
    if (lead.owner !== ownerId) {
      return { status: 'ERROR', message: 'Authorization denied.', leadId };
    }

    const syncResult = await processGhlSync(lead);

    return {
      ...syncResult,
      leadId: leadId,
    };
  } catch (error: any) {
    const message = `Internal server error: ${error.message}`;
    return { status: 'ERROR', message: message, leadId: leadId || 'unknown' };
  }
};
