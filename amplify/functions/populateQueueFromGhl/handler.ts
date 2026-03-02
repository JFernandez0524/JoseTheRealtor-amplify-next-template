import type { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getValidGhlToken } from '../shared/ghlTokenManager';
import { addToOutreachQueue } from '../shared/outreachQueue';
import axios from 'axios';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const GHL_INTEGRATION_TABLE = process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME!;

interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  additionalEmails?: string[];
  tags?: string[];
}

export const handler: Handler = async () => {
  console.log('🚀 Starting queue population from GHL...');

  // Get all GHL integrations
  const result = await dynamodb.send(new ScanCommand({
    TableName: GHL_INTEGRATION_TABLE
  }));

  const integrations = result.Items || [];
  console.log(`Found ${integrations.length} GHL integrations`);

  let totalAdded = 0;
  let totalContacts = 0;
  let aiOutreachTotal = 0;

  for (const integration of integrations) {
    console.log(`\n👤 Processing user ${integration.userId}`);
    
    const tokenData = await getValidGhlToken(integration.userId);
    
    if (!tokenData) {
      console.log(`⚠️ No valid GHL credentials for user ${integration.userId}`);
      continue;
    }

    console.log(`✅ Found GHL credentials for location ${tokenData.locationId}`);

    // Fetch all contacts with pagination
    let allContacts: GHLContact[] = [];
    let startAfter: number | undefined;
    let startAfterId: string | undefined;
    let page = 1;

    while (true) {
      let url = `https://services.leadconnectorhq.com/contacts/?locationId=${tokenData.locationId}&limit=100`;
      if (startAfter && startAfterId) {
        url += `&startAfter=${startAfter}&startAfterId=${startAfterId}`;
      }

      try {
        const response = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${tokenData.token}`,
            'Version': '2021-07-28'
          }
        });

        const contacts = response.data.contacts || [];
        console.log(`📄 Page ${page}: ${contacts.length} contacts`);

        if (contacts.length === 0) break;

        allContacts.push(...contacts);

        if (contacts.length === 100) {
          const lastContact = contacts[contacts.length - 1];
          if (lastContact.startAfter && lastContact.startAfter.length >= 2) {
            startAfter = lastContact.startAfter[0];
            startAfterId = lastContact.startAfter[1];
            page++;
          } else {
            break;
          }
        } else {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err: any) {
        console.error(`❌ Failed to fetch contacts: ${err.message}`);
        break;
      }
    }

    totalContacts += allContacts.length;
    console.log(`📊 Total contacts for user: ${allContacts.length}`);

    // Filter for "ai outreach" tag
    const aiOutreachContacts = allContacts.filter(contact =>
      contact.tags && contact.tags.includes('ai outreach')
    );

    aiOutreachTotal += aiOutreachContacts.length;
    console.log(`📊 AI outreach contacts for user: ${aiOutreachContacts.length}`);
    console.log(`Sample contact tags:`, aiOutreachContacts[0]?.tags);

    // Add to queue in batches (parallel processing)
    // Create one queue entry per email address (supports multiple emails per contact)
    const BATCH_SIZE = 25;
    const queueEntries: any[] = [];
    
    for (const contact of aiOutreachContacts) {
      const emails = [contact.email];
      if (contact.additionalEmails && contact.additionalEmails.length > 0) {
        emails.push(...contact.additionalEmails.filter((e): e is string => e !== null && e.length > 0));
      }
      
      // Create queue entry for each email
      for (const email of emails) {
        if (email) {
          queueEntries.push({
            userId: integration.userId,
            locationId: tokenData.locationId,
            contactId: contact.id,
            contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
            contactPhone: contact.phone,
            contactEmail: email,
          });
        }
      }
    }
    
    console.log(`📧 Created ${queueEntries.length} queue entries for ${aiOutreachContacts.length} contacts`);
    
    for (let i = 0; i < queueEntries.length; i += BATCH_SIZE) {
      const batch = queueEntries.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.allSettled(
        batch.map(entry => addToOutreachQueue(entry))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      totalAdded += succeeded;
      
      console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${succeeded} added, ${failed} failed`);
      
      // Log first failure for debugging
      const firstFailure = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
      if (firstFailure) {
        console.error(`❌ Sample error:`, firstFailure.reason?.message || firstFailure.reason);
      }
    }
  }

  const summary = {
    totalContacts,
    aiOutreachContacts: aiOutreachTotal,
    queueEntriesAdded: totalAdded,
    integrations: integrations.length
  };

  console.log('\n✅ Queue population complete:', summary);

  return JSON.stringify(summary);
};
