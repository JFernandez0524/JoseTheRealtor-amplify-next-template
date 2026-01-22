/**
 * INBOUND MESSAGE POLLER
 * 
 * Polls GHL conversations for new inbound messages and generates AI responses.
 * This is a workaround for GHL plans that don't support webhooks.
 * 
 * SCHEDULE:
 * - Runs every 10 minutes
 * - Only processes during business hours
 * 
 * WORKFLOW:
 * 1. Get all active GHL integrations
 * 2. For each integration:
 *    a. Fetch recent conversations (last 15 minutes)
 *    b. Find conversations with new inbound messages
 *    c. Check if message needs AI response
 *    d. Generate and send AI response
 * 3. Track processed messages to avoid duplicates
 * 
 * RELATED FILES:
 * - /utils/ai/conversationHandler - AI response generator
 * - shared/ghlTokenManager - OAuth token management
 * - shared/businessHours - Business hours checker
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';
import { getValidGhlToken } from '../shared/ghlTokenManager';
import { isWithinBusinessHours, getNextBusinessHourMessage } from '../shared/businessHours';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const GHL_INTEGRATION_TABLE = process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME || process.env.GHL_INTEGRATION_TABLE;

interface GhlIntegration {
  id: string;
  userId: string;
  accessToken: string;
  locationId: string;
}

export const handler = async (event: any) => {
  console.log('🔍 [POLLER] Starting inbound message poller');
  
  // Check business hours
  if (!isWithinBusinessHours()) {
    const message = getNextBusinessHourMessage();
    console.log(`⏰ [POLLER] ${message}`);
    return { statusCode: 200, message };
  }
  
  console.log('✅ [POLLER] Within business hours. Proceeding.');
  
  try {
    // Get all active integrations
    const integrations = await getAllActiveIntegrations();
    
    if (integrations.length === 0) {
      console.log('✅ No active GHL integrations found');
      return { statusCode: 200, messagesProcessed: 0 };
    }
    
    let totalProcessed = 0;
    
    // Process each integration
    for (const integration of integrations) {
      try {
        const processed = await processInboundMessages(integration);
        totalProcessed += processed;
      } catch (error) {
        console.error(`Failed to process integration ${integration.userId}:`, error);
      }
    }
    
    console.log(`✅ Poller complete. Processed ${totalProcessed} inbound messages`);
    
    return {
      statusCode: 200,
      messagesProcessed: totalProcessed
    };
    
  } catch (error) {
    console.error('❌ Poller error:', error);
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
  console.log(`📊 [POLLER] Found ${result.Items?.length || 0} active integrations`);
  return (result.Items || []) as GhlIntegration[];
}

async function processInboundMessages(integration: GhlIntegration): Promise<number> {
  console.log(`📋 [POLLER] Processing integration for user ${integration.userId}`);
  
  try {
    // Get valid token
    const ghlData = await getValidGhlToken(integration.userId);
    if (!ghlData) {
      console.error(`Failed to get valid token for user ${integration.userId}`);
      return 0;
    }

    const { token: accessToken, locationId } = ghlData;
    
    // Get conversations with recent activity (last 15 minutes)
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
    
    const conversationsResponse = await axios.get(
      `https://services.leadconnectorhq.com/conversations/search`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28'
        },
        params: {
          locationId: locationId,
          limit: 50
        }
      }
    );
    
    const conversations = conversationsResponse.data?.conversations || [];
    console.log(`📬 [POLLER] Found ${conversations.length} conversations`);
    
    let processed = 0;
    
    // Check each conversation for new inbound messages
    for (const conversation of conversations) {
      try {
        // Get messages from this conversation
        const messagesResponse = await axios.get(
          `https://services.leadconnectorhq.com/conversations/${conversation.id}/messages`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Version': '2021-07-28'
            },
            params: {
              limit: 5 // Just check last 5 messages
            }
          }
        );
        
        const messages = messagesResponse.data?.messages || [];
        
        // Find most recent inbound message
        const lastInbound = messages.find((m: any) => m.direction === 'inbound');
        const lastOutbound = messages.find((m: any) => m.direction === 'outbound');
        
        // If last message is inbound and no outbound after it, respond
        if (lastInbound && (!lastOutbound || new Date(lastInbound.dateAdded) > new Date(lastOutbound.dateAdded))) {
          const messageAge = Date.now() - new Date(lastInbound.dateAdded).getTime();
          
          // Only respond to messages from last 15 minutes
          if (messageAge < 15 * 60 * 1000) {
            console.log(`💬 [POLLER] New inbound message in conversation ${conversation.id}`);
            
            // Call webhook handler to process
            await axios.post(
              `${process.env.API_ENDPOINT}/api/v1/ghl-webhook`,
              {
                type: 'InboundMessage',
                contactId: conversation.contactId,
                conversationId: conversation.id,
                locationId: locationId,
                message: {
                  body: lastInbound.body,
                  direction: 'inbound'
                }
              }
            );
            
            processed++;
            
            // Rate limit: 2 seconds between responses
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      } catch (convError) {
        console.error(`Error processing conversation ${conversation.id}:`, convError);
      }
    }
    
    return processed;
    
  } catch (error: any) {
    console.error(`Error processing inbound messages:`, error.response?.data || error.message);
    return 0;
  }
}
