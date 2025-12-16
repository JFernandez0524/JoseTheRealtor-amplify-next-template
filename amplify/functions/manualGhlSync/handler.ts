// amplify/functions/manualGhlSync/handler.ts

// Data Utilities: Uses the verified relative path to your centralized utility file.
import {
  getLead,
  updateLeadGhlStatus,
  // 💥 Import the canonical type and alias it for clarity
  DBLead as CanonicalLeadType,
} from '../../../app/utils/aws/data/lead.server';
// GHL Integration: Sync logic which should return the GHL Contact ID on success.
import { syncToGoHighLevel } from './integrations/gohighlevel';
// Axios Error Handling: For robust error inspection in the sync process.
import { isAxiosError } from 'axios';

// Environment Variable: Correctly uses the GHL_API_KEY environment variable.
const GHL_API_KEY = process.env.GHL_API_KEY;

// 💥 REMOVED: Local interface DBLead definition
// We will use CanonicalLeadType everywhere instead.

// --- Type Definitions ---
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
 * @param lead The enriched DBLead object (CanonicalLeadType).
 * @returns An object detailing the sync result.
 */
async function processGhlSync(
  lead: CanonicalLeadType // 💥 Use the canonical type
): Promise<{ status: string; message: string }> {
  if (!GHL_API_KEY) {
    const message = `GHL Sync Skipped: GHL_API_KEY is missing.`;
    console.warn(`⚠️ ${message}`);
    await updateLeadGhlStatus(lead.id, 'SKIPPED');
    return { status: 'SKIPPED', message };
  }

  // NOTE: skipTraceStatus is Optional/Nullable, so we need safe access.
  if (lead.skipTraceStatus !== 'COMPLETED') {
    const message = `Sync Skipped: Lead skipTraceStatus is '${lead.skipTraceStatus}', not 'COMPLETED'.`;
    console.warn(`⚠️ ${message}`);
    return { status: 'SKIPPED', message };
  }

  await updateLeadGhlStatus(lead.id, 'PENDING');

  console.log(`🔄 Attempting GHL sync for lead ${lead.id}...`);

  try {
    // This call is now passing CanonicalLeadType, so the integration file
    // must be fixed to accept CanonicalLeadType.
    const ghlContactId = await syncToGoHighLevel(lead as any); // Cast as 'any' temporarily until Step 2 is applied

    // If syncToGoHighLevel completes, record SUCCESS
    await updateLeadGhlStatus(lead.id, 'SUCCESS', ghlContactId);
    const message = `Successfully synced lead to GHL. Contact ID: ${ghlContactId}`;
    console.log(`✅ ${message}`);

    return { status: 'SUCCESS', message };
  } catch (error: any) {
    // ... (Error handling unchanged) ...
    let message = `GHL Sync failed for lead ${lead.id}.`;

    if (isAxiosError(error) && error.response) {
      message += ` API responded with HTTP ${error.response.status}. Detail: ${JSON.stringify(error.response.data)}`;
    } else if (error.message) {
      message += ` Error: ${error.message}`;
    }

    console.error(`❌ ${message}`);
    await updateLeadGhlStatus(lead.id, 'FAILED');

    return { status: 'FAILED', message };
  }
}

// ---------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------

export const handler = async (event: AppSyncHandlerEvent) => {
  const { leadId } = event.arguments;
  const ownerId = event.identity?.sub;

  if (!ownerId) {
    console.error('❌ ERROR: User identity (ownerId) is missing.');
    return { status: 'ERROR', message: 'User identity missing.' };
  }

  console.log(
    `Manual GHL Sync triggered for Lead ID: ${leadId} by Owner: ${ownerId}`
  );

  try {
    // 1. Fetch the lead data using the centralized utility
    const leadResult = await getLead(leadId);

    if (!leadResult) {
      console.error(`⚠️ Lead not found: ${leadId}`);
      return { status: 'ERROR', message: 'Lead not found in database.' };
    }

    // 💥 ASSERTION FIX: Assert to the CanonicalLeadType.
    // This resolves the error about missing 'contacts', 'enrichments', etc.
    const lead = leadResult as CanonicalLeadType;

    // 2. Security Check: Ensure the user owns the lead (Authorization)
    if (lead.owner !== ownerId) {
      console.error(
        `❌ SECURITY ERROR: User ${ownerId} tried to sync lead owned by ${lead.owner}.`
      );
      return { status: 'ERROR', message: 'Authorization denied.' };
    }

    // 3. Execute the GHL sync and update DB status
    const syncResult = await processGhlSync(lead);

    // 4. Return status to AppSync
    return {
      ...syncResult,
      leadId: leadId,
      ghlContactId:
        syncResult.status === 'SUCCESS'
          ? syncResult.message.split(': ')[1]
          : lead.ghlContactId || null,
    };
  } catch (error: any) {
    console.error(
      `❌ Unhandled Error in manualGhlSync handler for ${leadId}:`,
      error.message
    );
    return {
      status: 'ERROR',
      message: `Internal server error: ${error.message}`,
    };
  }
};
