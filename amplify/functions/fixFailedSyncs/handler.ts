import type { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const GHL_BASE = 'https://services.leadconnectorhq.com';
const LEAD_TABLE = process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME!;
const GHL_INTEGRATION_TABLE = process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME!;

interface FailedLead {
  id: string;
  userId: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
}

async function getGhlToken(userId: string) {
  const result = await dynamodb.send(new ScanCommand({
    TableName: GHL_INTEGRATION_TABLE,
    FilterExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  }));

  return {
    accessToken: result.Items?.[0]?.accessToken,
    locationId: result.Items?.[0]?.locationId
  };
}

async function searchGhlContact(
  accessToken: string,
  locationId: string,
  lead: FailedLead
): Promise<string | null> {
  const ghl = axios.create({
    baseURL: GHL_BASE,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Version': '2021-07-28'
    }
  });

  const searches = [
    lead.ownerPhone ? { field: 'phone', value: lead.ownerPhone } : null,
    lead.ownerEmail ? { field: 'email', value: lead.ownerEmail } : null,
    lead.ownerFirstName && lead.ownerLastName 
      ? { field: 'name', value: `${lead.ownerFirstName} ${lead.ownerLastName}` }
      : null
  ].filter(Boolean);

  for (const search of searches) {
    try {
      const res = await ghl.post('/contacts/search', {
        locationId,
        pageLimit: 1,
        filters: [{ field: search!.field, operator: 'eq', value: search!.value }]
      });
      if (res.data?.contacts?.length > 0) {
        return res.data.contacts[0].id;
      }
    } catch (err) {
      console.warn(`Search failed for ${search!.field}:`, err);
    }
  }

  return null;
}

async function updateLeadStatus(leadId: string, ghlContactId: string) {
  await dynamodb.send(new UpdateCommand({
    TableName: LEAD_TABLE,
    Key: { id: leadId },
    UpdateExpression: 'SET ghlSyncStatus = :status, ghlContactId = :contactId, updatedAt = :now',
    ExpressionAttributeValues: {
      ':status': 'SUCCESS',
      ':contactId': ghlContactId,
      ':now': new Date().toISOString()
    }
  }));
}

export const handler: Handler = async () => {
  console.log('🔍 Scanning for failed GHL syncs...');

  const result = await dynamodb.send(new ScanCommand({
    TableName: LEAD_TABLE,
    FilterExpression: 'ghlSyncStatus = :failed',
    ExpressionAttributeValues: { ':failed': 'FAILED' }
  }));

  const failedLeads = (result.Items || []) as FailedLead[];
  console.log(`Found ${failedLeads.length} failed syncs`);

  if (failedLeads.length === 0) {
    return { statusCode: 200, body: 'No failed syncs to fix' };
  }

  const leadsByUser = new Map<string, FailedLead[]>();
  for (const lead of failedLeads) {
    if (!leadsByUser.has(lead.userId)) {
      leadsByUser.set(lead.userId, []);
    }
    leadsByUser.get(lead.userId)!.push(lead);
  }

  let fixed = 0;
  let notFound = 0;

  for (const [userId, leads] of leadsByUser) {
    const { accessToken, locationId } = await getGhlToken(userId);
    
    if (!accessToken || !locationId) {
      console.log(`⚠️ No GHL credentials for user ${userId}`);
      continue;
    }

    for (const lead of leads) {
      const ghlContactId = await searchGhlContact(accessToken, locationId, lead);
      
      if (ghlContactId) {
        await updateLeadStatus(lead.id, ghlContactId);
        console.log(`✅ Fixed: ${lead.ownerFirstName} ${lead.ownerLastName}`);
        fixed++;
      } else {
        console.log(`❌ Not found: ${lead.ownerFirstName} ${lead.ownerLastName}`);
        notFound++;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ fixed, notFound, total: failedLeads.length })
  };
};
