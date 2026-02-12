/**
 * BACKFILL LEADID TO OUTREACH QUEUE
 * 
 * Adds leadId to existing OutreachQueue items by looking up PropertyLead by ghlContactId
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const OUTREACH_QUEUE_TABLE = 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE';
const PROPERTY_LEAD_TABLE = 'PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

async function backfillLeadIds() {
  console.log('🔄 Starting leadId backfill...');

  // Get all OutreachQueue items
  const queueResult = await docClient.send(new ScanCommand({
    TableName: OUTREACH_QUEUE_TABLE,
  }));

  const queueItems = queueResult.Items || [];
  console.log(`📋 Found ${queueItems.length} queue items`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const item of queueItems) {
    if (item.leadId) {
      console.log(`⏭️  Skipping ${item.contactId} - already has leadId`);
      skipped++;
      continue;
    }

    // Find PropertyLead by ghlContactId
    const leadResult = await docClient.send(new ScanCommand({
      TableName: PROPERTY_LEAD_TABLE,
      FilterExpression: 'ghlContactId = :contactId',
      ExpressionAttributeValues: {
        ':contactId': item.contactId,
      },
      Limit: 1,
    }));

    if (!leadResult.Items || leadResult.Items.length === 0) {
      console.log(`⚠️  No PropertyLead found for contact ${item.contactId}`);
      notFound++;
      continue;
    }

    const lead = leadResult.Items[0];

    // Update queue item with leadId
    await docClient.send(new UpdateCommand({
      TableName: OUTREACH_QUEUE_TABLE,
      Key: { id: item.id },
      UpdateExpression: 'SET leadId = :leadId, updatedAt = :now',
      ExpressionAttributeValues: {
        ':leadId': lead.id,
        ':now': new Date().toISOString(),
      },
    }));

    console.log(`✅ Updated ${item.contactId} with leadId ${lead.id}`);
    updated++;
  }

  console.log('\n📊 Backfill complete:');
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ⏭️  Skipped (already had leadId): ${skipped}`);
  console.log(`  ⚠️  Not found: ${notFound}`);
}

backfillLeadIds().catch(console.error);
