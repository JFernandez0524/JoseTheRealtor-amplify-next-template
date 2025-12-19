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
  // 🎯 FIX 1: Runtime Resolution Check
  if (!GHL_API_KEY) {
    const message = `GHL_API_KEY is not defined in the Lambda environment. Please check Amplify secrets.`;
    console.error(`❌ ${message}`);
    await updateLeadGhlStatus(lead.id, 'FAILED');
    return { status: 'FAILED', message };
  }

  // 🎯 FIX 2: Case-Insensitive Status Check (Handles 'completed' or 'COMPLETED')
  const currentSkipStatus = lead.skipTraceStatus?.toUpperCase();
  if (currentSkipStatus !== 'COMPLETED') {
    const message = `Sync Skipped: Lead requires contact info. Current status: '${lead.skipTraceStatus}'.`;
    console.warn(`⚠️ ${message}`);
    if (lead.ghlSyncStatus !== 'SKIPPED') {
      await updateLeadGhlStatus(lead.id, 'SKIPPED');
    }
    return { status: 'SKIPPED', message };
  }

  await updateLeadGhlStatus(lead.id, 'PENDING');
  console.info(`🔄 Attempting GHL sync for lead ${lead.id}...`);

  try {
    // 🎯 Note: Ensure './integrations/gohighlevel' is updated to NOT send fake emails.
    // The lead object passed here contains the real emails/phones from DB.
    const syncResponse = await syncToGoHighLevel(lead);

    // 1. Handle "UP_TO_DATE"
    if (syncResponse === 'UP_TO_DATE' || syncResponse === lead.ghlContactId) {
      const message = `No changes detected. Lead is already up-to-date in GoHighLevel.`;
      console.info(`ℹ️ ${message}`);

      await updateLeadGhlStatus(
        lead.id,
        'SUCCESS',
        lead.ghlContactId ?? undefined
      );
      return { status: 'SUCCESS', message, ghlContactId: lead.ghlContactId };
    }

    // 2. Standard Success
    await updateLeadGhlStatus(lead.id, 'SUCCESS', syncResponse ?? undefined);
    const message = `Successfully synced lead to GoHighLevel.`;
    console.info(`✅ ${message} Contact ID: ${syncResponse}`);

    return { status: 'SUCCESS', message, ghlContactId: syncResponse };
  } catch (error: any) {
    let message = `GHL sync failed:`;
    let detail = '';

    if (isAxiosError(error) && error.response) {
      // 🎯 FIX 3: Detailed error reporting for GHL (captures 401 Invalid JWT, 400 Bad Request, etc.)
      const ghlData = error.response.data;
      detail = ghlData?.message || JSON.stringify(ghlData);
      console.error(
        `❌ [GHL ERR] ${error.response.status} on lead ${lead.id}:`,
        detail
      );
    } else {
      detail = error.message || 'Unknown error during sync.';
    }

    const finalMessage = `${message} ${detail}`;

    // Update DB to reflect failure
    await updateLeadGhlStatus(lead.id, 'FAILED');

    // 🎯 IMPORTANT: Return FAILED so the frontend catch block triggers the alert
    return { status: 'FAILED', message: finalMessage };
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

    // Security check
    if (lead.owner !== ownerId) {
      return { status: 'ERROR', message: 'Authorization denied.', leadId };
    }

    const syncResult = await processGhlSync(lead);

    // 🎯 If the result is FAILED, we throw to ensure AppSync captures the error correctly
    if (syncResult.status === 'FAILED' || syncResult.status === 'ERROR') {
      // Returning it as an object is fine for AppSync,
      // but ensure the UI code checks result.status
    }

    return {
      ...syncResult,
      leadId: leadId,
    };
  } catch (error: any) {
    console.error('🔥 Critical Handler Error:', error);
    return {
      status: 'ERROR',
      message: `Internal server error: ${error.message}`,
      leadId: leadId || 'unknown',
    };
  }
};
