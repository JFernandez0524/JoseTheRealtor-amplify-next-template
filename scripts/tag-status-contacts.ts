/**
 * Script to find and tag GHL contacts that were synced with a manual status
 * 
 * This finds contacts where:
 * - skipTraceStatus = NO_QUALITY_CONTACTS (in GHL custom field)
 * - The corresponding lead in our DB has a manualStatus set
 * 
 * Usage: npx tsx scripts/tag-status-contacts.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const LEAD_TABLE = 'PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE';
const GHL_TABLE = 'GhlIntegration-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

// Your user ID
const USER_ID = '44d8f4c8-10c1-7038-744b-271103170819';

// GHL custom field ID for app_lead_id
const APP_LEAD_ID_FIELD = 'contact.app_lead_id'; // Update if different

async function main() {
  console.log('🔍 Finding NO_QUALITY_CONTACTS contacts with manual status...\n');

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
  const locationId = ghlResult.Items[0].locationId;
  console.log(`✅ Found GHL integration for location: ${locationId}\n`);

  const ghl = axios.create({
    baseURL: 'https://services.leadconnectorhq.com',
    headers: {
      Authorization: `Bearer ${ghlToken}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28'
    }
  });

  // 2. Search GHL for contacts with skiptracestatus = NO_QUALITY_CONTACTS
  console.log('📋 Searching GHL for NO_QUALITY_CONTACTS contacts...\n');
  
  const searchRes = await ghl.post('/contacts/search', {
    locationId,
    query: 'NO_QUALITY_CONTACTS' // Search in all fields
  });

  const contacts = searchRes.data?.contacts || [];
  console.log(`Found ${contacts.length} contacts to check\n`);

  let tagged = 0;
  let skipped = 0;
  let failed = 0;

  for (const contact of contacts) {
    // Find app_lead_id custom field
    const appLeadIdField = contact.customFields?.find((cf: any) => 
      cf.id === 'oaf4wCuM3Ub9eGpiddrO' // app_lead_id field ID
    );
    
    const leadId = appLeadIdField?.value;
    
    if (!leadId) {
      console.log(`⚠️ Skipping ${contact.firstName} ${contact.lastName} - no app_lead_id`);
      skipped++;
      continue;
    }

    // Check if lead has manualStatus in DB
    try {
      const leadResult = await dynamodb.send(new GetCommand({
        TableName: LEAD_TABLE,
        Key: { id: leadId }
      }));

      const lead = leadResult.Item;
      
      if (!lead) {
        console.log(`⚠️ Lead ${leadId} not found in DB`);
        skipped++;
        continue;
      }

      if (!lead.manualStatus) {
        // This is OK - no manual status means it should have been synced
        skipped++;
        continue;
      }

      // This contact has a manual status - tag it!
      await ghl.put(`/contacts/${contact.id}`, {
        tags: ['wrong_status_synced']
      });

      console.log(`✅ Tagged: ${contact.firstName} ${contact.lastName} (Status: ${lead.manualStatus}) - Contact ID: ${contact.id}`);
      tagged++;

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error(`❌ Failed for ${contact.firstName} ${contact.lastName}:`, error.response?.data || error.message);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Tagged: ${tagged}`);
  console.log(`   ⏭️ Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`\n🏷️ Tagged contacts have: "wrong_status_synced"`);
}

main().catch(console.error);
