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
  // 🟢 Added 'NO_CHANGE' to the allowed status types
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

  if (lead.skipTraceStatus !== 'COMPLETED') {
    const message = `Sync Skipped: Lead skipTraceStatus is '${lead.skipTraceStatus}', not 'COMPLETED'.`;
    console.warn(`⚠️ ${message}`);
    if (lead.ghlSyncStatus !== 'SKIPPED') {
      await updateLeadGhlStatus(lead.id, 'SKIPPED');
    }
    return { status: 'SKIPPED', message };
  }

  await updateLeadGhlStatus(lead.id, 'PENDING');
  console.log(`🔄 Attempting GHL sync for lead ${lead.id}...`);

  try {
    const syncResponse = await syncToGoHighLevel(lead);

    // 🟢 Handle the "UP_TO_DATE" response from the integration
    if (syncResponse === 'UP_TO_DATE') {
      const message = `No changes detected. Lead is already up-to-date in GoHighLevel.`;
      console.log(`ℹ️ ${message}`);

      // We still update the status to SUCCESS in DB because the lead is correctly synced
      await updateLeadGhlStatus(lead.id, 'SUCCESS');

      return { status: 'NO_CHANGE', message };
    }

    // Standard Success
    await updateLeadGhlStatus(lead.id, 'SUCCESS', syncResponse);
    const message = `Successfully synced lead to GoHighLevel.`;
    console.log(`✅ ${message} Contact ID: ${syncResponse}`);

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
    await updateLeadGhlStatus(lead.id, 'FAILED');

    return { status: 'FAILED', message };
  }
}

// ---------------------------------------------------------
// MAIN HANDLER (Remains largely the same, now handles NO_CHANGE)
// ---------------------------------------------------------

export const handler = async (
  event: AppSyncHandlerEvent
): Promise<SyncResult & { leadId: string }> => {
  // ... (Owner and Security checks remain unchanged)
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
