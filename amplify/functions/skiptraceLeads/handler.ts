import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

// Import Sync functions
import { syncToGoHighLevel } from '../../functions/uploadCsvHandler/src/intergrations/gohighlevel';

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const TABLE_NAME = process.env.AMPLIFY_DATA_LEAD_TABLE_NAME;

const BATCH_DATA_SERVER_TOKEN = process.env.BATCH_DATA_SERVER_TOKEN;

// ---------------------------------------------------------
// Type Definitions
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
  status: string;
  foundPhones: string[];
  foundEmails: string[];
  mailingData?: MailingAddressData | null;
};

type SkipTraceMutationArguments = {
  leadIds: string[];
  targetCrm: 'GHL' | 'KVCORE' | 'NONE';
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
// Main Handler - CORRECT KEY: Just { id } (simple partition key)
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
  console.log(`📊 Table Name: ${TABLE_NAME}`);
  console.log(`📊 AWS Region: ${process.env.AWS_REGION || 'not set'}`);

  const results = [];

  for (const leadId of leadIds) {
    try {
      console.log(`\n🔄 Processing lead: ${leadId}`);

      // ✅ CONFIRMED: Table uses simple partition key with just 'id'
      const primaryKey = { id: leadId };

      console.log('🔑 Using key:', JSON.stringify(primaryKey));
      console.log(`📋 About to call DynamoDB GetCommand...`);

      const startTime = Date.now();

      const getRes = await ddbDocClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: primaryKey,
        })
      );

      const duration = Date.now() - startTime;
      console.log(`✅ GetCommand completed in ${duration}ms`);
      console.log(`📦 Response:`, JSON.stringify(getRes));

      const lead = getRes.Item as DBLead;

      if (!lead) {
        console.log(`⚠️ Lead not found: ${leadId}`);
        results.push({
          id: leadId,
          status: 'NOT_FOUND',
          error: 'Lead does not exist in database',
        });
        continue;
      }

      // Verify owner matches for security
      if (lead.owner !== ownerId) {
        console.log(`⚠️ Lead ${leadId} belongs to different owner. Skipping.`);
        results.push({
          id: leadId,
          status: 'NOT_AUTHORIZED',
          error: 'Lead does not belong to this user',
        });
        continue;
      }

      console.log(`✅ Lead retrieved and verified: ${lead.id}`);

      if (!lead.ownerAddress) {
        console.log(`⚠️ Lead missing required ownerAddress: ${leadId}`);
        results.push({
          id: leadId,
          status: 'INVALID_DATA',
          error: 'Lead missing required address data',
        });
        continue;
      }

      // Call BatchData API
      console.log(`🔍 Calling BatchData API for lead: ${leadId}`);
      const enrichedData = await callBatchDataV3(lead);

      // Handle Failures
      if (
        enrichedData.status === 'NO_MATCH' ||
        enrichedData.status === 'INVALID_GEO' ||
        enrichedData.status === 'ERROR'
      ) {
        console.log(
          `⚠️ BatchData returned ${enrichedData.status} for lead: ${leadId}`
        );
        await updateLeadStatus(leadId, 'NO_MATCH');
        results.push({ id: leadId, status: 'NO_MATCH' });
        continue;
      }

      // Prepare Update Data
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
        enrichedData.mailingData?.mailingAddress &&
        enrichedData.mailingData.mailingAddress !== lead.ownerAddress
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

      // Save to DynamoDB
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

      // CRM Sync
      console.log(`🔄 Syncing to GoHighLevel: ${leadId}`);
      await syncToGoHighLevel(updatedLead);

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

// ---------------------------------------------------------
// HELPER: BatchData API Call
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
    console.log(`⚰️ Probate Lead: Skip tracing Admin`);
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

  const payload = {
    requestId: lead.id,
    name: cleanedName,
    propertyAddress: targetAddress,
    options: {
      prioritizeMobilePhones: true,
      includeTCPABlacklistedPhones: false,
    },
  };

  console.log('📤 Sending BatchData Payload:', JSON.stringify(payload));

  try {
    const res = await axios.post(
      'https://api.batchdata.com/api/v1/property/skip-trace',
      payload,
      {
        headers: {
          Authorization: `Bearer ${BATCH_DATA_SERVER_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    const resultContainer = res.data?.results;
    if (!resultContainer) {
      throw new Error('Unexpected response format');
    }
    const person = resultContainer?.persons?.[0];

    if (!person || resultContainer?.meta?.matched === false) {
      console.log('⚠️ BatchData: No person match found');
      return {
        status: 'NO_MATCH',
        foundPhones: [],
        foundEmails: [],
        mailingData: null,
      };
    }

    const foundPhones: string[] = [];
    const foundEmails: string[] = [];
    let mailingData: MailingAddressData | null = null;

    if (person.mailingAddress) {
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
    console.error('❌ BatchData V1 API Error:', error.message);
    return {
      status: 'ERROR',
      foundPhones: [],
      foundEmails: [],
      mailingData: null,
    };
  }
}

// ---------------------------------------------------------
// HELPER: Update Status
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
