/**
 * BACKFILL AI OUTREACH FOR EXISTING CONTACTS
 *
 * For every lead with ghlContactId + emails:
 * 1. Ensures "ai outreach" tag exists in GHL
 * 2. Ensures OutreachQueue entries exist (one per email) — even if tag already present
 *
 * Safe to re-run: checks existing queue entries before inserting.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const PROPERTY_LEAD_TABLE = 'PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE';
const OUTREACH_QUEUE_TABLE = 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE';
const GHL_LOCATION_ID = 'mHaAy3ZaUHgrbPyughDG';
const GHL_TOKEN = 'pit-aabd68b5-1aec-4382-8ab4-f626f38bc997';
const USER_ID = '44d8f4c8-10c1-7038-744b-271103170819';

interface Lead {
  id: string;
  ghlContactId?: string;
  emails?: string[];
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerAddress?: string;
  ownerCity?: string;
  ownerState?: string;
  type?: string;
}

async function backfillAIOutreach() {
  console.log('🔍 Scanning for leads with ghlContactId + emails...');

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

  let tagged = 0;
  let queued = 0;
  let skipped = 0;

  for (const lead of leads) {
    if (!lead.ghlContactId || !lead.emails?.length) continue;

    try {
      // 1. Get contact from GHL
      const contactRes = await ghl.get(`/contacts/${lead.ghlContactId}`);
      const contact = contactRes.data?.contact;
      if (!contact) { console.log(`⚠️ Not found: ${lead.ghlContactId}`); continue; }

      const currentTags: string[] = contact.tags || [];

      // 2. Add tag if missing
      if (!currentTags.includes('ai outreach')) {
        await ghl.put(`/contacts/${lead.ghlContactId}`, {
          tags: [...currentTags, 'ai outreach'],
        });
        console.log(`✅ Tagged ${lead.ghlContactId}`);
        tagged++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 3. Check existing queue entries for this lead
     const existingQueue = await docClient.send(new ScanCommand({
  TableName: OUTREACH_QUEUE_TABLE,
  FilterExpression: 'contactId = :contactId',
  ExpressionAttributeValues: { ':contactId': lead.ghlContactId },
}));

      const existingEmails = new Set(
        (existingQueue.Items || []).map((item: any) => item.contactEmail).filter(Boolean)
      );

      // 4. Add queue entry for each email not already queued
      for (const email of lead.emails.filter(Boolean).slice(0, 3)) {
        if (existingEmails.has(email)) { skipped++; continue; }

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
        console.log(`✅ Queued ${email} for ${lead.ghlContactId}`);
        queued++;
      }

    } catch (error: any) {
      console.error(`❌ Error processing lead ${lead.id}:`, error.message);
    }
  }

  console.log('\n📊 Backfill Complete:');
  console.log(`   Tagged:  ${tagged} contacts`);
  console.log(`   Queued:  ${queued} new email entries`);
  console.log(`   Skipped: ${skipped} already in queue`);
}

backfillAIOutreach().catch(console.error);