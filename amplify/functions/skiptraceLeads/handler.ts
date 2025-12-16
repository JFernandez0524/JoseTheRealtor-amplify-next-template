import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import axios from 'axios';
import { isAxiosError } from 'axios';

// --- UPDATED IMPORT PATH ---
// Assuming the gohighlevel.ts file has been moved into the current function's directory,
// it should be accessible from a local relative path.
import { syncToGoHighLevel } from './src/integrations/gohighlevel'; // Adjusted relative path

// --- AWS DynamoDB Setup ---
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: {
    // Critical for removing undefined fields before updating DynamoDB
    removeUndefinedValues: true,
  },
});

// Assuming TABLE_NAME and BATCH_DATA_SERVER_TOKEN are correctly set via environment variables.
const TABLE_NAME = process.env.AMPLIFY_DATA_LEAD_TABLE_NAME;
const BATCH_DATA_SERVER_TOKEN = process.env.BATCH_DATA_SERVER_TOKEN;
const GHL_API_KEY = process.env.GHL_API_KEY; // Assuming GHL key is now in env vars

// ---------------------------------------------------------
// Type Definitions (Unchanged)
// ---------------------------------------------------------
type DBLead = {
  id: string;
  owner: string;
  type: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerAddress: string;
  ownerCity: string;
  ownerState: string;
  ownerZip: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminAddress?: string;
  adminCity?: string;
  adminState?: string;
  adminZip?: string;
  mailingAddress?: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
  mailingZip?: string | null;
  isAbsenteeOwner?: boolean;
  phones?: string[];
  emails?: string[];
  skipTraceStatus?: string;
  updatedAt?: string;
};

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
// HELPER: BatchData API Call (Unchanged)
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

  const finalBatchPayload = {
    requests: [singleRequestObject],
  };

  console.log(
    '📤 Sending BatchData Payload:',
    JSON.stringify(finalBatchPayload)
  );

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
    }

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
        if (p.type === 'Mobile' && score >= 90 && p.dnc !== true && p.number) {
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

    return {
      status: 'SUCCESS',
      foundPhones,
      foundEmails,
      mailingData,
    };
  } catch (error: any) {
    let errorMessage = 'Unknown Request Failure.';

    if (isAxiosError(error) && error.response) {
      const status = error.response.status;
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

      errorMessage = `API Error (HTTP ${status}): ${detail}`;

      if (status === 401) {
        console.error(
          '❌ AUTHENTICATION FAILED (HTTP 401). Check BATCH_DATA_SERVER_TOKEN.'
        );
      }
    } else if (error.message) {
      errorMessage = `Network/System Error: ${error.message}`;
    }

    console.error('❌ BatchData V1 API Error:', errorMessage);

    return {
      status: 'ERROR',
      foundPhones: [],
      foundEmails: [],
      mailingData: null,
    };
  }
}

// ---------------------------------------------------------
// HELPER: GHL Sync Handler (Unchanged logic, uses new import)
// ---------------------------------------------------------

/**
 * Handles the GoHighLevel sync after lead enrichment.
 * Logs a clear warning if the GHL_API_KEY is missing.
 * @param lead The enriched DBLead object.
 */
async function handleGHLSync(lead: DBLead) {
  if (!GHL_API_KEY) {
    console.warn(
      `⚠️ GHL Sync Skipped: GHL_API_KEY is missing from environment variables.`
    );
    return;
  }

  console.log(`🔄 Syncing lead ${lead.id} to GoHighLevel...`);
  try {
    // The imported syncToGoHighLevel function is called here
    await syncToGoHighLevel(lead);
    console.log(`✅ Successfully synced lead ${lead.id} to GHL.`);
  } catch (error: any) {
    console.error(`❌ GHL Sync Error for lead ${lead.id}:`, error.message);
    // Do not re-throw, allow the main handler to continue
  }
}

// ---------------------------------------------------------
// HELPER: Update Status (Unchanged)
// ---------------------------------------------------------
async function updateLeadStatus(id: string, status: string) {
  const primaryKey = { id };

  try {
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: primaryKey,
        UpdateExpression: 'SET skipTraceStatus = :s, updatedAt = :u',
        ExpressionAttributeValues: {
          ':s': status,
          ':u': new Date().toISOString(),
        },
      })
    );
    console.log(`✅ Updated status to ${status} for lead: ${id}`);
  } catch (error: any) {
    console.error(`⚠️ Failed to update status for ${id}:`, error.message);
  }
}

// ---------------------------------------------------------
// Main Handler (Unchanged)
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
      console.log(`\n🔄 Processing lead: ${leadId}`);

      const primaryKey = { id: leadId };

      const getRes = await ddbDocClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: primaryKey,
        })
      );

      const lead = getRes.Item as DBLead;

      if (!lead) {
        console.log(`⚠️ Lead not found: ${leadId}`);
        await updateLeadStatus(leadId, 'NOT_FOUND');
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
        await updateLeadStatus(leadId, 'FAILED');
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
        await updateLeadStatus(leadId, 'INVALID_DATA');
        results.push({
          id: leadId,
          status: 'INVALID_DATA',
          error: 'Lead missing required address data',
        });
        continue;
      }

      // --- 1. Skip Trace ---
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
          enrichedData.status === 'ERROR' ? 'FAILED' : 'NO_MATCH';
        await updateLeadStatus(leadId, finalStatus);
        results.push({ id: leadId, status: finalStatus });
        continue;
      }

      // --- 2. Data Preparation ---
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
      }

      const updatedLead = {
        ...lead,
        phones: newPhones,
        emails: newEmails,
        mailingAddress: finalMailingAddress,
        mailingCity: finalMailingCity,
        mailingState: finalMailingState,
        mailingZip: finalMailingZip,
        isAbsenteeOwner: isAbsentee ?? false,
        skipTraceStatus: 'COMPLETED',
        updatedAt: new Date().toISOString(),
      };

      // --- 3. Save to DynamoDB ---
      console.log(`💾 Updating lead in DynamoDB: ${leadId}`);
      await ddbDocClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: primaryKey,
          UpdateExpression: `SET
              phones = :p,
              emails = :e,
              skipTraceStatus = :s,
              mailingAddress = :ma,
              mailingCity = :mc,
              mailingState = :ms,
              mailingZip = :mz,
              isAbsenteeOwner = :iao,
              updatedAt = :u`,
          ExpressionAttributeValues: {
            ':p': updatedLead.phones,
            ':e': updatedLead.emails,
            ':s': 'COMPLETED',
            ':ma': updatedLead.mailingAddress,
            ':mc': updatedLead.mailingCity,
            ':ms': updatedLead.mailingState,
            ':mz': updatedLead.mailingZip,
            ':iao': updatedLead.isAbsenteeOwner,
            ':u': updatedLead.updatedAt,
          },
        })
      );
      console.log(`✅ Successfully updated lead: ${leadId}`);

      // --- 4. CRM Sync ---
      await handleGHLSync(updatedLead);

      results.push({
        id: leadId,
        status: 'SUCCESS',
        phones: newPhones.length,
        emails: newEmails.length,
      });
    } catch (error: any) {
      console.error(`❌ Error processing lead ${leadId}:`, error);
      console.error('Error stack:', error.stack);
      results.push({ id: leadId, status: 'ERROR', error: error.message });
      await updateLeadStatus(leadId, 'FAILED');
    }
  }

  console.log(`📊 Final results: ${JSON.stringify(results)}`);
  return results;
};
