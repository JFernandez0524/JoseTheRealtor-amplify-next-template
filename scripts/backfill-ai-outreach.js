#!/usr/bin/env node

/**
 * BACKFILL AI OUTREACH - Quick Run
 * Adds "ai outreach" tag and OutreachQueue entries for existing contacts
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const axios = require('axios');

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const PROPERTY_LEAD_TABLE = 'PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE';
const OUTREACH_QUEUE_TABLE = 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE';
const GHL_LOCATION_ID = 'mHaAy3ZaUHgrbPyughDG';
const GHL_TOKEN = 'pit-a975757c-04a0-446d-a23b-3ef1050ae32a';
const USER_ID = '44d8f4c8-10c1-7038-744b-271103170819';

async function backfill() {
  console.log('🔍 Scanning for synced leads with emails...');
  
  const scanResult = await docClient.send(new ScanCommand({
    TableName: PROPERTY_LEAD_TABLE,
    FilterExpression: 'attribute_exists(ghlContactId) AND attribute_exists(emails)',
  }));

  const leads = scanResult.Items || [];
  console.log(`📊 Found ${leads.length} synced leads with emails\n`);

  const ghl = axios.create({
    baseURL: 'https://services.leadconnectorhq.com',
    headers: {
      Authorization: `Bearer ${GHL_TOKEN}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
  });

  let processed = 0;
  let tagged = 0;
  let queued = 0;
  let skipped = 0;

  for (const lead of leads) {
    if (!lead.ghlContactId || !lead.emails?.length) continue;

    try {
      const contactRes = await ghl.get(`/contacts/${lead.ghlContactId}`);
      const contact = contactRes.data?.contact;
      
      if (!contact) {
        console.log(`⚠️  Contact ${lead.ghlContactId} not found`);
        continue;
      }

      const currentTags = contact.tags || [];
      const hasAIOutreach = currentTags.includes('ai outreach');

      if (hasAIOutreach) {
        console.log(`✓  ${lead.ownerFirstName} ${lead.ownerLastName} - already has tag`);
        skipped++;
        processed++;
        continue;
      }

      // Add tag
      await ghl.put(`/contacts/${lead.ghlContactId}`, {
        tags: [...currentTags, 'ai outreach'],
      });
      console.log(`✅ ${lead.ownerFirstName} ${lead.ownerLastName} - added tag`);
      tagged++;

      // Add emails to queue
      const emails = lead.emails.filter(e => e);
      
      for (const email of emails) {
        const queueId = `${USER_ID}_${lead.ghlContactId}_${email.replace(/[^a-zA-Z0-9]/g, '')}`;
        
        await docClient.send(new PutCommand({
          TableName: OUTREACH_QUEUE_TABLE,
          Item: {
            id: queueId,
            userId: USER_ID,
            locationId: GHL_LOCATION_ID,
            contactId: lead.ghlContactId,
            leadId: lead.id,
            contactName: `${lead.ownerFirstName || ''} ${lead.ownerLastName || ''}`.trim(),
            contactEmail: email,
            queueStatus: 'OUTREACH',
            emailStatus: 'PENDING',
            emailAttempts: 0,
            nextEmailDate: new Date().toISOString(),
            propertyAddress: lead.ownerAddress,
            propertyCity: lead.ownerCity,
            propertyState: lead.ownerState,
            leadType: lead.type,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }));
        console.log(`   📧 Queued: ${email}`);
        queued++;
      }

      processed++;
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`❌ Error: ${lead.id} - ${error.message}`);
    }
  }

  console.log('\n📊 Backfill Complete:');
  console.log(`   Processed: ${processed} leads`);
  console.log(`   Tagged: ${tagged} contacts`);
  console.log(`   Queued: ${queued} emails`);
  console.log(`   Skipped: ${skipped} (already had tag)`);
}

backfill().catch(console.error);
