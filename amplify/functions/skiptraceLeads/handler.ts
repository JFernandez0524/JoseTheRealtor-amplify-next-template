// amplify/functions/skiptraceLeads/handler.ts

import axios, { isAxiosError } from 'axios';

// --- CRITICAL IMPORTS ---
// 1. GHL Sync: Corrected path to the dedicated GHL integration function
import { syncToGoHighLevel } from '../manualGhlSync/integrations/gohighlevel';

// 2. Data Utilities: Imports all necessary types and functions from the centralized file.
import {
  getLead,
  updateLead,
  updateLeadGhlStatus,
  DBLead,
  UpdateLeadInput,
} from '../../../app/utils/aws/data/lead.server';

// --- Configuration & Retry Constants ---
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // Starting delay in milliseconds (1s)

// --- Environment Variables ---
const BATCH_DATA_SERVER_TOKEN = process.env.BATCH_DATA_SERVER_TOKEN;
const GHL_API_KEY = process.env.GHL_API_KEY;

// ---------------------------------------------------------
// 💥 FIX: LOCAL DEFINITION OF FULL STATUS UNION (FOR TYPE SAFETY ONLY)
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

type SkipTraceMutationArguments = {
  leadIds: string[];
};

type AppSyncHandlerEvent = {
  arguments: SkipTraceMutationArguments;
  identity: {
    sub: string;
  } | null;
  typeName: string;
  fieldName: string;
  source: any;
};

// ---------------------------------------------------------
// HELPER: BatchData API Call (WITH RETRY LOGIC)
// ---------------------------------------------------------

function cleanName(name: any) {
  const cleaned: any = {};
  if (name.first) cleaned.first = name.first;
  if (name.last) cleaned.last = name.last;
  return cleaned;
}

/**
 * Calls the BatchData V1 Property Skip Trace API with exponential backoff for retries.
 */
async function callBatchDataV3(lead: DBLead): Promise<BatchDataResult> {
  // ... (callBatchDataV3 content unchanged) ...
  if (!BATCH_DATA_SERVER_TOKEN) throw new Error('Missing BatchData API Key');

  let targetName = { first: lead.ownerFirstName, last: lead.ownerLastName };
  let targetAddress = {
    street: lead.ownerAddress ? lead.ownerAddress.trim() : '',
    city: lead.ownerCity ? lead.ownerCity.trim() : '',
    state: lead.ownerState ? lead.ownerState.trim().toUpperCase() : '',
    zip: lead.ownerZip ? lead.ownerZip.trim() : '',
  };

  if (lead.type?.toUpperCase() === 'PROBATE') {
    console.log(`⚰️ Probate Lead: Skip tracing Admin or Mailing Address`);
    targetName = { first: lead.adminFirstName, last: lead.adminLastName };
    if (lead.mailingAddress) {
      targetAddress = {
        street: lead.mailingAddress,
        city: lead.mailingCity!,
        state: lead.mailingState!,
        zip: lead.mailingZip!,
      };
    } else if (lead.adminAddress) {
      targetAddress = {
        street: lead.adminAddress,
        city: lead.adminCity!,
        state: lead.adminState!,
        zip: lead.adminZip!,
      };
    }
  }

  const cleanedName = cleanName(targetName);
  const singleRequestObject: any = {
    requestId: lead.id,
    ...(Object.keys(cleanedName).length > 0 && { name: cleanedName }),
    propertyAddress: targetAddress,
    options: {
      prioritizeMobilePhones: true,
      includeTCPABlacklistedPhones: false,
    },
  };
  const finalBatchPayload = { requests: [singleRequestObject] };

  console.log(
    '📤 Sending BatchData Payload:',
    JSON.stringify(finalBatchPayload)
  );

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await axios.post(
        'https://api.batchdata.com/api/v1/property/skip-trace',
        finalBatchPayload,
        {
          headers: {
            Authorization: `Bearer ${BATCH_DATA_SERVER_TOKEN}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      const resultsObject = res.data?.results;

      if (
        !resultsObject ||
        !resultsObject.persons ||
        resultsObject.persons.length === 0
      ) {
        console.warn(
          '⚠️ API returned HTTP 200, but no matching person found in results. Full response:',
          JSON.stringify(res.data)
        );
        return {
          status: 'NO_MATCH',
          foundPhones: [],
          foundEmails: [],
          mailingData: null,
        };
      } // --- Data Extraction Logic (The working part of the code) ---

      const person = resultsObject.persons[0];
      const foundPhones: string[] = [];
      const foundEmails: string[] = [];
      let mailingData: MailingAddressData | null = null;

      if (person.mailingAddress && person.mailingAddress.street) {
        const mailAddress = person.mailingAddress;
        mailingData = {
          mailingAddress: mailAddress.street,
          mailingCity: mailAddress.city,
          mailingState: mailAddress.state,
          mailingZip: mailAddress.zip,
        };
        console.log(`📬 Found mailing address: ${mailAddress.street}`);
      }
      if (person.phoneNumbers) {
        person.phoneNumbers.forEach((p: any) => {
          const score = parseFloat(p.score) || 0;
          if (
            p.type === 'Mobile' &&
            score >= 90 &&
            p.dnc !== true &&
            p.number
          ) {
            foundPhones.push(p.number);
          }
        });
        console.log(`📞 Found ${foundPhones.length} valid phone(s)`);
      }
      if (person.emails) {
        person.emails.forEach((e: any) => {
          if (e.tested === true && e.email) {
            foundEmails.push(e.email);
          }
        });
        console.log(`📧 Found ${foundEmails.length} valid email(s)`);
      }

      return { status: 'SUCCESS', foundPhones, foundEmails, mailingData };
    } catch (error: any) {
      if (isAxiosError(error) && error.response) {
        const status = error.response.status; // 💥 RATE LIMIT RETRY LOGIC (HTTP 429)

        if (status === 429 && attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
          console.warn(
            `⚠️ Rate limit (429) hit. Retrying in ${delay / 1000}s... (Attempt ${attempt + 1}/${MAX_RETRIES})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        } // --- Standard Error Handling (Non-retryable or final attempt) ---

        let detail = 'No error body available.';
        if (error.response.data) {
          try {
            if (error.response.data.status && error.response.data.message) {
              detail = `[${error.response.data.status}]: ${error.response.data.message}`;
            } else {
              detail = JSON.stringify(error.response.data);
            }
          } catch (e) {
            detail = String(error.response.data);
          }
        }

        const errorMessage = `API Error (HTTP ${status}): ${detail}`;

        if (status === 401) {
          console.error(
            '❌ AUTHENTICATION FAILED (HTTP 401). Check BATCH_DATA_SERVER_TOKEN.'
          );
        }

        console.error('❌ BatchData V1 API Error:', errorMessage);

        return {
          status: 'ERROR',
          foundPhones: [],
          foundEmails: [],
          mailingData: null,
        };
      } // Handle non-Axios (network) errors

      const errorMessage = `Network/System Error: ${error.message}`;
      console.error('❌ BatchData V1 API Error:', errorMessage);
      return {
        status: 'ERROR',
        foundPhones: [],
        foundEmails: [],
        mailingData: null,
      };
    }
  } // This line is a fallback if the loop finishes without a successful return

  return {
    status: 'ERROR',
    foundPhones: [],
    foundEmails: [],
    mailingData: null,
  };
}

// ---------------------------------------------------------
// HELPER: Process GHL Sync and Status Update (Decoupled Logic)
// ---------------------------------------------------------

async function processGhlSync(lead: DBLead) {
  if (!GHL_API_KEY) {
    console.warn(`⚠️ GHL Sync Skipped: GHL_API_KEY is missing.`);
    await updateLeadGhlStatus(lead.id, 'SKIPPED');
    return;
  } // This function is only called if skipTraceStatus is 'COMPLETED'
  // But we still update the GHL status to PENDING before the call.
  await updateLeadGhlStatus(lead.id, 'PENDING');

  console.log(`🔄 Attempting GHL sync for lead ${lead.id}...`);

  try {
    const ghlContactId = await syncToGoHighLevel(lead);

    await updateLeadGhlStatus(lead.id, 'SUCCESS', ghlContactId);
    console.log(
      `✅ Successfully synced lead ${lead.id} to GHL. Contact ID: ${ghlContactId}`
    );
  } catch (error: any) {
    console.error(`❌ GHL Sync Error for lead ${lead.id}:`, error.message);
    await updateLeadGhlStatus(lead.id, 'FAILED');
  }
}

// ---------------------------------------------------------
// HELPER: Update Status (Refactored to use centralized updateLead)
// ---------------------------------------------------------

/**
 * Updates the core skipTraceStatus field using the centralized updateLead utility.
 */
async function updateLeadStatus(
  id: string,
  status: FullSkipTraceStatus // Using the full type
) {
  const updateData: UpdateLeadInput = {
    id: id, // 💥 CRITICAL FIX: Cast the status to the narrow type expected by UpdateLeadInput
    // because the compiler is rejecting the assignment of the broader FullSkipTraceStatus.
    skipTraceStatus: status as any,
  };

  try {
    // Using the imported centralized updateLead function
    await updateLead(updateData);
    console.log(`✅ Updated skipTraceStatus to ${status} for lead: ${id}`);
  } catch (error: any) {
    // Log, but do not fail the main loop
    console.error(
      `⚠️ Failed to update skipTraceStatus for ${id} using utility:`,
      error.message
    );
  }
}

// ---------------------------------------------------------
// Main Handler (Uses centralized functions)
// ---------------------------------------------------------

export const handler = async (event: AppSyncHandlerEvent) => {
  console.log('--- START ARGUMENT EXTRACTION ---');
  console.log('RAW EVENT RECEIVED:', JSON.stringify(event));

  const { leadIds } = event.arguments;
  const ownerId = event.identity?.sub;

  if (!ownerId) {
    console.error('❌ ERROR: User identity (ownerId) is missing.');
    return [];
  }
  console.log('Extracted ownerId:', ownerId);

  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    console.error('❌ ERROR: Lead IDs array is empty or invalid.');
    return [];
  }

  console.log(`🕵️‍♂️ Starting V1 Skip Trace for ${leadIds.length} leads...`);

  const results = [];

  for (const leadId of leadIds) {
    try {
      console.log(`\n🔄 Processing lead: ${leadId}`); // --- 1. Fetch Lead (Using centralized utility) ---

      const lead = await getLead(leadId);

      if (!lead) {
        console.log(`⚠️ Lead not found: ${leadId}`);
        await updateLeadStatus(leadId, 'NOT_FOUND' as FullSkipTraceStatus); // 💥 Cast literal status
        results.push({
          id: leadId,
          status: 'NOT_FOUND',
          error: 'Lead does not exist in database',
        });
        continue;
      }

      if (lead.owner !== ownerId) {
        console.error(
          `❌ SECURITY ERROR: User ${ownerId} tried to access lead owned by ${lead.owner}. Skipping.`
        );
        await updateLeadStatus(leadId, 'NOT_AUTHORIZED' as FullSkipTraceStatus); // 💥 Cast literal status
        results.push({
          id: leadId,
          status: 'NOT_AUTHORIZED',
          error: 'Lead access denied',
        });
        continue;
      }

      console.log(`✅ Lead retrieved and verified: ${lead.id}`);

      if (!lead.ownerAddress) {
        console.log(`⚠️ Lead missing required ownerAddress: ${leadId}`);
        await updateLeadStatus(leadId, 'INVALID_DATA' as FullSkipTraceStatus); // 💥 Cast literal status
        results.push({
          id: leadId,
          status: 'INVALID_DATA',
          error: 'Lead missing required address data',
        });
        continue;
      } // --- 2. Skip Trace (with Retry Logic) ---

      console.log(`🔍 Calling BatchData API for lead: ${leadId}`);
      const enrichedData = await callBatchDataV3(lead);

      if (
        enrichedData.status === 'NO_MATCH' ||
        enrichedData.status === 'INVALID_GEO' ||
        enrichedData.status === 'ERROR'
      ) {
        console.log(
          `⚠️ BatchData returned ${enrichedData.status} for lead: ${leadId}`
        );
        const finalStatus =
          enrichedData.status === 'ERROR'
            ? ('FAILED' as FullSkipTraceStatus)
            : ('NO_MATCH' as FullSkipTraceStatus); // 💥 Cast literal status
        await updateLeadStatus(leadId, finalStatus);
        results.push({ id: leadId, status: finalStatus });
        continue;
      } // --- 3. Data Preparation ---

      const newPhones = [
        ...new Set([...(lead.phones || []), ...enrichedData.foundPhones]),
      ];
      const newEmails = [
        ...new Set([...(lead.emails || []), ...enrichedData.foundEmails]),
      ];

      const finalMailingAddress =
        enrichedData.mailingData?.mailingAddress ||
        lead.mailingAddress ||
        lead.ownerAddress;
      const finalMailingCity =
        enrichedData.mailingData?.mailingCity ||
        lead.mailingCity ||
        lead.ownerCity;
      const finalMailingState =
        enrichedData.mailingData?.mailingState ||
        lead.mailingState ||
        lead.ownerState;
      const finalMailingZip =
        enrichedData.mailingData?.mailingZip ||
        lead.mailingZip ||
        lead.ownerZip;

      let isAbsentee = lead.isAbsenteeOwner;
      if (
        lead.type !== 'PROBATE' &&
        finalMailingAddress &&
        finalMailingAddress !== lead.ownerAddress
      ) {
        isAbsentee = true;
      } // Create the final data object for the update

      const updateData: UpdateLeadInput = {
        id: leadId,
        phones: newPhones,
        emails: newEmails,
        mailingAddress: finalMailingAddress,
        mailingCity: finalMailingCity,
        mailingState: finalMailingState,
        mailingZip: finalMailingZip,
        isAbsenteeOwner: isAbsentee ?? false,
        skipTraceStatus: 'COMPLETED' as any, // 💥 Cast final status here
      }; // --- 4. Save Skip Trace Data to DynamoDB (Using centralized utility) ---

      console.log(`💾 Updating lead in DynamoDB: ${leadId}`); // NOTE: We rely on the updateLead function to ensure the correct type handling.
      const updatedLead = await updateLead(updateData);
      console.log(`✅ Successfully updated lead: ${leadId}`); // --- 5. CRM Sync (Decoupled and Status-Tracked) ---
      // We pass the fully updated lead (which now includes the completed status)
      await processGhlSync(updatedLead);

      results.push({
        id: leadId,
        status: 'SUCCESS',
        phones: newPhones.length,
        emails: newEmails.length,
      });
    } catch (error: any) {
      console.error(`❌ Error processing lead ${leadId}:`, error);
      console.error('Error stack:', error.stack);
      await updateLeadStatus(leadId, 'FAILED' as FullSkipTraceStatus); // 💥 Cast literal status
      results.push({ id: leadId, status: 'ERROR', error: error.message });
    }
  }

  console.log(`📊 Final results: ${JSON.stringify(results)}`);
  return results;
};
