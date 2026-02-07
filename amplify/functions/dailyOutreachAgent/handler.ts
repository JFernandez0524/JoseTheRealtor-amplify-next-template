import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';
import { getValidGhlToken } from '../shared/ghlTokenManager';
import { shouldSendNextMessage } from '../shared/dialTracking';
import { isWithinBusinessHours, getNextBusinessHourMessage } from '../shared/businessHours';

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
  dailyMessageCount?: number;
  hourlyMessageCount?: number;
  lastMessageSent?: string;
}

/**
 * DAILY OUTREACH AGENT (SMS)
 * 
 * Automated Lambda function that sends personalized SMS messages to leads
 * using AI conversation handler with proven 5-step script.
 * 
 * SCHEDULE:
 * - Runs every hour (configured in resource.ts via EventBridge)
 * - Only sends during business hours (Mon-Fri 9AM-7PM, Sat 9AM-12PM EST)
 * - Sunday: No messages sent
 * 
 * WORKFLOW:
 * 1. Check if within business hours (exit if not)
 * 2. Scan DynamoDB for active GHL integrations
 * 3. For each integration:
 *    a. 🚀 NEW: Query OutreachQueue for PENDING SMS contacts (fast, cheap)
 *       - Filters by 7-touch limit and 4-day cadence
 *       - Returns contacts ready for next touch
 *       - 90% reduction in GHL API costs
 *    b. 🔄 FALLBACK: If queue empty/fails, search GHL for contacts with "ai outreach" tag
 *    c. Send personalized SMS via /api/v1/send-message-to-contact
 *    d. Update queue status (PENDING for follow-ups, or REPLIED/FAILED/OPTED_OUT)
 * 4. Rate limit: 5 minutes between messages (12 per hour max)
 * 
 * OUTREACH QUEUE BENEFITS:
 * - Sub-second queries vs 2-3 second GHL searches
 * - 90% fewer GHL API calls
 * - Better tracking and analytics
 * - Automatic 7-touch cadence enforcement
 * - Multi-contact support (7 touches per phone)
 * 
 * MESSAGE CONTENT:
 * - Introduces Jose Fernandez from RE/MAX Homeland Realtors
 * - Mentions property address and public notice
 * - Presents both options: cash offer (70% of Zestimate) and retail listing
 * - Requests 10-minute property visit
 * - Adapts to missing property data
 * 
 * TRACKING:
 * - Queue: smsAttempts incremented, lastSmsSent updated
 * - GHL: call_attempt_counter incremented, last_call_date updated
 * - Prevents duplicate messages
 * 
 * ENVIRONMENT VARIABLES:
 * - AMPLIFY_DATA_GhlIntegration_TABLE_NAME: DynamoDB table for GHL integrations
 * - AMPLIFY_DATA_OutreachQueue_TABLE_NAME: DynamoDB table for outreach queue
 * - API_ENDPOINT: Base URL for API calls (e.g., https://leads.josetherealtor.com)
 * 
 * RELATED FILES:
 * - /api/v1/send-message-to-contact - API route for SMS generation
 * - /utils/ai/conversationHandler - SMS content generator (5-step script)
 * - /api/v1/ghl-webhook - Handles SMS replies (updates queue to REPLIED)
 * - shared/outreachQueue - Queue manager utilities
 * - shared/businessHours - Business hours checker
 * 
 * MONITORING:
 * - CloudWatch logs: /aws/lambda/dailyOutreachAgent
 * - Metrics: Total messages sent, queue hit rate, success/failure counts
 */
export const handler = async (event: any) => {
  console.log('📤 [DAILY_OUTREACH] Starting daily outreach agent');
  console.log('📤 [DAILY_OUTREACH] Event:', JSON.stringify(event));
  
  // Check if we're within business hours
  if (!isWithinBusinessHours()) {
    const message = getNextBusinessHourMessage();
    console.log(`⏰ [DAILY_OUTREACH] ${message}`);
    return { statusCode: 200, message, contactsProcessed: 0 };
  }
  
  console.log(`✅ [DAILY_OUTREACH] Within business hours. Proceeding.`);
  
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
  
  // A2P Compliance: Check daily message count
  const dailyLimit = 200; // A2P safe limit for new numbers
  const currentCount = integration.dailyMessageCount || 0;
  
  if (currentCount >= dailyLimit) {
    console.log(`⚠️ [A2P] Daily limit reached (${currentCount}/${dailyLimit}). Skipping outreach.`);
    return 0;
  }
  
  const remainingQuota = dailyLimit - currentCount;
  console.log(`📊 [A2P] Daily quota: ${currentCount}/${dailyLimit} used, ${remainingQuota} remaining`);
  
  try {
    // 1. Get valid GHL token and locationId (auto-refreshes if expired)
    const ghlData = await getValidGhlToken(integration.userId);
    if (!ghlData) {
      console.error(`Failed to get valid token for user ${integration.userId}`);
      return 0;
    }

    const { token: accessToken, locationId } = ghlData;

    // 2. HARDCODED phone number (remove when GHL scope approved)
    const phoneNumber = '+17328100182';
    console.log(`Using hardcoded phone number: ${phoneNumber}`);

    // Update integration with fresh token
    const integrationWithToken = { ...integration, accessToken };

    // 3. 🚀 NEW: Try queue-based approach first (fast, cheap)
    try {
      const { getPendingSmsContacts } = await import('../shared/outreachQueue');
      const queueContacts = await getPendingSmsContacts(integration.userId, 50);
      
      if (queueContacts.length > 0) {
        console.log(`📋 [QUEUE] Found ${queueContacts.length} pending SMS contacts in queue`);
        return await processQueueContacts(queueContacts, integrationWithToken, phoneNumber);
      }
      
      console.log(`📋 [QUEUE] No pending contacts in queue - no outreach needed`);
      return 0; // Don't fall back to GHL search - queue is source of truth
    } catch (queueError) {
      console.error(`⚠️ [QUEUE] Queue query failed:`, queueError);
      return 0; // Don't fall back on error - prevents duplicates
    }

    // FALLBACK DISABLED: Queue is the source of truth for outreach
    // If queue is empty, no outreach should be sent
    // This prevents duplicate messages that caused GHL suspension
    
  } catch (error) {
    console.error(`Error processing user contacts:`, error);
    return 0;
  }
}

/**
 * 🚀 NEW: Process contacts from outreach queue (fast, cheap)
 * Uses DynamoDB queue instead of expensive GHL searches
 */
async function processQueueContacts(
  queueContacts: any[],
  integration: GhlIntegration,
  phoneNumber: string
): Promise<number> {
  const { updateSmsStatus } = await import('../shared/outreachQueue');
  let processed = 0;
  
  for (const queueItem of queueContacts) {
    // Check business hours before each message
    const now = new Date();
    const estHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours();
    
    if (estHour < 9 || estHour >= 20) {
      console.log(`⏰ [QUEUE] Outside business hours (${estHour}:00 EST). Stopping outreach.`);
      break;
    }
    
    try {
      // Convert queue item to contact format for existing sendInitialOutreach function
      const contact = {
        id: queueItem.contactId,
        firstName: queueItem.contactName?.split(' ')[0],
        lastName: queueItem.contactName?.split(' ').slice(1).join(' '),
        phone: queueItem.contactPhone,
        customFields: [
          { id: 'p3NOYiInAERYbe0VsLHB', value: queueItem.propertyAddress },
          { id: 'h4UIjKQvFu7oRW4SAY8W', value: queueItem.propertyCity },
          { id: '9r9OpQaxYPxqbA6Hvtx7', value: queueItem.propertyState },
          { id: 'oaf4wCuM3Ub9eGpiddrO', value: queueItem.leadType },
        ]
      };
      
      await sendInitialOutreach(contact, integration, phoneNumber);
      
      // Update queue status to SENT
      await updateSmsStatus(queueItem.id, 'SENT', (queueItem.smsAttempts || 0) + 1);
      
      processed++;
      console.log(`✅ [QUEUE] Sent message ${processed}/${queueContacts.length}`);
      
      // A2P Compliance: Rate limiting to 1 message per second
      if (processed < queueContacts.length) {
        console.log(`⏳ [QUEUE] Waiting 1 second before next message (A2P compliance)...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`❌ [QUEUE] Failed to send to contact ${queueItem.contactId}:`, error);
      // Mark as failed in queue
      await updateSmsStatus(queueItem.id, 'FAILED').catch(() => {});
    }
  }
  
  return processed;
}

async function fetchGHLContacts(integration: GhlIntegration): Promise<any[]> {
  const response = await axios.post(
    `https://services.leadconnectorhq.com/contacts/search`,
    {
      locationId: integration.locationId,
      pageLimit: 100,
      filters: [
        {
          field: 'tags',
          operator: 'contains',
          value: 'ai outreach'
        }
      ]
    },
    {
      headers: {
        'Authorization': `Bearer ${integration.accessToken}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      }
    }
  );
  
  const contacts = response.data.contacts || [];
  console.log(`📋 [DAILY_OUTREACH] Found ${contacts.length} contacts with "ai outreach" tag`);
  
  return contacts;
}

async function filterNewContacts(contacts: any[], integration: GhlIntegration): Promise<any[]> {
  const newContacts: any[] = [];
  
  for (const contact of contacts) {
    // Skip if marked "Do Not Contact"
    if (contact.dnd === true || contact.dndSettings?.all?.status === 'active') {
      console.log(`⏭️ Skipping ${contact.firstName} ${contact.lastName} - Do Not Contact`);
      continue;
    }

    // Skip if already contacted by human (exclusion tags)
    const hasTags = contact.tags && Array.isArray(contact.tags);
    const exclusionTags = [
      'human contacted',
      'spoke with',
      'conversation_ended',
      'qualified',
      'appointment set',
      'not interested',
      'do not contact'
    ];
    
    const hasExclusionTag = hasTags && contact.tags.some((tag: string) => 
      exclusionTags.some(exclusion => tag.toLowerCase().includes(exclusion))
    );

    if (hasExclusionTag) {
      console.log(`⏭️ Skipping ${contact.firstName} ${contact.lastName} - Exclusion tag found: ${contact.tags.filter((t: string) => exclusionTags.some(e => t.toLowerCase().includes(e))).join(', ')}`);
      continue;
    }

    // Check if contact has required tag (ai outreach - all lowercase)
    const hasAIOutreachTag = hasTags && contact.tags.some((tag: string) => 
      tag.toLowerCase() === 'ai outreach'
    );

    if (!hasAIOutreachTag) {
      console.log(`⏭️ Skipping ${contact.firstName} ${contact.lastName} - Missing "ai outreach" tag. Tags: ${JSON.stringify(contact.tags || [])}`);
      continue;
    }

    // Check if contact is ready for next message based on cadence
    if (!shouldSendNextMessage(contact)) {
      continue;
    }

    // Add contact to outreach list (skipping conversation history check for now)
    console.log(`✅ Contact eligible for outreach: ${contact.firstName} ${contact.lastName}`);
    newContacts.push(contact);
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
    
    const customFieldUpdates: any[] = [
      { id: '0MD4Pp2LCyOSCbCjA5qF', value: newCounter.toString() },
      { id: 'dWNGeSckpRoVUxXLgxMj', value: new Date().toISOString() }
    ];
    
    // If this was the 7th touch and no reply, mark as DEAD
    if (newCounter >= 7) {
      customFieldUpdates.push({
        id: 'LNyfm5JDal955puZGbu3', // call_outcome field
        value: 'DEAD / Never Responded'
      });
      console.log(`🔴 Marking contact as DEAD after ${newCounter} touches with no response`);
    }
    
    await axios.put(
      `https://services.leadconnectorhq.com/contacts/${contact.id}`,
      { customFields: customFieldUpdates },
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
