/**
 * FIX MISSING NEXTEMAILDATE
 * 
 * Sets nextEmailDate for contacts missing it so they can receive emails
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const OUTREACH_QUEUE_TABLE = 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

async function fixNextEmailDate() {
  console.log('🔄 Starting nextEmailDate fix...');

  // Get all OutreachQueue items with email but no nextEmailDate
  const result = await docClient.send(new ScanCommand({
    TableName: OUTREACH_QUEUE_TABLE,
    FilterExpression: 'attribute_exists(contactEmail) AND attribute_not_exists(nextEmailDate) AND emailStatus = :pending',
    ExpressionAttributeValues: {
      ':pending': 'PENDING'
    }
  }));

  const items = result.Items || [];
  console.log(`📋 Found ${items.length} contacts missing nextEmailDate`);

  let updated = 0;

  for (const item of items) {
    // Set nextEmailDate to now (ready to send immediately)
    await docClient.send(new UpdateCommand({
      TableName: OUTREACH_QUEUE_TABLE,
      Key: { id: item.id },
      UpdateExpression: 'SET nextEmailDate = :now, updatedAt = :now',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString()
      }
    }));

    updated++;
    
    if (updated % 50 === 0) {
      console.log(`✅ Updated ${updated}/${items.length}...`);
    }
  }

  console.log(`\n✅ Fix complete: Updated ${updated} contacts`);
}

fixNextEmailDate().catch(console.error);
