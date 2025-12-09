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
import { syncToKVCore } from '../../functions/uploadCsvHandler/src/intergrations/kvcore';

const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.AMPLIFY_DATA_LEAD_TABLE_NAME;
const BATCH_DATA_API_KEY = process.env.BATCH_DATA_API_KEY;

// ---------------------------------------------------------
// 🟢 1. Local Type Definitions (Safe for Lambda)
// ---------------------------------------------------------

// Mirrors your 'PropertyLead' Schema
type DBLead = {
  id: string;
  type: string;

  // Owner Info
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerAddress: string;
  ownerCity: string;
  ownerState: string;
  ownerZip: string;

  // Admin Info
  adminFirstName?: string;
  adminLastName?: string;
  adminAddress?: string;
  adminCity?: string;
  adminState?: string;
  adminZip?: string;

  // Mailing Info
  mailingAddress?: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
  mailingZip?: string | null;
  isAbsenteeOwner?: boolean;

  // Contact Arrays
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
  targetCrm: 'GHL' | 'KVCORE' | 'NONE';
};

// ---------------------------------------------------------
// 🟢 2. Main Handler
// ---------------------------------------------------------

export const handler = async (event: HandlerArgs) => {
  const { leadIds, targetCrm } = event;
  console.log(`🕵️‍♂️ Starting V3 Skip Trace for ${leadIds.length} leads...`);

  const results = [];

  for (const leadId of leadIds) {
    try {
      // A. Fetch Lead from DB
      const getRes = await ddbDocClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { id: leadId },
        })
      );

      // Cast to our local type
      const lead = getRes.Item as DBLead;

      if (!lead) {
        results.push({
          id: leadId,
          status: 'NOT_FOUND',
          error: 'Lead does not exist',
        });
        continue;
      }

      // B. Call BatchData V3
      const enrichedData = await callBatchDataV3(lead);

      // Handle Failures
      if (
        enrichedData.status === 'NO_MATCH' ||
        enrichedData.status === 'INVALID_GEO'
      ) {
        console.log(`⚠️ No match or Invalid Geo for lead: ${leadId}`);
        await updateLeadStatus(leadId, 'NO_MATCH');
        results.push({ id: leadId, status: 'NO_MATCH' });
        continue;
      }

      // C. Prepare Update Data
      const newPhones = [
        ...new Set([...(lead.phones || []), ...enrichedData.foundPhones]),
      ];
      const newEmails = [
        ...new Set([...(lead.emails || []), ...enrichedData.foundEmails]),
      ];

      // Logic: Prioritize new mailing data from BatchData, fall back to existing DB data
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

      // Logic: Detect Absentee Owner (Only for Pre-foreclosure)
      // If V3 returned a mailing address that is DIFFERENT from the property address, mark absentee.
      let isAbsentee = lead.isAbsenteeOwner;
      if (
        lead.type !== 'PROBATE' &&
        enrichedData.mailingData?.mailingAddress &&
        enrichedData.mailingData.mailingAddress !== lead.ownerAddress
      ) {
        isAbsentee = true;
      }

      // Prepare Update Object
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
      };

      // D. Save to DynamoDB
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
      );

      // E. CRM Sync
      if (targetCrm === 'GHL') await syncToGoHighLevel(updatedLead);
      else if (targetCrm === 'KVCORE') await syncToKVCore(updatedLead);

      results.push({
        id: leadId,
        status: 'SUCCESS',
        phones: newPhones.length,
        emails: newEmails.length,
      });
    } catch (error: any) {
      console.error(`❌ Error processing lead ${leadId}:`, error);
      results.push({ id: leadId, status: 'ERROR', error: error.message });
    }
  }

  return results;
};

// ---------------------------------------------------------
// 🛠️ HELPER: BatchData V3 API Call
// ---------------------------------------------------------

async function callBatchDataV3(lead: DBLead): Promise<BatchDataResult> {
  if (!BATCH_DATA_API_KEY) throw new Error('Missing BatchData API Key');

  // 1. Dynamic Targeting Logic
  let targetName = { first: lead.ownerFirstName, last: lead.ownerLastName };
  let targetAddress = {
    street: lead.ownerAddress,
    city: lead.ownerCity,
    state: lead.ownerState,
    zip: lead.ownerZip,
  };

  // Override: Probate targets Admin
  if (lead.type?.toUpperCase() === 'PROBATE') {
    console.log(`⚰️ Probate Lead: Skip tracing Admin`);
    targetName = { first: lead.adminFirstName, last: lead.adminLastName };

    // Prefer the standardized mailing address if we have it (from upload), otherwise raw admin address
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

  const payload = {
    requests: [
      {
        requestId: lead.id,
        name: targetName,
        propertyAddress: targetAddress,
      },
    ],
    matchOptions: {
      prioritizeMobilePhones: true,
      includeTCPABlacklistedPhones: true, // Required to get results, we filter DNC manually below
    },
  };

  try {
    const res = await axios.post(
      'https://api.batchdata.com/api/v3/property/skip-trace',
      payload,
      {
        headers: {
          Authorization: `Bearer ${BATCH_DATA_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    const resultData = res.data?.result?.data || [];
    const match = resultData.find((r: any) => r.requestId === lead.id);

    // Standardize error returns with consistent shape
    if (!match)
      return {
        status: 'NO_MATCH',
        foundPhones: [],
        foundEmails: [],
        mailingData: null,
      };
    if (match.meta?.matched === false)
      return {
        status: 'INVALID_GEO',
        foundPhones: [],
        foundEmails: [],
        mailingData: null,
      };

    const foundPhones: string[] = [];
    const foundEmails: string[] = [];

    let mailingData: MailingAddressData | null = null;

    if (match.persons && match.persons.length > 0) {
      match.persons.forEach((person: any) => {
        // 🟢 PHONE FILTERING (Mobile Only, Score > 90, No DNC)
        person.phones?.forEach((p: any) => {
          if (
            p.type === 'Mobile' &&
            (p.rank || 0) >= 90 &&
            p.dnc !== true &&
            p.number
          ) {
            foundPhones.push(p.number);
          }
        });

        // 🟢 EMAIL FILTERING (Tested Only)
        person.emails?.forEach((e: any) => {
          if (e.tested === true && e.email) {
            foundEmails.push(e.email);
          }
        });

        // 🟢 ADDRESS CAPTURE
        if (!mailingData && person.address) {
          mailingData = {
            mailingAddress: person.address.street,
            mailingCity: person.address.city,
            mailingState: person.address.state,
            mailingZip: person.address.zip,
          };
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
    console.error('BatchData V3 API Error:', error.message);
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
