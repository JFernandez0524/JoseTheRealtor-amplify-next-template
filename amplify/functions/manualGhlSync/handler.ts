// amplify/functions/manualGhlSync/handler.ts

// Data Utilities: Uses the verified relative path to your centralized utility file.
import {
  getLead,
  updateLeadGhlStatus, // 💥 Use the imported type directly (no need to alias for a single usage)
  DBLead,
} from '../../../app/utils/aws/data/lead.server';
// GHL Integration: Sync logic which should return the GHL Contact ID on success.
import { syncToGoHighLevel } from './integrations/gohighlevel';
// Axios Error Handling: For robust error inspection in the sync process.
import { isAxiosError } from 'axios';

// Environment Variable: Correctly uses the GHL_API_KEY environment variable.
const GHL_API_KEY = process.env.GHL_API_KEY;

// ---------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------
// 💥 Define the unified sync result type for clarity
type SyncResult = {
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED' | 'ERROR';
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

/**
 * Executes the GHL sync and immediately records the outcome in the database
 * using the centralized updateLeadGhlStatus utility.
 * @param lead The enriched DBLead object.
 * @returns An object detailing the sync result.
 */
async function processGhlSync(lead: DBLead): Promise<SyncResult> {
  if (!GHL_API_KEY) {
    const message = `GHL Sync Skipped: GHL_API_KEY is missing.`;
    console.warn(`⚠️ ${message}`);
    await updateLeadGhlStatus(lead.id, 'SKIPPED');
    return { status: 'SKIPPED', message };
  } // NOTE: skipTraceStatus is Optional/Nullable, so we need safe access.
  // Check if lead is ready to sync (must be COMPLETED)

  if (lead.skipTraceStatus !== 'COMPLETED') {
    const message = `Sync Skipped: Lead skipTraceStatus is '${lead.skipTraceStatus}', not 'COMPLETED'.`;
    console.warn(`⚠️ ${message}`);
    // Update status to SKIPPED, ensuring the status is recorded if not COMPLETED
    if (lead.ghlSyncStatus !== 'SKIPPED') {
      await updateLeadGhlStatus(lead.id, 'SKIPPED');
    }
    return { status: 'SKIPPED', message };
  }

  await updateLeadGhlStatus(lead.id, 'PENDING');

  console.log(`🔄 Attempting GHL sync for lead ${lead.id}...`);

  try {
    // Pass the fully typed lead object
    const ghlContactId = await syncToGoHighLevel(lead); // If syncToGoHighLevel completes, record SUCCESS

    await updateLeadGhlStatus(lead.id, 'SUCCESS', ghlContactId);
    const message = `Successfully synced lead to GoHighLevel.`;
    console.log(`✅ ${message} Contact ID: ${ghlContactId}`);

    return { status: 'SUCCESS', message, ghlContactId };
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
// MAIN HANDLER
// ---------------------------------------------------------

export const handler = async (
  event: AppSyncHandlerEvent
): Promise<SyncResult & { leadId: string }> => {
  const { leadId } = event.arguments;
  const ownerId = event.identity?.sub;

  if (!ownerId) {
    console.error('❌ ERROR: User identity (ownerId) is missing.'); // Return type must match SyncResult & { leadId: string }
    return {
      status: 'ERROR',
      message: 'User identity missing.',
      leadId: leadId || 'unknown',
    };
  }

  console.log(
    `Manual GHL Sync triggered for Lead ID: ${leadId} by Owner: ${ownerId}`
  );

  try {
    // 1. Fetch the lead data using the centralized utility (Now uses DynamoDB)
    const lead = await getLead(leadId);

    if (!lead) {
      console.error(`⚠️ Lead not found: ${leadId}`);
      return {
        status: 'ERROR',
        message: 'Lead not found in database.',
        leadId,
      };
    } // 2. Security Check: Ensure the user owns the lead (Authorization)

    if (lead.owner !== ownerId) {
      console.error(
        `❌ SECURITY ERROR: User ${ownerId} tried to sync lead owned by ${lead.owner}.`
      );
      return { status: 'ERROR', message: 'Authorization denied.', leadId };
    } // 3. Execute the GHL sync and update DB status

    const syncResult = await processGhlSync(lead); // 4. Return status to AppSync

    return {
      ...syncResult,
      leadId: leadId, // ghlContactId is now correctly attached to syncResult inside processGhlSync
    };
  } catch (error: any) {
    const message = `Internal server error: ${error.message}`;
    console.error(
      `❌ Unhandled Error in manualGhlSync handler for ${leadId}:`,
      message
    );
    return {
      status: 'ERROR',
      message: message,
      leadId: leadId || 'unknown',
    };
  }
};
