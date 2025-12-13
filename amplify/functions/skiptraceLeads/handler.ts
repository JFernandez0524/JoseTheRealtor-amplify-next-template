import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

// Import Sync functions
// Verify these paths match your project structure
import { syncToGoHighLevel } from '../../functions/uploadCsvHandler/src/intergrations/gohighlevel';

const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.AMPLIFY_DATA_LEAD_TABLE_NAME;
const BATCH_DATA_SERVER_TOKEN = process.env.BATCH_DATA_SERVER_TOKEN;

// ---------------------------------------------------------
// 🟢 1. Local Type Definitions (Unchanged)
// ---------------------------------------------------------

// Mirrors your 'PropertyLead' Schema
type DBLead = {
  id: string;
  type: string; // Owner Info

  ownerFirstName?: string;
  ownerLastName?: string;
  ownerAddress: string;
  ownerCity: string;
  ownerState: string;
  ownerZip: string; // Admin Info

  adminFirstName?: string;
  adminLastName?: string;
  adminAddress?: string;
  adminCity?: string;
  adminState?: string;
  adminZip?: string; // Mailing Info

  mailingAddress?: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
  mailingZip?: string | null;
  isAbsenteeOwner?: boolean; // Contact Arrays

  phones?: string[];
  emails?: string[];

  skipTraceStatus?: string;
  updatedAt?: string;
};

// Derived type for clean mailing address passing
type MailingAddressData = {
  mailingAddress?: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
  mailingZip?: string | null;
};

// Return type for the API Helper
type BatchDataResult = {
  status: string;
  foundPhones: string[];
  foundEmails: string[];
  mailingData?: MailingAddressData | null;
};

type HandlerArgs = {
  leadIds: string[];
};

// ---------------------------------------------------------
// 🟢 2. Main Handler (Unchanged)
// ---------------------------------------------------------

export const handler = async (event: HandlerArgs) => {
  // ... (Argument extraction logic remains the same) ...

  console.log('--- START ARGUMENT EXTRACTION ---');
  console.log('RAW EVENT RECEIVED:', JSON.stringify(event));

  let args: HandlerArgs; // Safely cast 'event' to 'unknown' before checking for the nested 'arguments' property

  const eventAsUnknown = event as unknown;

  if (
    eventAsUnknown &&
    (eventAsUnknown as { arguments: HandlerArgs }).arguments
  ) {
    // Case 1: Arguments are nested inside 'arguments' property
    args = (eventAsUnknown as { arguments: HandlerArgs }).arguments;
    console.log("Extracted args from 'arguments' property.");
  } else if (event) {
    // Case 2: Arguments are the event object itself
    args = event as HandlerArgs;
    console.log('Used event object directly as args.');
  } else {
    console.error('❌ ERROR: Event object is missing.');
    return [];
  }

  const { leadIds } = args;
  console.log('Extracted leadIds:', leadIds);
  console.log('--- END ARGUMENT EXTRACTION ---'); // Safety check before continuing

  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    console.error('❌ ERROR: Lead IDs array is empty or invalid.');
    return [];
  }
  console.log(`🕵️‍♂️ Starting V1 Skip Trace for ${leadIds.length} leads...`);

  const results = [];

  for (const leadId of leadIds) {
    try {
      // A. Fetch Lead from DB
      const getRes = await ddbDocClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { id: leadId },
        })
      ); // Cast to our local type

      const lead = getRes.Item as DBLead;

      if (!lead) {
        results.push({
          id: leadId,
          status: 'NOT_FOUND',
          error: 'Lead does not exist',
        });
        continue;
      } // B. Call BatchData V1 (using existing function name)

      const enrichedData = await callBatchDataV3(lead); // Handle Failures

      if (
        enrichedData.status === 'NO_MATCH' ||
        enrichedData.status === 'INVALID_GEO' ||
        enrichedData.status === 'ERROR'
      ) {
        // Catch V1 errors here
        console.log(
          `⚠️ No match, Invalid Geo, or API Error for lead: ${leadId}. Status: ${enrichedData.status}`
        );
        await updateLeadStatus(leadId, 'NO_MATCH');
        results.push({ id: leadId, status: 'NO_MATCH' });
        continue;
      } // C. Prepare Update Data

      const newPhones = [
        ...new Set([...(lead.phones || []), ...enrichedData.foundPhones]),
      ];
      const newEmails = [
        ...new Set([...(lead.emails || []), ...enrichedData.foundEmails]),
      ]; // Logic: Prioritize new mailing data from BatchData, fall back to existing DB data

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
        lead.ownerZip; // Logic: Detect Absentee Owner (Only for Pre-foreclosure)
      // If V1 returned a mailing address that is DIFFERENT from the property address, mark absentee.

      let isAbsentee = lead.isAbsenteeOwner;
      if (
        lead.type !== 'PROBATE' &&
        enrichedData.mailingData?.mailingAddress &&
        enrichedData.mailingData.mailingAddress !== lead.ownerAddress
      ) {
        isAbsentee = true;
      } // Prepare Update Object

      const updatedLead = {
        ...lead,
        phones: newPhones,
        emails: newEmails,
        mailingAddress: finalMailingAddress,
        mailingCity: finalMailingCity,
        mailingState: finalMailingState,
        mailingZip: finalMailingZip,
        isAbsenteeOwner: isAbsentee,
        skipTraceStatus: 'COMPLETED',
        updatedAt: new Date().toISOString(),
      }; // 🛑 Final Absentee Owner check (Fix for :iao crash)

      if (
        updatedLead.isAbsenteeOwner === undefined ||
        updatedLead.isAbsenteeOwner === null
      ) {
        updatedLead.isAbsenteeOwner = false;
      } // D. Save to DynamoDB

      await ddbDocClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { id: leadId },
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
      ); // E. CRM Sync

      await syncToGoHighLevel(updatedLead);

      results.push({
        id: leadId,
        status: 'SUCCESS',
        phones: newPhones.length,
        emails: newEmails.length,
      });
    } catch (error: any) {
      console.error(`❌ Error processing lead ${leadId}:`, error);
      results.push({ id: leadId, status: 'ERROR', error: error.message });
      await updateLeadStatus(leadId, 'FAILED'); // 🛑 Ensure status is set to FAILED on generic crash
    }
  }

  return results;
};

// ---------------------------------------------------------
// 🛠️ HELPER: BatchData V1 API Call
// ---------------------------------------------------------

async function callBatchDataV3(lead: DBLead): Promise<BatchDataResult> {
  if (!BATCH_DATA_SERVER_TOKEN) throw new Error('Missing BatchData API Key'); // 1. Dynamic Targeting Logic

  let targetName = { first: lead.ownerFirstName, last: lead.ownerLastName };
  let targetAddress = {
    street: lead.ownerAddress ? lead.ownerAddress.trim() : '',
    city: lead.ownerCity ? lead.ownerCity.trim() : '',
    state: lead.ownerState ? lead.ownerState.trim().toUpperCase() : '',
    zip: lead.ownerZip ? lead.ownerZip.trim() : '',
  }; // Override: Probate targets Admin

  if (lead.type?.toUpperCase() === 'PROBATE') {
    console.log(`⚰️ Probate Lead: Skip tracing Admin`);
    targetName = { first: lead.adminFirstName, last: lead.adminLastName }; // Prefer the standardized mailing address if we have it (from upload), otherwise raw admin address

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
  } // 🛑 V1 PAYLOAD STRUCTURE

  const payload = {
    requestId: lead.id, // V1 accepts requestId at the top level [cite: 70]
    name: targetName, // V1 supports name targeting [cite: 16]
    propertyAddress: targetAddress, // V1 supports property address [cite: 13]
    options: {
      prioritizeMobilePhones: true, // Prioritize mobile phones [cite: 26]
      includeTCPABlacklistedPhones: false, // V1 Default: Filters out DNC/TCPA restricted phones [cite: 23, 7]
    },
  };

  try {
    const res = await axios.post(
      // 🛑 V1 ENDPOINT
      'https://api.batchdata.com/api/v1/property/skip-trace',
      payload,
      {
        headers: {
          Authorization: `Bearer ${BATCH_DATA_SERVER_TOKEN}`, // Authentication required [cite: 9]
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    ); // 🛑 V1 RESPONSE PARSING: The result object is usually nested under 'results' and contains 'persons' [cite: 28, 29]

    const resultContainer = res.data?.results;
    const person = resultContainer?.persons?.[0]; // V1 focuses on a single person [cite: 29]
    // If no person is found, or match status is false

    if (!person || resultContainer?.meta?.matched === false) {
      return {
        status: 'NO_MATCH',
        foundPhones: [],
        foundEmails: [],
        mailingData: null,
      };
    }

    // Note: V1 typically doesn't have an INVALID_GEO status in the same way as V3. NO_MATCH is sufficient.

    const foundPhones: string[] = [];
    const foundEmails: string[] = [];

    let mailingData: MailingAddressData | null = null; // 🟢 MAILING ADDRESS CAPTURE

    if (person.mailingAddress) {
      const mailAddress = person.mailingAddress;

      mailingData = {
        // Mapping from API response fields
        mailingAddress: mailAddress.street,
        mailingCity: mailAddress.city,
        mailingState: mailAddress.state,
        mailingZip: mailAddress.zip,
      };
    } // 🛑 PHONE FILTERING: Mobile, Score 90+, and DNC check

    if (person.phoneNumbers) {
      person.phoneNumbers.forEach((p: any) => {
        const score = parseFloat(p.score) || 0; // Score is a string in V1 response
        if (
          p.type === 'Mobile' &&
          score >= 90 &&
          p.dnc !== true && // Explicit DNC check [cite: 40]
          p.number
        ) {
          // Ensure number exists
          foundPhones.push(p.number);
        }
      });
    } // 🟢 EMAIL FILTERING

    if (person.emails) {
      person.emails.forEach((e: any) => {
        if (e.tested === true && e.email) {
          // Email is tested/validated [cite: 45]
          foundEmails.push(e.email);
        }
      });
    }

    return {
      status: 'SUCCESS',
      foundPhones,
      foundEmails,
      mailingData,
    };
  } catch (error: any) {
    console.error('BatchData V1 API Error:', error.message);
    return {
      status: 'ERROR',
      foundPhones: [],
      foundEmails: [],
      mailingData: null,
    };
  }
}

async function updateLeadStatus(id: string, status: string) {
  await ddbDocClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: 'SET skipTraceStatus = :s',
      ExpressionAttributeValues: { ':s': status },
    })
  );
}
