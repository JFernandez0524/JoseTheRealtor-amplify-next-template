import type { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { updateLeadSyncStatus } from '../shared/syncUtils';
import { getValidGhlToken } from '../shared/ghlTokenManager';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const LEAD_TABLE = process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME!;

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

async function markLeadAsRetryable(leadId: string, errorMessage: string) {
  await updateLeadSyncStatus(dynamodb, LEAD_TABLE, leadId, 'FAILED');
  console.log(`Marked as retryable with error: ${errorMessage.substring(0, 100)}`);
}

export const handler: Handler = async () => {
  console.log('🔍 Scanning for failed GHL syncs...');
  console.log('Environment:', { LEAD_TABLE });

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

  console.log(`Grouped into ${leadsByUser.size} users`);

  let created = 0;
  let failed = 0;

  // Import the actual sync function
  const { syncToGoHighLevel } = await import('../manualGhlSync/integrations/gohighlevel');

  for (const [userId, leads] of leadsByUser) {
    console.log(`\n👤 Processing user ${userId} with ${leads.length} failed leads`);
    
    const tokenData = await getValidGhlToken(userId);
    
    if (!tokenData) {
      console.log(`⚠️ No GHL credentials for user ${userId}`);
      failed += leads.length;
      continue;
    }

    console.log(`✅ Found GHL credentials for location ${tokenData.locationId}`);

    for (const lead of leads) {
      try {
        console.log(`🔄 Processing lead ${lead.id}: ${lead.ownerFirstName} ${lead.ownerLastName}`);
        
        // Get full lead data
        const fullLead = await getFullLead(lead.id);
        if (!fullLead) {
          console.log(`❌ Lead not found: ${lead.id}`);
          failed++;
          continue;
        }

        console.log(`📋 Lead data:`, {
          id: lead.id,
          phone: fullLead.ownerPhone || fullLead.phone1,
          email: fullLead.ownerEmail,
          address: fullLead.ownerAddress
        });

        // Use the actual sync function with proper parameters
        const primaryPhone = fullLead.ownerPhone || fullLead.phone1;
        const ghlContactId = await syncToGoHighLevel(
          fullLead as any,
          primaryPhone,
          1,
          true,
          [],
          userId,
          tokenData.token,
          tokenData.locationId
        );

        if (ghlContactId) {
          await updateLeadSyncStatus(dynamodb, LEAD_TABLE, lead.id, 'SUCCESS', ghlContactId);
          console.log(`✅ Synced: ${lead.ownerFirstName} ${lead.ownerLastName} → ${ghlContactId}`);
          created++;
        } else {
          await markLeadAsRetryable(lead.id, 'No contact ID returned');
          console.log(`❌ Sync failed: ${lead.ownerFirstName} ${lead.ownerLastName}`);
          failed++;
        }
      } catch (err: any) {
        // Keep as FAILED so it can be retried later
        await markLeadAsRetryable(lead.id, err.message);
        console.error(`❌ Error syncing ${lead.id}:`, {
          error: err.message,
          leadName: `${lead.ownerFirstName} ${lead.ownerLastName}`,
          stack: err.stack
        });
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const summary = {
    created, 
    failed, 
    total: failedLeads.length 
  };

  console.log('\n✅ Fix failed syncs complete:', summary);

  return {
    statusCode: 200,
    body: JSON.stringify(summary)
  };
};
