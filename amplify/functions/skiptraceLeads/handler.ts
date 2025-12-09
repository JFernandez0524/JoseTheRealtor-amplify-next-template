import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

// Import Sync functions
import { syncToGoHighLevel } from '../../functions/uploadCsvHandler/src/intergrations/gohighlevel';
import { syncToKVCore } from '../../functions/uploadCsvHandler/src/intergrations/kvcore';

const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.AMPLIFY_DATA_LEAD_TABLE_NAME;
const BATCH_DATA_API_KEY = process.env.BATCH_DATA_API_KEY;

// Define Arguments
type HandlerArgs = {
  leadIds: string[];
  targetCrm: 'GHL' | 'KVCORE' | 'NONE';
};

export const handler = async (event: HandlerArgs) => {
  const { leadIds, targetCrm } = event;
  console.log(`🕵️‍♂️ Starting Batch Skip Trace for ${leadIds.length} leads...`);

  const results = [];

  for (const leadId of leadIds) {
    try {
      // 1. Fetch Lead from DB
      const getRes = await ddbDocClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { id: leadId },
        })
      );

      const lead = getRes.Item;
      if (!lead) {
        results.push({
          id: leadId,
          status: 'NOT_FOUND',
          error: 'Lead does not exist',
        });
        continue;
      }

      // 2. Call BatchData V3 (Logic moved from your Next.js Utils)
      const enrichedData = await callBatchDataV3(lead);

      if (
        enrichedData.foundPhones.length === 0 &&
        enrichedData.foundEmails.length === 0
      ) {
        console.log(`⚠️ No hits for lead ${leadId}`);
        results.push({ id: leadId, status: 'NO_MATCH' });

        // ✅ Correct: Save 'NO_MATCH' so the frontend knows we tried but found nothing.
        await updateLeadStatus(leadId, 'NO_MATCH');
        continue;
      }

      // 3. Update DynamoDB (Merge new data with existing arrays)
      // We use Set to prevent duplicates
      const newPhones = [
        ...new Set([...(lead.phones || []), ...enrichedData.foundPhones]),
      ];
      const newEmails = [
        ...new Set([...(lead.emails || []), ...enrichedData.foundEmails]),
      ];

      const updatedLead = {
        ...lead,
        phones: newPhones,
        emails: newEmails,
        skipTraceStatus: 'COMPLETED',
        updatedAt: new Date().toISOString(),
      };

      await ddbDocClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { id: leadId },
          UpdateExpression:
            'SET phones = :p, emails = :e, skipTraceStatus = :s, updatedAt = :u',
          ExpressionAttributeValues: {
            ':p': newPhones,
            ':e': newEmails,
            ':s': 'COMPLETED',
            ':u': updatedLead.updatedAt,
          },
        })
      );

      // 4. Manual Sync to CRM (Only if user requested it)
      // This is safe now because we have the phones/emails in the DB!
      if (targetCrm === 'GHL') {
        await syncToGoHighLevel(updatedLead);
      } else if (targetCrm === 'KVCORE') {
        await syncToKVCore(updatedLead);
      }

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
async function callBatchDataV3(lead: any) {
  if (!BATCH_DATA_API_KEY) throw new Error('Missing BatchData API Key');

  // Construct Payload
  const payload = {
    requests: [
      {
        requestId: lead.id,
        name: {
          first: lead.ownerFirstName,
          last: lead.ownerLastName,
        },
        propertyAddress: {
          street: lead.ownerAddress,
          city: lead.ownerCity,
          state: lead.ownerState,
          zip: lead.ownerZip,
        },
      },
    ],
    matchOptions: {
      prioritizeMobilePhones: true,
    },
  };

  try {
    const res = await axios.post(
      'https://api.batchdata.com/api/v1/property/skip-trace',
      payload,
      {
        headers: {
          Authorization: `Bearer ${BATCH_DATA_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    const match = res.data?.results?.find((r: any) => r.requestId === lead.id);
    if (!match || !match.persons) return { foundPhones: [], foundEmails: [] };

    const foundPhones: string[] = [];
    const foundEmails: string[] = [];

    match.persons.forEach((person: any) => {
      person.phones?.forEach((p: any) => {
        if (p.number) foundPhones.push(p.number);
      });
      person.emails?.forEach((e: any) => {
        if (e.email) foundEmails.push(e.email);
      });
    });

    return { foundPhones, foundEmails };
  } catch (error: any) {
    console.error(
      'BatchData API Error:',
      error.response?.data || error.message
    );
    // Return empty if API fails so we don't crash the whole loop
    return { foundPhones: [], foundEmails: [] };
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
