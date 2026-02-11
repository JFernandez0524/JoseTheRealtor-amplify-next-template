/**
 * Emergency script to fix email_attempt_counter for all contacts
 * Sets counter to 1 for any contact with last_email_date set
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const GHL_TABLE = 'GhlIntegration-ahlnflzdejd5jdrulwuqcuxm6i-NONE';
const USER_ID = '44d8f4c8-10c1-7038-744b-271103170819';

async function main() {
  console.log('🚨 EMERGENCY: Fixing email_attempt_counter for all emailed contacts...\n');

  // Get GHL token
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
  const locationId = ghlResult.Items[0].locationId;
  console.log(`✅ Found GHL integration\n`);

  const ghl = axios.create({
    baseURL: 'https://services.leadconnectorhq.com',
    headers: {
      Authorization: `Bearer ${ghlToken}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28'
    }
  });

  // Search for all contacts with "ai outreach" tag
  const searchRes = await ghl.post('/contacts/search', {
    locationId,
    pageLimit: 100,
    filters: [
      {
        field: 'tags',
        operator: 'contains',
        value: 'ai outreach'
      }
    ]
  });

  const contacts = searchRes.data?.contacts || [];
  console.log(`Found ${contacts.length} contacts with "ai outreach" tag\n`);

  let fixed = 0;
  let skipped = 0;

  for (const contact of contacts) {
    // Check if last_email_date is set (field ID: 3xOBr4GvgRc22kBRNYCE)
    const lastEmailDate = contact.customFields?.find((f: any) => f.id === '3xOBr4GvgRc22kBRNYCE')?.value;
    
    if (!lastEmailDate) {
      skipped++;
      continue;
    }

    // This contact has been emailed - set counter to 1
    try {
      await ghl.put(`/contacts/${contact.id}`, {
        customFields: [
          { id: 'wWlrXoXeMXcM6kUexf2L', value: '1' } // email_attempt_counter
        ]
      });

      console.log(`✅ Fixed: ${contact.firstName} ${contact.lastName} (last emailed: ${lastEmailDate})`);
      fixed++;

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error(`❌ Failed for ${contact.firstName} ${contact.lastName}:`, error.response?.data || error.message);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Fixed: ${fixed}`);
  console.log(`   ⏭️ Skipped (never emailed): ${skipped}`);
}

main().catch(console.error);
