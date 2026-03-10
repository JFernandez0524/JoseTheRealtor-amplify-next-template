/**
 * BACKFILL AI OUTREACH FOR EXISTING CONTACTS
 * 
 * Adds "ai outreach" tag and OutreachQueue entries for contacts that were
 * synced before the fix (have phone + email but missing ai outreach tag).
 * 
 * Run this ONCE after deploying the fix to production.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const PROPERTY_LEAD_TABLE = 'PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE'; // Production table
const OUTREACH_QUEUE_TABLE = 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE'; // Production queue
const GHL_LOCATION_ID = 'mHaAy3ZaUHgrbPyughDG';
const GHL_TOKEN = 'pit-a975757c-04a0-446d-a23b-3ef1050ae32a';
const USER_ID = '44d8f4c8-10c1-7038-744b-271103170819'; // Admin user

interface Lead {
  id: string;
  ghlContactId?: string;
  emails?: string[];
  phones?: string[];
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerAddress?: string;
  ownerCity?: string;
  ownerState?: string;
  type?: string;
}

async function backfillAIOutreach() {
  console.log('🔍 Scanning for leads with ghlContactId + emails...');
  
  // Find all leads that have been synced to GHL and have emails
  const scanResult = await docClient.send(new ScanCommand({
    TableName: PROPERTY_LEAD_TABLE,
    FilterExpression: 'attribute_exists(ghlContactId) AND attribute_exists(emails)',
  }));

  const leads = (scanResult.Items || []) as Lead[];
  console.log(`📊 Found ${leads.length} synced leads with emails`);

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

  for (const lead of leads) {
    if (!lead.ghlContactId || !lead.emails?.length) continue;

    try {
      // Get contact from GHL to check current tags
      const contactRes = await ghl.get(`/contacts/${lead.ghlContactId}`);
      const contact = contactRes.data?.contact;
      
      if (!contact) {
        console.log(`⚠️ Contact ${lead.ghlContactId} not found in GHL`);
        continue;
      }

      const currentTags = contact.tags || [];
      const hasAIOutreach = currentTags.includes('ai outreach');

      if (hasAIOutreach) {
        console.log(`✓ Contact ${lead.ghlContactId} already has ai outreach tag`);
        processed++;
        continue;
      }

      // Add "ai outreach" tag
      await ghl.put(`/contacts/${lead.ghlContactId}`, {
        tags: [...currentTags, 'ai outreach'],
      });
      console.log(`✅ Added "ai outreach" tag to ${lead.ghlContactId}`);
      tagged++;

      // Add emails to OutreachQueue
      const emails = lead.emails.filter((e): e is string => !!e);
      
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
            contactPhone: undefined,
            queueStatus: 'OUTREACH',
            emailStatus: 'PENDING',
            emailAttempts: 0,
            nextEmailDate: new Date().toISOString(), // Send immediately
            propertyAddress: lead.ownerAddress,
            propertyCity: lead.ownerCity,
            propertyState: lead.ownerState,
            leadType: lead.type,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }));
        console.log(`✅ Added ${email} to OutreachQueue`);
        queued++;
      }

      processed++;
      
      // Rate limit: 2 seconds between contacts
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error: any) {
      console.error(`❌ Error processing lead ${lead.id}:`, error.message);
    }
  }

  console.log('\n📊 Backfill Complete:');
  console.log(`   Processed: ${processed} leads`);
  console.log(`   Tagged: ${tagged} contacts`);
  console.log(`   Queued: ${queued} emails`);
}

backfillAIOutreach().catch(console.error);
