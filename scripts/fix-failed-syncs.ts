/**
 * Fix Failed GHL Syncs
 * 
 * Searches GHL for leads marked as "sync failed" in DynamoDB
 * and updates their status to SUCCESS if found in GHL
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

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
  ghlSyncStatus?: string;
}

async function getGhlToken(userId: string): Promise<string | null> {
  const result = await dynamodb.send(new ScanCommand({
    TableName: GHL_INTEGRATION_TABLE,
    FilterExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  }));

  return result.Items?.[0]?.accessToken || null;
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

  // Try phone first
  if (lead.ownerPhone) {
    try {
      const res = await ghl.post('/contacts/search', {
        locationId,
        pageLimit: 1,
        filters: [{ field: 'phone', operator: 'eq', value: lead.ownerPhone }]
      });
      if (res.data?.contacts?.length > 0) {
        return res.data.contacts[0].id;
      }
    } catch (err) {
      console.warn(`⚠️ Phone search failed for ${lead.id}`);
    }
  }

  // Try email
  if (lead.ownerEmail) {
    try {
      const res = await ghl.post('/contacts/search', {
        locationId,
        pageLimit: 1,
        filters: [{ field: 'email', operator: 'eq', value: lead.ownerEmail }]
      });
      if (res.data?.contacts?.length > 0) {
        return res.data.contacts[0].id;
      }
    } catch (err) {
      console.warn(`⚠️ Email search failed for ${lead.id}`);
    }
  }

  // Try name
  if (lead.ownerFirstName && lead.ownerLastName) {
    try {
      const res = await ghl.post('/contacts/search', {
        locationId,
        pageLimit: 1,
        filters: [{ 
          field: 'name', 
          operator: 'eq', 
          value: `${lead.ownerFirstName} ${lead.ownerLastName}` 
        }]
      });
      if (res.data?.contacts?.length > 0) {
        return res.data.contacts[0].id;
      }
    } catch (err) {
      console.warn(`⚠️ Name search failed for ${lead.id}`);
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

async function main() {
  console.log('🔍 Scanning for failed GHL syncs...\n');

  // Get all leads with failed sync status
  const result = await dynamodb.send(new ScanCommand({
    TableName: LEAD_TABLE,
    FilterExpression: 'ghlSyncStatus = :failed',
    ExpressionAttributeValues: { ':failed': 'FAILED' }
  }));

  const failedLeads = (result.Items || []) as FailedLead[];
  console.log(`Found ${failedLeads.length} failed syncs\n`);

  if (failedLeads.length === 0) {
    console.log('✅ No failed syncs to fix!');
    return;
  }

  // Group by userId to batch process
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
    console.log(`\n👤 Processing ${leads.length} leads for user ${userId}`);
    
    const accessToken = await getGhlToken(userId);
    if (!accessToken) {
      console.log(`⚠️ No GHL token found for user ${userId}, skipping...`);
      continue;
    }

    // Get locationId from first lead's GHL integration
    const integrationResult = await dynamodb.send(new ScanCommand({
      TableName: GHL_INTEGRATION_TABLE,
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    }));
    const locationId = integrationResult.Items?.[0]?.locationId;

    if (!locationId) {
      console.log(`⚠️ No locationId found for user ${userId}, skipping...`);
      continue;
    }

    for (const lead of leads) {
      const ghlContactId = await searchGhlContact(accessToken, locationId, lead);
      
      if (ghlContactId) {
        await updateLeadStatus(lead.id, ghlContactId);
        console.log(`✅ Fixed: ${lead.ownerFirstName} ${lead.ownerLastName} → ${ghlContactId}`);
        fixed++;
      } else {
        console.log(`❌ Not found: ${lead.ownerFirstName} ${lead.ownerLastName}`);
        notFound++;
      }

      // Rate limit: 2 seconds between searches
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Fixed: ${fixed}`);
  console.log(`   Not found: ${notFound}`);
  console.log(`   Total: ${failedLeads.length}`);
}

main().catch(console.error);
