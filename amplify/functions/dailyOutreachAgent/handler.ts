import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';
import { getValidGhlToken } from '../shared/ghlTokenManager';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const GHL_INTEGRATION_TABLE = process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME || process.env.GHL_INTEGRATION_TABLE;

interface GhlIntegration {
  id: string;
  userId: string;
  accessToken: string;
  locationId: string;
}

/**
 * Daily Outreach Agent
 * 
 * Runs daily to:
 * 1. Check GHL for new contacts
 * 2. Find contacts with no conversation history
 * 3. Send initial outreach message using AI
 * 
 * COMPLIANCE:
 * - Only sends messages during business hours (9 AM - 8 PM EST)
 * - Rate limited to 2 seconds between messages
 * - Respects Do Not Contact status
 */
export const handler = async (event: any) => {
  console.log('📤 Daily Outreach Agent starting...');
  
  // Check if we're within business hours (9 AM - 8 PM EST)
  const now = new Date();
  const estHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours();
  
  if (estHour < 9 || estHour >= 20) {
    console.log(`⏰ Outside business hours (${estHour}:00 EST). Skipping outreach to comply with carrier regulations.`);
    return { statusCode: 200, message: 'Outside business hours', contactsProcessed: 0 };
  }
  
  console.log(`✅ Within business hours (${estHour}:00 EST). Proceeding with outreach.`);
  
  try {
    // 1. Get all active GHL integrations
    const integrations = await getAllActiveIntegrations();
    
    if (integrations.length === 0) {
      console.log('✅ No active GHL integrations found');
      return { statusCode: 200, contactsProcessed: 0 };
    }
    
    let totalProcessed = 0;
    
    // 2. Process each user's GHL account
    for (const integration of integrations) {
      try {
        const processed = await processUserContacts(integration);
        totalProcessed += processed;
      } catch (error) {
        console.error(`Failed to process user ${integration.userId}:`, error);
      }
    }
    
    console.log(`✅ Daily outreach complete. Processed ${totalProcessed} new contacts`);
    
    return {
      statusCode: 200,
      contactsProcessed: totalProcessed
    };
    
  } catch (error) {
    console.error('❌ Daily outreach agent error:', error);
    throw error;
  }
};

async function getAllActiveIntegrations(): Promise<GhlIntegration[]> {
  const command = new ScanCommand({
    TableName: GHL_INTEGRATION_TABLE,
    FilterExpression: 'attribute_exists(accessToken)'
  });
  
  const result = await docClient.send(command);
  return (result.Items || []) as GhlIntegration[];
}

async function processUserContacts(integration: GhlIntegration): Promise<number> {
  console.log(`Processing contacts for user ${integration.userId}`);
  
  try {
    // 1. Get valid GHL token (auto-refreshes if expired)
    const accessToken = await getValidGhlToken(integration.userId);
    if (!accessToken) {
      console.error(`Failed to get valid token for user ${integration.userId}`);
      return 0;
    }

    // Update integration with fresh token
    const integrationWithToken = { ...integration, accessToken };

    // 2. Get all contacts from GHL
    const contacts = await fetchGHLContacts(integrationWithToken);
    
    // 3. Filter to contacts with no conversation history
    const newContacts = await filterNewContacts(contacts, integrationWithToken);
    
    console.log(`Found ${newContacts.length} new contacts without outreach`);
    
    // 4. Send initial outreach to each new contact
    let processed = 0;
    for (const contact of newContacts) {
      try {
        await sendInitialOutreach(contact, integrationWithToken);
        processed++;
        
        // Rate limiting: wait 2 seconds between messages
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to send outreach to contact ${contact.id}:`, error);
      }
    }
    
    return processed;
    
  } catch (error) {
    console.error(`Error processing user contacts:`, error);
    return 0;
  }
}

async function fetchGHLContacts(integration: GhlIntegration): Promise<any[]> {
  const allContacts: any[] = [];
  let nextCursor: string | undefined;
  
  do {
    const url = nextCursor 
      ? `https://services.leadconnectorhq.com/contacts/?locationId=${integration.locationId}&limit=100&cursor=${nextCursor}`
      : `https://services.leadconnectorhq.com/contacts/?locationId=${integration.locationId}&limit=100`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${integration.accessToken}`,
        'Version': '2021-07-28'
      }
    });
    
    allContacts.push(...(response.data.contacts || []));
    nextCursor = response.data.meta?.nextCursor;
    
  } while (nextCursor);
  
  return allContacts;
}

async function filterNewContacts(contacts: any[], integration: GhlIntegration): Promise<any[]> {
  const newContacts: any[] = [];
  
  for (const contact of contacts) {
    // Skip if marked "Do Not Contact"
    if (contact.dnd === true || contact.dndSettings?.all?.status === 'active') {
      console.log(`⏭️ Skipping ${contact.firstName} ${contact.lastName} - Do Not Contact`);
      continue;
    }

    // Check if contact has required tag (AI Outreach)
    const hasTags = contact.tags && Array.isArray(contact.tags);
    const hasAIOutreachTag = hasTags && contact.tags.some((tag: string) => 
      tag.toLowerCase().includes('ai outreach') || 
      tag.toLowerCase().includes('ai-outreach')
    );

    if (!hasAIOutreachTag) {
      console.log(`⏭️ Skipping ${contact.firstName} ${contact.lastName} - Missing AI Outreach tag`);
      continue;
    }

    // Check if contact has any conversation history
    try {
      const conversationResponse = await axios.get(
        `https://services.leadconnectorhq.com/conversations/search?contactId=${contact.id}`,
        {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Version': '2021-07-28'
          }
        }
      );
      
      const conversations = conversationResponse.data.conversations || [];
      
      // If no conversations or no messages in conversations, this is a new contact
      if (conversations.length === 0) {
        console.log(`✅ New contact: ${contact.firstName} ${contact.lastName}`);
        newContacts.push(contact);
      } else {
        // Check if any conversation has messages
        const hasMessages = conversations.some((conv: any) => 
          conv.lastMessageBody || conv.lastMessageDate
        );
        
        if (!hasMessages) {
          console.log(`✅ Contact with no messages: ${contact.firstName} ${contact.lastName}`);
          newContacts.push(contact);
        }
      }
      
    } catch (error) {
      console.error(`Error checking conversation for contact ${contact.id}:`, error);
    }
  }
  
  return newContacts;
}

async function sendInitialOutreach(contact: any, integration: GhlIntegration): Promise<void> {
  console.log(`Sending initial outreach to ${contact.firstName} ${contact.lastName}`);
  
  // Call the existing API endpoint to send outreach
  const apiUrl = process.env.API_ENDPOINT || 'https://leads.JoseTheRealtor.com';
  
  try {
    const response = await axios.post(
      `${apiUrl}/api/v1/send-test-to-contact`,
      {
        contactId: contact.id
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`✅ Sent outreach to ${contact.firstName} ${contact.lastName}`);
    
  } catch (error: any) {
    console.error(`Failed to send outreach:`, error.response?.data || error.message);
    throw error;
  }
}
