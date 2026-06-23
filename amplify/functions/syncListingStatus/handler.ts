import type { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ghlUpdateContact } from '../shared/ghlClient';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: Handler = async (event) => {
  console.log('🔄 Starting listing_status sync to GHL...');

  const userId = event.userId;
  if (!userId) {
    throw new Error('userId is required');
  }

  // 1. Get GHL integration
  const ghlResult = await dynamodb.send(new ScanCommand({
    TableName: process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME,
    FilterExpression: 'userId = :userId AND isActive = :active',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':active': true
    }
  }));

  if (!ghlResult.Items || ghlResult.Items.length === 0) {
    throw new Error('No active GHL integration found');
  }

  const ghlToken = ghlResult.Items[0].accessToken;
  console.log('✅ Found GHL integration');

  // 2. Get all synced leads
  const leadsResult = await dynamodb.send(new ScanCommand({
    TableName: process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME,
    FilterExpression: 'attribute_exists(ghlContactId) AND #owner = :userId',
    ExpressionAttributeNames: {
      '#owner': 'owner'
    },
    ExpressionAttributeValues: {
      ':userId': userId
    }
  }));

  const leads = leadsResult.Items || [];
  console.log(`📋 Found ${leads.length} synced leads`);

  let updated = 0;
  let failed = 0;

  for (const lead of leads) {
    if (!lead.ghlContactId) continue;

    try {
      await ghlUpdateContact(ghlToken, lead.ghlContactId, {
        customFields: [{ key: 'listing_status', field_value: lead.listingStatus || 'OFF_MARKET' }]
      });

      console.log(`✅ Updated ${lead.ghlContactId}: ${lead.listingStatus || 'OFF_MARKET'}`);
      updated++;

      // Rate limit: 500ms between requests
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`❌ Failed ${lead.ghlContactId}:`, error);
      failed++;
    }
  }

  console.log(`📊 Summary: ${updated} updated, ${failed} failed`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      updated,
      total: leads.length,
      failed,
    }),
  };
};
