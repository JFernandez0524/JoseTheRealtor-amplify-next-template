import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const GHL_INTEGRATION_TABLE = process.env.GHL_INTEGRATION_TABLE || 'GhlIntegration-Default';

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
 */
export const handler = async (event: any) => {
  console.log('📤 Daily Outreach Agent starting...');
  
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
    // 1. Get all contacts from GHL
    const contacts = await fetchGHLContacts(integration);
    
    // 2. Filter to contacts with no conversation history
    const newContacts = await filterNewContacts(contacts, integration);
    
    console.log(`Found ${newContacts.length} new contacts without outreach`);
    
    // 3. Send initial outreach to each new contact
    let processed = 0;
    for (const contact of newContacts) {
      try {
        await sendInitialOutreach(contact, integration);
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
        newContacts.push(contact);
      } else {
        // Check if any conversation has messages
        const hasMessages = conversations.some((conv: any) => 
          conv.lastMessageBody || conv.lastMessageDate
        );
        
        if (!hasMessages) {
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
