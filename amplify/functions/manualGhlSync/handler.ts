import {
  getLead,
  updateLeadGhlStatus,
  DBLead,
} from '../../../app/utils/aws/data/lead.server';
import { syncToGoHighLevel } from './integrations/gohighlevel';
import { isAxiosError } from 'axios';
// ✅ ADDED: Import for usage tracking
import { cookiesClient } from '../../../app/utils/aws/auth/amplifyServerUtils.server';

const GHL_API_KEY = process.env.GHL_API_KEY;

// ---------------------------------------------------------
// Type Definitions (Preserved)
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
    // ✅ UPDATED: Include claims for group checking
    claims?: { [key: string]: any };
  } | null;
};

// ---------------------------------------------------------
// HELPER: Core GHL Sync Logic (Preserved exactly as provided)
// ---------------------------------------------------------

async function processGhlSync(lead: DBLead): Promise<SyncResult> {
  if (!GHL_API_KEY) {
    const message = `GHL_API_KEY is missing. Check Amplify secrets.`;
    await updateLeadGhlStatus(lead.id, 'FAILED');
    return { status: 'FAILED', message };
  }

  const currentSkipStatus = lead.skipTraceStatus?.toUpperCase();
  if (currentSkipStatus !== 'COMPLETED') {
    return {
      status: 'SKIPPED',
      message: `Lead status is ${lead.skipTraceStatus}`,
    };
  }

  const phones = lead.phones || [];
  if (phones.length === 0) {
    return { status: 'FAILED', message: 'No phone numbers found.' };
  }

  try {
    const syncResults: string[] = [];

    for (let i = 0; i < phones.length; i++) {
      const rawPhone = phones[i];

      if (!rawPhone) continue;

      const currentPhone: string = rawPhone;
      const phoneIndex = i + 1;
      const isPrimary = i === 0;

      const ghlContactId = await syncToGoHighLevel(
        lead,
        currentPhone,
        phoneIndex,
        isPrimary
      );

      syncResults.push(ghlContactId);
    }

    const primaryGhlId = syncResults[0];
    await updateLeadGhlStatus(lead.id, 'SUCCESS', primaryGhlId);

    return {
      status: 'SUCCESS',
      message: `Synced ${phones.length} contacts.`,
      ghlContactId: primaryGhlId,
    };
  } catch (error: any) {
    await updateLeadGhlStatus(lead.id, 'FAILED');
    return { status: 'FAILED', message: error.message };
  }
}

// ---------------------------------------------------------
// MAIN HANDLER (Updated with Tier Check & Usage Tracking)
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

  // 🛡️ 1. NEW: Tier Authorization Check
  const groups = event.identity?.claims?.['cognito:groups'] || [];
  const isAuthorized =
    groups.includes('PRO') ||
    groups.includes('AI_PLAN') ||
    groups.includes('ADMINS');

  if (!isAuthorized) {
    return {
      status: 'ERROR',
      message: 'Unauthorized: Subscription required for CRM sync.',
      leadId: leadId,
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

    // 🛡️ 2. Ownership Verification
    if (lead.owner !== ownerId) {
      return {
        status: 'ERROR',
        message: 'Authorization denied: Ownership mismatch.',
        leadId,
      };
    }

    // 🚀 3. Execute Existing Logic
    const syncResult = await processGhlSync(lead);

    // 📊 4. NEW: Track usage in UserAccount if sync was successful
    if (syncResult.status === 'SUCCESS') {
      try {
        const { data: accounts } =
          await cookiesClient.models.UserAccount.list();
        if (accounts && accounts[0]) {
          await cookiesClient.models.UserAccount.update({
            id: accounts[0].id,
            totalLeadsSynced: (accounts[0].totalLeadsSynced || 0) + 1,
          });
        }
      } catch (err) {
        // We log usage errors but don't fail the sync for the user
        console.error('Failed to update usage stats:', err);
      }
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
