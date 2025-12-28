import axios, { isAxiosError } from 'axios';
import { Amplify } from 'aws-amplify';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { generateClient } from 'aws-amplify/data';
import { env } from '$amplify/env/skipTraceLeads';
import type { Schema } from '../../data/resource';

/**
 * 🚀 INITIALIZE AMPLIFY CLIENT
 */
const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(
  env as any
);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const BATCH_DATA_SERVER_TOKEN = process.env.BATCH_DATA_SERVER_TOKEN;

// ---------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------
type Handler = Schema['skipTraceLeads']['functionHandler'];

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

// ---------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------

function cleanName(name: { first?: string | null; last?: string | null }) {
  const cleaned: any = {};
  if (name.first) cleaned.first = name.first;
  if (name.last) cleaned.last = name.last;
  return cleaned;
}

async function callBatchDataV3(lead: any): Promise<BatchDataResult> {
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
// Main Handler
// ---------------------------------------------------------

export const handler: Handler = async (event) => {
  const { leadIds } = event.arguments;
  const identity = event.identity;

  let ownerId: string | undefined;
  let groups: string[] = [];

  // 🛡️ 1. Extract Identity Safely
  if (identity && 'sub' in identity) {
    ownerId = identity.sub;
    groups = (identity as any).claims?.['cognito:groups'] || [];
  }

  if (!ownerId || !leadIds?.length) {
    throw new Error('Unauthorized: Missing user identity or lead data.');
  }

  // 🛡️ 2. Tier Authorization Check
  const isAuthorized = groups.some((g: string) =>
    ['PRO', 'AI_PLAN', 'ADMINS'].includes(g)
  );

  if (!isAuthorized) {
    throw new Error(
      'Forbidden: A paid membership is required to use this feature.'
    );
  }

  try {
    // 💰 3. Wallet Check using .list() with Filter
    const { data: accounts } = await client.models.UserAccount.list({
      filter: { owner: { eq: ownerId } },
    });
    const userAccount = accounts[0];

    if (!userAccount || (userAccount.credits || 0) < leadIds.length) {
      throw new Error(
        `Insufficient Credits: Need ${leadIds.length}, have ${userAccount?.credits || 0}.`
      );
    }

    const results = [];
    let processedSuccessfully = 0;

    for (const leadId of leadIds) {
      if (!leadId) {
        results.push({ id: 'unknown', status: 'ERROR' });
        continue;
      }
      // 🛡️ 4. Ownership Lock & Fetch
      const { data: lead } = await client.models.PropertyLead.get({
        id: leadId,
      });

      if (!lead || (lead.owner ?? '') !== ownerId) {
        results.push({ id: leadId, status: 'ERROR' });
        continue;
      }

      const enrichedData = await callBatchDataV3(lead);

      if (enrichedData.status !== 'SUCCESS') {
        const finalStatus =
          enrichedData.status === 'ERROR' ? 'FAILED' : 'NO_MATCH';
        await client.models.PropertyLead.update({
          id: leadId,
          skipTraceStatus: finalStatus as any,
        });
        results.push({ id: leadId, status: finalStatus });
        continue;
      }

      // 5. Success Logic: Update Lead
      const newPhones = [
        ...new Set([...(lead.phones || []), ...enrichedData.foundPhones]),
      ];
      const newEmails = [
        ...new Set([...(lead.emails || []), ...enrichedData.foundEmails]),
      ];

      await client.models.PropertyLead.update({
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

    // 💰 6. Deduct Credits
    if (processedSuccessfully > 0) {
      await client.models.UserAccount.update({
        id: userAccount.id,
        credits: (userAccount.credits || 0) - processedSuccessfully,
        totalSkipsPerformed:
          (userAccount.totalSkipsPerformed || 0) + processedSuccessfully,
      });
    }

    return JSON.stringify(results); // Return as JSON string for your mutation return type
  } catch (error: any) {
    console.error('🔥 Lambda Handler Error:', error.message);
    throw error;
  }
};
