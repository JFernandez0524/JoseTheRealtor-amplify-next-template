// amplify/functions/skiptraceLeads/handler.ts

import axios, { isAxiosError } from 'axios';
import { syncToGoHighLevel } from '../manualGhlSync/integrations/gohighlevel';
import {
  getLead,
  updateLead,
  updateLeadGhlStatus,
  DBLead,
  UpdateLeadInput,
} from '../../../app/utils/aws/data/lead.server';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const BATCH_DATA_SERVER_TOKEN = process.env.BATCH_DATA_SERVER_TOKEN;
const GHL_API_KEY = process.env.GHL_API_KEY;

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
  identity: { sub: string } | null;
};

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
// 🎯 FIXED: processGhlSync to handle 1 Phone = 1 Contact
// ---------------------------------------------------------
async function processGhlSync(lead: DBLead) {
  if (!GHL_API_KEY) {
    await updateLeadGhlStatus(lead.id, 'SKIPPED');
    return;
  }

  await updateLeadGhlStatus(lead.id, 'PENDING');
  const phones = lead.phones || [];

  try {
    const syncResults: string[] = [];

    // 🎯 Loop through found phones and sync each as a unique contact
    for (let i = 0; i < phones.length; i++) {
      const currentPhone = phones[i];
      if (!currentPhone) continue;

      const isPrimary = i === 0;
      const ghlContactId = await syncToGoHighLevel(
        lead,
        currentPhone,
        i + 1,
        isPrimary
      );
      syncResults.push(ghlContactId);
    }

    await updateLeadGhlStatus(lead.id, 'SUCCESS', syncResults[0]);
  } catch (error: any) {
    console.error(`❌ GHL Sync Error for lead ${lead.id}:`, error.message);
    await updateLeadGhlStatus(lead.id, 'FAILED');
  }
}

async function updateLeadStatus(id: string, status: FullSkipTraceStatus) {
  const updateData: any = { id, skipTraceStatus: status };
  try {
    await updateLead(updateData);
  } catch (error: any) {
    console.error(`⚠️ Failed to update status for ${id}:`, error.message);
  }
}

export const handler = async (event: AppSyncHandlerEvent) => {
  const { leadIds } = event.arguments;
  const ownerId = event.identity?.sub;

  if (!ownerId || !leadIds?.length) return [];

  const results = [];
  for (const leadId of leadIds) {
    try {
      const lead = await getLead(leadId);
      if (!lead || lead.owner !== ownerId) {
        results.push({ id: leadId, status: 'ERROR' });
        continue;
      }

      const enrichedData = await callBatchDataV3(lead);

      if (enrichedData.status !== 'SUCCESS') {
        const finalStatus =
          enrichedData.status === 'ERROR' ? 'FAILED' : 'NO_MATCH';
        await updateLeadStatus(leadId, finalStatus as FullSkipTraceStatus);
        results.push({ id: leadId, status: finalStatus });
        continue;
      }

      const newPhones = [
        ...new Set([...(lead.phones || []), ...enrichedData.foundPhones]),
      ];
      const newEmails = [
        ...new Set([...(lead.emails || []), ...enrichedData.foundEmails]),
      ];

      const updateData: any = {
        id: leadId,
        phones: newPhones,
        emails: newEmails,
        mailingAddress:
          enrichedData.mailingData?.mailingAddress ||
          lead.mailingAddress ||
          lead.ownerAddress,
        mailingCity:
          enrichedData.mailingData?.mailingCity ||
          lead.mailingCity ||
          lead.ownerCity,
        mailingState:
          enrichedData.mailingData?.mailingState ||
          lead.mailingState ||
          lead.ownerState,
        mailingZip:
          enrichedData.mailingData?.mailingZip ||
          lead.mailingZip ||
          lead.ownerZip,
        skipTraceStatus: 'COMPLETED',
      };

      const updatedLead = await updateLead(updateData);

      // 🎯 Trigger the multi-contact sync logic
      await processGhlSync(updatedLead);

      results.push({ id: leadId, status: 'SUCCESS', phones: newPhones.length });
    } catch (error: any) {
      await updateLeadStatus(leadId, 'FAILED');
      results.push({ id: leadId, status: 'ERROR' });
    }
  }
  return results;
};
