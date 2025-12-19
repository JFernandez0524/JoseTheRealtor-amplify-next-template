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

      // 🎯 Type Guard: Ensures we don't pass null to a string parameter
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

    if (lead.owner !== ownerId) {
      return { status: 'ERROR', message: 'Authorization denied.', leadId };
    }

    const syncResult = await processGhlSync(lead);

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
