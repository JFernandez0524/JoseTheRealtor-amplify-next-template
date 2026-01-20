import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';
import { getValidGhlToken } from '../shared/ghlTokenManager';
import { shouldSendNextMessage } from '../shared/dialTracking';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const GHL_INTEGRATION_TABLE = process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME || process.env.GHL_INTEGRATION_TABLE;

console.log('🔧 [DAILY_OUTREACH] Lambda initialized');
console.log('🔧 [DAILY_OUTREACH] Environment:', {
  hasGhlIntegrationTable: !!GHL_INTEGRATION_TABLE,
  region: process.env.AWS_REGION,
  apiEndpoint: process.env.API_ENDPOINT
});

interface GhlIntegration {
  id: string;
  userId: string;
  accessToken: string;
  locationId: string;
  selectedPhoneNumber?: string;
  campaignPhone?: string;
  selectedEmail?: string;
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
  console.log('📤 [DAILY_OUTREACH] Starting daily outreach agent');
  console.log('📤 [DAILY_OUTREACH] Event:', JSON.stringify(event));
  
  // Check if we're within business hours (9 AM - 8 PM EST)
  const now = new Date();
  const estHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours();
  
  console.log(`⏰ [DAILY_OUTREACH] Current EST hour: ${estHour}`);
  
  if (estHour < 9 || estHour >= 20) {
    console.log(`⏰ [DAILY_OUTREACH] Outside business hours (${estHour}:00 EST). Skipping outreach.`);
    return { statusCode: 200, message: 'Outside business hours', contactsProcessed: 0 };
  }
  
  console.log(`✅ [DAILY_OUTREACH] Within business hours (${estHour}:00 EST). Proceeding.`);
  
  try {
    // 1. Get all active GHL integrations
    console.log('🔍 [DAILY_OUTREACH] Fetching active integrations...');
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
    FilterExpression: 'isActive = :true AND attribute_exists(accessToken)',
    ExpressionAttributeValues: {
      ':true': true
    }
  });
  
  const result = await docClient.send(command);
  console.log(`📊 [DAILY_OUTREACH] Found ${result.Items?.length || 0} active integrations`);
  return (result.Items || []) as GhlIntegration[];
}

async function processUserContacts(integration: GhlIntegration): Promise<number> {
  console.log(`Processing contacts for user ${integration.userId}`);
  
  try {
    // 1. Get valid GHL token and locationId (auto-refreshes if expired)
    const ghlData = await getValidGhlToken(integration.userId);
    if (!ghlData) {
      console.error(`Failed to get valid token for user ${integration.userId}`);
      return 0;
    }

    const { token: accessToken, locationId } = ghlData;

    // 2. Get user's phone number from database or GHL
    const phoneNumber = await getGhlPhoneNumber(accessToken, locationId, integration.campaignPhone || integration.selectedPhoneNumber);
    if (!phoneNumber) {
      console.error(`No phone number found for location ${locationId}`);
      return 0;
    }
    
    console.log(`Using phone number: ${phoneNumber}`);

    // Update integration with fresh token
    const integrationWithToken = { ...integration, accessToken };

    // 3. Get all contacts from GHL
    const contacts = await fetchGHLContacts(integrationWithToken);
    
    // 4. Filter to contacts with no conversation history
    const newContacts = await filterNewContacts(contacts, integrationWithToken);
    
    console.log(`Found ${newContacts.length} new contacts without outreach`);
    
    // 5. Send initial outreach to each new contact
    let processed = 0;
    for (const contact of newContacts) {
      // Check business hours before each message
      const now = new Date();
      const estHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours();
      
      if (estHour < 9 || estHour >= 20) {
        console.log(`⏰ [DAILY_OUTREACH] Outside business hours (${estHour}:00 EST). Stopping outreach.`);
        break; // Stop processing remaining contacts
      }
      
      try {
        await sendInitialOutreach(contact, integrationWithToken, phoneNumber);
        processed++;
        console.log(`✅ [DAILY_OUTREACH] Sent message ${processed}/${newContacts.length}`);
        
        // Rate limiting: wait 5 minutes between messages
        if (processed < newContacts.length) {
          console.log(`⏳ [DAILY_OUTREACH] Waiting 5 minutes before next message...`);
          await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes = 300,000ms
        }
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

    // Check if contact is ready for next message based on cadence
    if (!shouldSendNextMessage(contact)) {
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
      
      // If no conversations, this is a new contact
      if (conversations.length === 0) {
        console.log(`✅ New contact: ${contact.firstName} ${contact.lastName}`);
        newContacts.push(contact);
        continue;
      }
      
      // Check if any conversation has INBOUND messages (replies from contact)
      let hasInboundMessages = false;
      for (const conv of conversations) {
        try {
          const messagesResponse = await axios.get(
            `https://services.leadconnectorhq.com/conversations/${conv.id}/messages`,
            {
              headers: {
                'Authorization': `Bearer ${integration.accessToken}`,
                'Version': '2021-07-28'
              }
            }
          );
          
          const messages = messagesResponse.data.messages || [];
          hasInboundMessages = messages.some((msg: any) => msg.direction === 'inbound');
          
          if (hasInboundMessages) break;
        } catch (error) {
          console.error(`Error fetching messages for conversation ${conv.id}:`, error);
        }
      }
      
      // If contact has replied, skip automated outreach (AI webhook handles responses)
      if (hasInboundMessages) {
        console.log(`💬 Contact ${contact.firstName} ${contact.lastName} has replied - skipping automated outreach`);
        continue;
      }
      
      // Contact has outbound messages but no replies - eligible for follow-up
      console.log(`🔄 Follow-up candidate: ${contact.firstName} ${contact.lastName}`);
      newContacts.push(contact);
      
    } catch (error) {
      console.error(`Error checking conversation for contact ${contact.id}:`, error);
    }
  }
  
  return newContacts;
}

async function sendInitialOutreach(contact: any, integration: GhlIntegration, phoneNumber: string): Promise<void> {
  console.log(`Sending initial outreach to ${contact.firstName} ${contact.lastName}`);
  
  const apiUrl = process.env.API_ENDPOINT || 'https://leads.JoseTheRealtor.com';
  
  try {
    const response = await axios.post(
      `${apiUrl}/api/v1/send-message-to-contact`,
      { contactId: contact.id, accessToken: integration.accessToken, fromNumber: phoneNumber },
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    console.log(`✅ Sent outreach to ${contact.firstName} ${contact.lastName}`);
    
    // Increment dial counter after successful send
    const currentCounter = parseInt(contact.customFields?.find((f: any) => f.id === '0MD4Pp2LCyOSCbCjA5qF')?.value || '0');
    const newCounter = currentCounter + 1;
    
    await axios.put(
      `https://services.leadconnectorhq.com/contacts/${contact.id}`,
      {
        customFields: [
          { id: '0MD4Pp2LCyOSCbCjA5qF', value: newCounter.toString() },
          { id: 'dWNGeSckpRoVUxXLgxMj', value: new Date().toISOString() }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${integration.accessToken}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );
    
    console.log(`📊 Updated dial counter to ${newCounter} for ${contact.firstName} ${contact.lastName}`);
    
  } catch (error: any) {
    console.error(`Failed to send outreach:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get user's phone numbers from GHL and return selected, default, or first available
 */
async function getGhlPhoneNumber(accessToken: string, locationId: string, selectedNumber?: string): Promise<string | null> {
  try {
    // If user has selected a specific number, use it
    if (selectedNumber) {
      console.log(`Using user-selected phone number: ${selectedNumber}`);
      return selectedNumber;
    }

    // Fetch all phone numbers for the location
    const response = await axios.get(
      `https://services.leadconnectorhq.com/phone-system/numbers/location/${locationId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28'
        }
      }
    );
    
    const phoneNumbers = response.data.numbers || [];
    
    if (phoneNumbers.length === 0) {
      console.error('No phone numbers found for location');
      return null;
    }
    
    // Find the default number or use the first one
    const defaultNumber = phoneNumbers.find((p: any) => p.isDefault === true);
    const selectedPhone = defaultNumber || phoneNumbers[0];
    const phoneNumber = selectedPhone.phoneNumber || selectedPhone.number;
    
    console.log(`Using phone number: ${phoneNumber} (${selectedPhone.isDefault ? 'default' : 'first available'})`);
    
    return phoneNumber;
  } catch (error: any) {
    console.error('Failed to get GHL phone numbers:', error.response?.data || error.message);
    return null;
  }
}
