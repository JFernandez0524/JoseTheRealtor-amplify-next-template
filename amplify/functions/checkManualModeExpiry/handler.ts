/**
 * CHECK MANUAL MODE EXPIRY - Lambda Function
 * 
 * Runs hourly to check for expired manual mode conversations.
 * Auto-resumes AI after 24 hours of complete inactivity.
 * 
 * WORKFLOW:
 * 1. Query GHL for all contacts with "conversation:manual" tag
 * 2. For each contact, check conversation history
 * 3. If no activity (inbound or outbound) in last 24 hours, remove tag
 * 4. Add note and reset OutreachQueue status
 * 
 * ENVIRONMENT VARIABLES:
 * - AMPLIFY_DATA_GhlIntegration_TABLE_NAME
 * - AMPLIFY_DATA_OutreachQueue_TABLE_NAME
 * - GHL_CLIENT_ID
 * - GHL_CLIENT_SECRET
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { validateEnv } from '../shared/config';
import { logError } from '../shared/logger';

validateEnv('checkManualModeExpiry');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const GHL_INTEGRATION_TABLE = process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME!;

export const handler = async () => {
  console.log('🔄 [EXPIRY_CHECK] Starting manual mode expiry check');
  
  try {
    // Get all active GHL integrations
    const { Items: integrations } = await docClient.send(new ScanCommand({
      TableName: GHL_INTEGRATION_TABLE,
      FilterExpression: 'isActive = :active',
      ExpressionAttributeValues: {
        ':active': true
      }
    }));

    if (!integrations || integrations.length === 0) {
      console.log('⚠️ [EXPIRY_CHECK] No active integrations found');
      return { statusCode: 200, body: 'No integrations to check' };
    }

    console.log(`📊 [EXPIRY_CHECK] Checking ${integrations.length} integration(s)`);

    let totalChecked = 0;
    let totalResumed = 0;

    // Check each integration
    for (const integration of integrations) {
      const { userId, locationId } = integration;
      
      // Get valid token
      const { getValidGhlToken } = await import('../shared/ghlTokenManager');
      const tokenResult = await getValidGhlToken(userId);
      
      if (!tokenResult) {
        console.error(`❌ [EXPIRY_CHECK] No valid token for user ${userId}`);
        continue;
      }

      const { token } = tokenResult;

      // Search for contacts with conversation:manual tag
      const contactsResponse = await fetch(
        `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=conversation:manual`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Version': '2021-07-28'
          }
        }
      );

      if (!contactsResponse.ok) {
        console.error(`❌ [EXPIRY_CHECK] Failed to fetch contacts for location ${locationId}`);
        continue;
      }

      const contactsData = await contactsResponse.json();
      const contacts = contactsData.contacts || [];

      console.log(`📋 [EXPIRY_CHECK] Found ${contacts.length} contacts in manual mode for location ${locationId}`);

      // Check each contact
      for (const contact of contacts) {
        totalChecked++;
        
        const contactId = contact.id;
        const hasManualTag = contact.tags?.includes('conversation:manual');
        
        if (!hasManualTag) {
          console.log(`⏭️ [EXPIRY_CHECK] Contact ${contactId} no longer has manual tag - skipping`);
          continue;
        }

        // Get conversation ID
        let conversationId = '';
        try {
          const conversationsResponse = await fetch(
            `https://services.leadconnectorhq.com/conversations/search?contactId=${contactId}&limit=1`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Version': '2021-04-15'
              }
            }
          );
          const conversationsData = await conversationsResponse.json();
          conversationId = conversationsData?.conversations?.[0]?.id || '';
        } catch (error) {
          console.error(`⚠️ [EXPIRY_CHECK] Failed to get conversation for ${contactId}`);
          continue;
        }

        if (!conversationId) {
          console.log(`⚠️ [EXPIRY_CHECK] No conversation found for ${contactId}`);
          continue;
        }

        // Check for activity in last 24 hours
        const { checkRecentActivity } = await import('../shared/conversationActivity');
        const activity = await checkRecentActivity(conversationId, token, 24 * 60); // 24 hours in minutes

        // If no activity in 24 hours, resume AI
        if (!activity.hasRecentOutbound && activity.lastActivityTime) {
          const lastActivityTime = new Date(activity.lastActivityTime).getTime();
          const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
          
          if (lastActivityTime < twentyFourHoursAgo) {
            console.log(`✅ [EXPIRY_CHECK] Resuming AI for contact ${contactId} - no activity for 24h`);
            
            // Remove conversation:manual tag
            const currentTags = contact.tags || [];
            const newTags = currentTags.filter((tag: string) => tag !== 'conversation:manual');
            
            await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ tags: newTags })
            });

            // Add note
            const timestamp = new Date().toLocaleString('en-US', { 
              timeZone: 'America/New_York',
              dateStyle: 'short',
              timeStyle: 'short'
            });
            
            await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                body: `🤖 AI resumed - no activity for 24 hours (${timestamp})` 
              })
            });

            // Reset OutreachQueue status
            const { updateQueueStatus } = await import('../shared/outreachQueue');
            const queueId = `${userId}_${contactId}`;
            await updateQueueStatus(queueId, 'CONVERSATION', 'Auto-resumed after 24h inactivity');

            totalResumed++;
          }
        }
      }
    }

    console.log(`✅ [EXPIRY_CHECK] Complete - Checked: ${totalChecked}, Resumed: ${totalResumed}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        checked: totalChecked,
        resumed: totalResumed
      })
    };

  } catch (error: any) {
    logError('expiry_check', error, {});
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
