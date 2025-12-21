// amplify/functions/skiptraceLeads/handler.ts

import axios, { isAxiosError } from 'axios';
import {
  getLead,
  updateLead,
  DBLead,
} from '../../../app/utils/aws/data/lead.server';
import { cookiesClient } from '../../../app/utils/aws/auth/amplifyServerUtils.server';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const BATCH_DATA_SERVER_TOKEN = process.env.BATCH_DATA_SERVER_TOKEN;

// ---------------------------------------------------------
// Type Definitions (Preserved)
// ---------------------------------------------------------

type FullSkipTraceStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'NO_MATCH'
  | 'NOT_FOUND'
  | 'NOT_AUTHORIZED'
  | 'INVALID_DATA'
  | 'ERROR';

type MailingAddressData = {
  mailingAddress?: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
  mailingZip?: string | null;
};

type BatchDataResult = {
  status: 'SUCCESS' | 'NO_MATCH' | 'INVALID_GEO' | 'ERROR';
  foundPhones: string[];
  foundEmails: string[];
  mailingData?: MailingAddressData | null;
};

type SkipTraceMutationArguments = { leadIds: string[] };
type AppSyncHandlerEvent = {
  arguments: SkipTraceMutationArguments;
  identity: {
    sub: string;
    claims: { [key: string]: any };
  } | null;
};

// ---------------------------------------------------------
// Helper Functions (Preserved & Working)
// ---------------------------------------------------------

function cleanName(name: any) {
  const cleaned: any = {};
  if (name.first) cleaned.first = name.first;
  if (name.last) cleaned.last = name.last;
  return cleaned;
}

async function callBatchDataV3(lead: DBLead): Promise<BatchDataResult> {
  if (!BATCH_DATA_SERVER_TOKEN) throw new Error('Missing BatchData API Key');

  let targetName = { first: lead.ownerFirstName, last: lead.ownerLastName };
  let targetAddress = {
    street: lead.ownerAddress?.trim() || '',
    city: lead.ownerCity?.trim() || '',
    state: lead.ownerState?.trim().toUpperCase() || '',
    zip: lead.ownerZip?.trim() || '',
  };

  if (lead.type?.toUpperCase() === 'PROBATE') {
    targetName = { first: lead.adminFirstName, last: lead.adminLastName };
    if (lead.mailingAddress) {
      targetAddress = {
        street: lead.mailingAddress,
        city: lead.mailingCity!,
        state: lead.mailingState!,
        zip: lead.mailingZip!,
      };
    }
  }

  const cleanedName = cleanName(targetName);
  const finalBatchPayload = {
    requests: [
      {
        requestId: lead.id,
        ...(Object.keys(cleanedName).length > 0 && { name: cleanedName }),
        propertyAddress: targetAddress,
        options: {
          prioritizeMobilePhones: true,
          includeTCPABlacklistedPhones: false,
        },
      },
    ],
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await axios.post(
        'https://api.batchdata.com/api/v1/property/skip-trace',
        finalBatchPayload,
        {
          headers: {
            Authorization: `Bearer ${BATCH_DATA_SERVER_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const resultsObject = res.data?.results;
      if (!resultsObject?.persons?.length)
        return {
          status: 'NO_MATCH',
          foundPhones: [],
          foundEmails: [],
          mailingData: null,
        };

      const person = resultsObject.persons[0];
      const foundPhones: string[] = [];
      const foundEmails: string[] = [];
      let mailingData = null;

      if (person.mailingAddress?.street) {
        mailingData = {
          mailingAddress: person.mailingAddress.street,
          mailingCity: person.mailingAddress.city,
          mailingState: person.mailingAddress.state,
          mailingZip: person.mailingAddress.zip,
        };
      }

      person.phoneNumbers?.forEach((p: any) => {
        if (
          p.type === 'Mobile' &&
          (parseFloat(p.score) || 0) >= 90 &&
          !p.dnc &&
          p.number
        ) {
          foundPhones.push(p.number);
        }
      });

      person.emails?.forEach((e: any) => {
        if (e.tested && e.email) foundEmails.push(e.email);
      });

      return { status: 'SUCCESS', foundPhones, foundEmails, mailingData };
    } catch (error: any) {
      if (
        isAxiosError(error) &&
        error.response?.status === 429 &&
        attempt < MAX_RETRIES - 1
      ) {
        await new Promise((r) =>
          setTimeout(r, RETRY_DELAY_MS * Math.pow(2, attempt))
        );
        continue;
      }
      console.error(`BatchData API Error: ${error.message}`);
      return {
        status: 'ERROR',
        foundPhones: [],
        foundEmails: [],
        mailingData: null,
      };
    }
  }
  return {
    status: 'ERROR',
    foundPhones: [],
    foundEmails: [],
    mailingData: null,
  };
}

// ---------------------------------------------------------
// Main Handler (Updated with Authorization & Wallet logic)
// ---------------------------------------------------------

export const handler = async (event: AppSyncHandlerEvent) => {
  const { leadIds } = event.arguments;
  const ownerId = event.identity?.sub;

  // 🛡️ 1. Identity Check
  if (!ownerId || !leadIds?.length) {
    throw new Error('Unauthorized: Missing user identity or lead data.');
  }

  // 🛡️ 2. Group Protection (Tier Check)
  const groups = event.identity?.claims?.['cognito:groups'] || [];
  const isAuthorized =
    groups.includes('PRO') ||
    groups.includes('AI_PLAN') ||
    groups.includes('ADMINS');

  if (!isAuthorized) {
    throw new Error(
      'Forbidden: A paid membership is required to use this feature.'
    );
  }

  try {
    // 💰 3. Wallet Check
    const { data: accounts } = await cookiesClient.models.UserAccount.list();
    const userAccount = accounts[0]; // Assuming one profile per owner

    if (!userAccount || (userAccount.credits || 0) < leadIds.length) {
      throw new Error(
        `Insufficient Credits: Need ${leadIds.length}, have ${userAccount?.credits || 0}.`
      );
    }

    const results = [];
    let processedSuccessfully = 0;

    for (const leadId of leadIds) {
      const lead = await getLead(leadId);

      // 🛡️ 4. Ownership Lock
      if (!lead || lead.owner !== ownerId) {
        results.push({ id: leadId, status: 'ERROR' });
        continue;
      }

      const enrichedData = await callBatchDataV3(lead);

      if (enrichedData.status !== 'SUCCESS') {
        const finalStatus =
          enrichedData.status === 'ERROR' ? 'FAILED' : 'NO_MATCH';
        await updateLead({ id: leadId, skipTraceStatus: finalStatus as any });
        results.push({ id: leadId, status: finalStatus });
        continue;
      }

      // Success Logic
      const newPhones = [
        ...new Set([...(lead.phones || []), ...enrichedData.foundPhones]),
      ];
      const newEmails = [
        ...new Set([...(lead.emails || []), ...enrichedData.foundEmails]),
      ];

      await updateLead({
        id: leadId,
        phones: newPhones,
        emails: newEmails,
        mailingAddress:
          enrichedData.mailingData?.mailingAddress || lead.ownerAddress,
        mailingCity: enrichedData.mailingData?.mailingCity || lead.ownerCity,
        mailingState: enrichedData.mailingData?.mailingState || lead.ownerState,
        mailingZip: enrichedData.mailingData?.mailingZip || lead.ownerZip,
        skipTraceStatus: 'COMPLETED',
      });

      processedSuccessfully++;
      results.push({ id: leadId, status: 'SUCCESS', phones: newPhones.length });
    }

    // 💰 5. Deduct Credits
    if (processedSuccessfully > 0) {
      await cookiesClient.models.UserAccount.update({
        id: userAccount.id,
        credits: (userAccount.credits || 0) - processedSuccessfully,
        totalSkipsPerformed:
          (userAccount.totalSkipsPerformed || 0) + processedSuccessfully,
      });
    }

    return results;
  } catch (error: any) {
    console.error('🔥 Lambda Handler Error:', error.message);
    throw error;
  }
};
