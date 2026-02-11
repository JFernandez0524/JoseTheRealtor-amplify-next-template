/**
 * Script to sync listing_status field to all GHL contacts
 * 
 * This updates contacts where:
 * - They have been synced to GHL (have ghlContactId in our DB)
 * - The listing_status custom field needs to be set/updated
 * 
 * Usage: npx tsx scripts/tag-status-contacts.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const LEAD_TABLE = 'PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE';
const GHL_TABLE = 'GhlIntegration-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

// Your user ID
const USER_ID = '44d8f4c8-10c1-7038-744b-271103170819';

async function main() {
  console.log('🔄 Syncing listing_status to GHL contacts...\n');

  // 1. Get GHL token
  const ghlResult = await dynamodb.send(new ScanCommand({
    TableName: GHL_TABLE,
    FilterExpression: 'userId = :userId AND isActive = :active',
    ExpressionAttributeValues: {
      ':userId': USER_ID,
      ':active': true
    }
  }));

  if (!ghlResult.Items || ghlResult.Items.length === 0) {
    console.error('❌ No active GHL integration found');
    return;
  }

  const ghlToken = ghlResult.Items[0].accessToken;
  console.log(`✅ Found GHL integration\n`);

  const ghl = axios.create({
    baseURL: 'https://services.leadconnectorhq.com',
    headers: {
      Authorization: `Bearer ${ghlToken}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28'
    }
  });

  // 2. Get all leads with ghlContactId
  console.log('📋 Finding synced leads...\n');
  
  const leadsResult = await dynamodb.send(new ScanCommand({
    TableName: LEAD_TABLE,
    FilterExpression: 'attribute_exists(ghlContactId) AND #owner = :userId',
    ExpressionAttributeNames: {
      '#owner': 'owner'
    },
    ExpressionAttributeValues: {
      ':userId': USER_ID
    }
  }));

  const leads = leadsResult.Items || [];
  console.log(`Found ${leads.length} synced leads\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const lead of leads) {
    if (!lead.ghlContactId) {
      skipped++;
      continue;
    }

    try {
      await ghl.put(`/contacts/${lead.ghlContactId}`, {
        customFields: [
          {
            key: 'listing_status',
            field_value: lead.listingStatus || 'OFF_MARKET'
          }
        ]
      });

      console.log(`✅ Updated ${lead.ownerFirstName} ${lead.ownerLastName}: ${lead.listingStatus || 'OFF_MARKET'}`);
      updated++;

      // Rate limit: 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error(`❌ Failed for ${lead.ghlContactId}:`, error.response?.data || error.message);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️ Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
}

main().catch(console.error);
