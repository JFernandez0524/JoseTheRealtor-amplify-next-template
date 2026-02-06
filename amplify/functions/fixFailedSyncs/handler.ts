import type { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

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

async function getFullLead(leadId: string) {
  const result = await dynamodb.send(new GetCommand({
    TableName: LEAD_TABLE,
    Key: { id: leadId }
  }));
  return result.Item;
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

async function markLeadAsRetryable(leadId: string, errorMessage: string) {
  await dynamodb.send(new UpdateCommand({
    TableName: LEAD_TABLE,
    Key: { id: leadId },
    UpdateExpression: 'SET ghlSyncStatus = :status, ghlSyncError = :error, updatedAt = :now',
    ExpressionAttributeValues: {
      ':status': 'FAILED',
      ':error': errorMessage.substring(0, 500), // Truncate long errors
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
  let created = 0;
  let failed = 0;

  // Import the actual sync function
  const { syncToGoHighLevel } = await import('../manualGhlSync/integrations/gohighlevel');

  for (const [userId, leads] of leadsByUser) {
    const { accessToken, locationId } = await getGhlToken(userId);
    
    if (!accessToken || !locationId) {
      console.log(`⚠️ No GHL credentials for user ${userId}`);
      failed += leads.length;
      continue;
    }

    for (const lead of leads) {
      try {
        // Get full lead data
        const fullLead = await getFullLead(lead.id);
        if (!fullLead) {
          console.log(`❌ Lead not found: ${lead.id}`);
          failed++;
          continue;
        }

        // Use the actual sync function with proper parameters
        const primaryPhone = fullLead.ownerPhone || fullLead.phone1;
        const ghlContactId = await syncToGoHighLevel(
          fullLead as any, // Cast to bypass type checking - DynamoDB item matches DBLead structure
          primaryPhone,
          1, // phoneIndex
          true, // isPrimary
          [], // userGroups
          userId,
          accessToken,
          locationId
        );

        if (ghlContactId) {
          await updateLeadStatus(lead.id, ghlContactId);
          console.log(`✅ Synced: ${lead.ownerFirstName} ${lead.ownerLastName}`);
          created++;
        } else {
          // This shouldn't happen since syncToGoHighLevel throws on error
          await markLeadAsRetryable(lead.id, 'No contact ID returned');
          console.log(`❌ Sync failed: ${lead.ownerFirstName} ${lead.ownerLastName}`);
          failed++;
        }
      } catch (err: any) {
        // Keep as FAILED so it can be retried later
        await markLeadAsRetryable(lead.id, err.message);
        console.error(`❌ Error syncing ${lead.id}:`, err.message);
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ 
      fixed: 0, // No longer searching, only creating
      created, 
      failed, 
      total: failedLeads.length 
    })
  };
};
