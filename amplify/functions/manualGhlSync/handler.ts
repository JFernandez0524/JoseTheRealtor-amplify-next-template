import { Amplify } from 'aws-amplify';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { generateClient } from 'aws-amplify/data';
import { env } from '$amplify/env/manualGhlSync';
import type { Schema } from '../../data/resource';
import { syncToGoHighLevel } from './integrations/gohighlevel';

/**
 * 🚀 INITIALIZE AMPLIFY CLIENT
 */
const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(
  env as any
);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const GHL_API_KEY = process.env.GHL_API_KEY;

type SyncResult = {
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED' | 'ERROR' | 'NO_CHANGE';
  message: string;
  ghlContactId?: string | null;
};

type Handler = Schema['manualGhlSync']['functionHandler'];

// ---------------------------------------------------------
// HELPER: Core GHL Sync Logic
// ---------------------------------------------------------
async function processGhlSync(lead: any): Promise<SyncResult> {
  if (!GHL_API_KEY) {
    const message = `GHL_API_KEY is missing. Check Amplify secrets.`;
    await client.models.PropertyLead.update({
      id: lead.id,
      ghlSyncStatus: 'FAILED',
    });
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
      const ghlContactId = await syncToGoHighLevel(
        lead,
        phones[i],
        i + 1,
        i === 0
      );
      syncResults.push(ghlContactId);
    }

    const primaryGhlId = syncResults[0];
    await client.models.PropertyLead.update({
      id: lead.id,
      ghlSyncStatus: 'SUCCESS',
      ghlContactId: primaryGhlId,
      ghlSyncDate: new Date().toISOString(),
    });

    return {
      status: 'SUCCESS',
      message: `Synced ${phones.length} contacts.`,
      ghlContactId: primaryGhlId,
    };
  } catch (error: any) {
    await client.models.PropertyLead.update({
      id: lead.id,
      ghlSyncStatus: 'FAILED',
    });
    return { status: 'FAILED', message: error.message };
  }
}

// ---------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------
export const handler: Handler = async (event) => {
  const { leadId } = event.arguments;
  const identity = event.identity;

  let ownerId: string | undefined;
  let groups: string[] = [];

  // 🛡️ 1. Extract Identity FIRST (Fixes the logic error)
  if (identity && 'sub' in identity) {
    ownerId = identity.sub;
    groups = (identity as any).claims?.['cognito:groups'] || [];
  }

  // 🛡️ 2. Identity Guard
  if (!ownerId) {
    return {
      status: 'ERROR',
      message: 'User identity missing or not authenticated via Cognito.',
      leadId: leadId || 'unknown',
    };
  }

  // 🛡️ 3. Tier Authorization Check
  const isAuthorized = groups.some((g: string) =>
    ['PRO', 'AI_PLAN', 'ADMINS'].includes(g)
  );

  if (!isAuthorized) {
    return {
      status: 'ERROR',
      message: 'Unauthorized: Subscription required for CRM sync.',
      leadId: leadId,
    };
  }

  try {
    // 🛡️ 4. Ownership Verification
    const { data: lead } = await client.models.PropertyLead.get({ id: leadId });

    if (!lead || lead.owner !== ownerId) {
      return { status: 'ERROR', message: 'Authorization denied.', leadId };
    }

    // 🚀 5. Execute Logic
    const syncResult = await processGhlSync(lead);

    // 📊 6. Track usage
    if (syncResult.status === 'SUCCESS') {
      try {
        const { data: accounts } = await client.models.UserAccount.list({
          filter: { owner: { eq: ownerId } },
        });

        if (accounts && accounts[0]) {
          await client.models.UserAccount.update({
            id: accounts[0].id,
            totalLeadsSynced: (accounts[0].totalLeadsSynced || 0) + 1,
          });
        }
      } catch (err) {
        console.error('📊 Stats update failed (non-critical):', err);
      }
    }

    return { ...syncResult, leadId: leadId };
  } catch (error: any) {
    console.error('🔥 Critical Handler Error:', error);
    return {
      status: 'ERROR',
      message: `Internal server error: ${error.message}`,
      leadId: leadId || 'unknown',
    };
  }
};
