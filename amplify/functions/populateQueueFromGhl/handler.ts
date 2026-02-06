import type { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const GHL_INTEGRATION_TABLE = process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME!;
const OUTREACH_QUEUE_TABLE = process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME!;

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

  for (const integration of integrations) {
    if (!integration.accessToken || !integration.locationId) {
      console.log(`⚠️ Skipping integration for user ${integration.userId} - missing credentials`);
      continue;
    }

    console.log(`\n👤 Processing user ${integration.userId}`);

    // Fetch all contacts with pagination
    let allContacts: GHLContact[] = [];
    let startAfter: number | undefined;
    let startAfterId: string | undefined;
    let page = 1;

    while (true) {
      let url = `https://services.leadconnectorhq.com/contacts/?locationId=${integration.locationId}&limit=100`;
      if (startAfter && startAfterId) {
        url += `&startAfter=${startAfter}&startAfterId=${startAfterId}`;
      }

      try {
        const response = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
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
    console.log(`📊 Total contacts: ${allContacts.length}`);

    // Filter for "ai outreach" tag
    const aiOutreachContacts = allContacts.filter(contact =>
      contact.tags && contact.tags.includes('ai outreach')
    );

    console.log(`📊 AI outreach contacts: ${aiOutreachContacts.length}`);

    // Add to queue
    for (const contact of aiOutreachContacts) {
      try {
        // Add SMS entry
        if (contact.phone) {
          await dynamodb.send(new PutCommand({
            TableName: OUTREACH_QUEUE_TABLE,
            Item: {
              id: `${contact.id}-${contact.phone}-SMS`,
              userId: integration.userId,
              locationId: integration.locationId,
              contactId: contact.id,
              contactMethod: contact.phone,
              channel: 'SMS',
              status: 'PENDING',
              touchNumber: 1,
              nextTouchDate: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          }));
          totalAdded++;
          console.log(`✅ Added SMS: ${contact.firstName} ${contact.lastName}`);
        }

        // Add EMAIL entries
        const emails = [contact.email, ...(contact.additionalEmails || [])].filter(Boolean);
        for (const email of emails) {
          await dynamodb.send(new PutCommand({
            TableName: OUTREACH_QUEUE_TABLE,
            Item: {
              id: `${contact.id}-${email}-EMAIL`,
              userId: integration.userId,
              locationId: integration.locationId,
              contactId: contact.id,
              contactMethod: email,
              channel: 'EMAIL',
              status: 'PENDING',
              touchNumber: 1,
              nextTouchDate: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          }));
          totalAdded++;
          console.log(`✅ Added EMAIL: ${contact.firstName} ${contact.lastName}`);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err: any) {
        console.error(`❌ Failed to add ${contact.firstName} ${contact.lastName}: ${err.message}`);
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      totalContacts,
      totalAdded,
      integrations: integrations.length
    })
  };
};
