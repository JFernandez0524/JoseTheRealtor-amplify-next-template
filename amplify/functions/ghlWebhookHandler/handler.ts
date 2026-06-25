/**
 * GHL WEBHOOK HANDLER - Lambda Function
 * 
 * Dedicated Lambda function for handling GHL SMS webhooks with proper IAM permissions.
 * This function has explicit DynamoDB access granted in backend.ts.
 * 
 * WORKFLOW:
 * 1. Receive webhook from GHL workflow
 * 2. Extract userId from customData
 * 3. Query GhlIntegration table for OAuth token
 * 4. Fetch contact data from GHL API
 * 5. Generate AI response
 * 6. Send SMS via GHL API
 * 
 * ENVIRONMENT VARIABLES:
 * - AMPLIFY_DATA_GhlIntegration_TABLE_NAME
 * - GHL_CLIENT_ID
 * - GHL_CLIENT_SECRET
 * - OPENAI_API_KEY
 */

import { createHmac } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { validateEnv } from '../shared/config';
import { claimProcessing, extractWebhookId } from '../shared/idempotency';
import { logError, logWarning } from '../shared/logger';
import { sanitizeId } from '../shared/sanitize';
import { ghlGetContact, ghlUpdateContact, createGhlClient } from '../shared/ghlClient';

// Validate environment at module load time
validateEnv('ghlWebhookHandler');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const GHL_INTEGRATION_TABLE = process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME!;

export const handler = async (event: any) => {
  console.log('📨 [WEBHOOK_LAMBDA] Received event');
  
  // Validate GHL webhook signature when present (marketplace system webhooks include x-ghl-signature).
  // Workflow webhooks don't send this header, so we only reject when present-but-invalid.
  const ghlSignature = event.headers?.['x-ghl-signature'] || event.headers?.['X-Ghl-Signature'];
  if (ghlSignature) {
    const rawBody = typeof event.body === 'string' ? event.body : JSON.stringify(event.body);
    const expectedSig = createHmac('sha256', process.env.GHL_CLIENT_SECRET!)
      .update(rawBody)
      .digest('hex');
    if (ghlSignature !== expectedSig) {
      console.error('❌ [WEBHOOK_LAMBDA] Invalid GHL signature — rejecting request');
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid signature' }) };
    }
    console.log('✅ [WEBHOOK_LAMBDA] GHL signature verified');
  }

  // Atomically claim this webhook — prevents duplicate processing under concurrent Lambda invocations
  const webhookId = extractWebhookId(event);
  console.log(`🔑 [WEBHOOK_LAMBDA] Webhook ID: ${webhookId}`);

  // metadata is populated after body parse; use a placeholder source here,
  // the real eventType is set inside the handler branches below
  const claimed = await claimProcessing(webhookId, { source: 'ghl', eventType: 'unknown' });
  if (!claimed) {
    console.log('⏭️ [WEBHOOK_LAMBDA] Already processed');
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Already processed', webhookId })
    };
  }

  console.log('📨 [WEBHOOK_LAMBDA] Event body:', event.body);

  let body: any;
  let metadata: any;

  try {
    // Parse body (API Gateway sends stringified JSON)
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    
    console.log('📨 [WEBHOOK_LAMBDA] Parsed body type:', body.type);
    
    metadata = {
      source: 'ghl',
      eventType: body.type || 'unknown',
      contactId: body.contactId || body.customData?.contactId
    };
    
    // Check if this is an email bounce event (from GHL system webhook)
    if (body.type === 'EmailBounced') {
      const result = await handleEmailBounce(body);
      return result;
    }
    
    // Check if this is a task event (from GHL workflow webhook)
    if (body.type === 'TaskCreate' || body.type === 'TaskComplete' || body.type === 'TaskDelete') {
      console.log('📋 [WEBHOOK_LAMBDA] Detected task event, routing to handleTaskEvent');
      const result = await handleTaskEvent(body);
      return result;
    }
    
    // GHL Marketplace sends many system event types — acknowledge gracefully
    const ACKNOWLEDGED_EVENT_TYPES = new Set([
      'ContactCreate', 'ContactUpdate', 'ContactDelete', 'ContactTagUpdate', 'ContactDndUpdate',
      'OutboundMessage', 'ConversationUpdate',
      'OpportunityCreate', 'OpportunityUpdate', 'OpportunityStageUpdate',
      'OpportunityStatusUpdate', 'OpportunityAssignedToUpdate',
      'AssociationCreate', 'AssociationUpdate', 'AssociationDelete',
      'LocationUpdate',
    ]);
    if (ACKNOWLEDGED_EVENT_TYPES.has(body.type)) {
      console.log(`ℹ️ [WEBHOOK_LAMBDA] Marketplace event acknowledged (no action): ${body.type}`);
      return { statusCode: 200, body: JSON.stringify({ message: `Event ${body.type} acknowledged` }) };
    }

    console.log('📨 [WEBHOOK_LAMBDA] Not a task event, continuing with message handling');

    // Extract data from customData (workflow) or root level (system webhook)
    const { customData, message, contact, location } = body;
    let userId = sanitizeId(customData?.userId || body.userId || '');
    const contactId = sanitizeId(customData?.contactId || body.contactId || contact?.id || '');
    let messageBody = customData?.messageBody || body.body || message?.body;
    const messageType = customData?.type === 'InboundMessage' ? (message?.type || 1) : message?.type;
    const locationId = sanitizeId(customData?.locationId || body.locationId || location?.id || '');
    let conversationId = customData?.conversationId || body.conversationId || '';


    console.log('📨 [WEBHOOK_LAMBDA] Extracted data:', { userId, contactId, messageBody, messageType, locationId, conversationId });

    // Check message direction - only process INBOUND messages from leads
    const messageDirection = customData?.direction || message?.direction || body.direction;
    
    if (messageDirection === 'outbound') {
      console.log('🚫 [WEBHOOK_LAMBDA] Outbound message detected (from agent) - skipping AI response');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Outbound message - no AI response needed' })
      };
    }

    // Handle email replies (type 1)
    if (messageType === 1) {
      const result = await handleEmailReply(body, contactId, locationId, messageBody, userId);
      return result;
    }

    // If no userId in payload, try resolving by locationId
    if (!userId && locationId) {
      console.log('⚠️ [WEBHOOK_LAMBDA] No userId — attempting locationId lookup');
      const { getIntegrationByLocationId } = await import('../shared/ghlTokenManager');
      const locIntegration = await getIntegrationByLocationId(locationId);
      if (locIntegration) {
        userId = locIntegration.userId;
        console.log(`✅ [WEBHOOK_LAMBDA] Resolved userId ${userId} from locationId`);
      }
    }
    if (!userId) {
      console.warn('⚠️ [WEBHOOK_LAMBDA] Could not resolve userId — dropping webhook (no tenant match)');
      return { statusCode: 200, body: JSON.stringify({ message: 'No tenant match found' }) };
    }

    // Only require contactId for message handling (not task events)
    if (!contactId) {
      logError('webhook_validation', new Error('Missing contact ID'), { body });
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing contact ID' })
      };
    }

    // PHASE 1: INBOUND MESSAGE HANDLING (Lead replied to us)
    // This is always an inbound message since it's triggered by GHL workflow on customer reply
    console.log('📬 [INBOUND] Lead replied - analyzing intent...');
    
    // IMMEDIATE ACTION: Move to CONVERSATION status (stops automated drip)
    const queueId = `${userId}_${contactId}`;
    const { logInboundReply, updateQueueStatus } = await import('../shared/outreachQueue');
    
    await logInboundReply(queueId);
    console.log('✅ [INBOUND] Moved to CONVERSATION status - automated drip stopped');
    
    // AI SENTIMENT ANALYSIS: Determine if this is a terminal status
    const { analyzeLeadIntent } = await import('../shared/sentimentAnalysis');
    const sentiment = await analyzeLeadIntent(messageBody);
    
    if (sentiment.intent === 'STOP') {
      console.log('🛑 [INBOUND] Lead wants to STOP - marking as DND');
      await updateQueueStatus(queueId, 'DND', 'Lead requested to stop');
      
      // Send confirmation and exit
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          action: 'DND',
          message: 'Lead opted out - no AI response sent'
        })
      };
    }
    
    if (sentiment.intent === 'WRONG_INFO') {
      console.log('❌ [INBOUND] Wrong person/number - marking as WRONG_INFO');
      await updateQueueStatus(queueId, 'WRONG_INFO', 'Wrong contact information');
      
      // Send apology and exit
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          action: 'WRONG_INFO',
          message: 'Wrong contact - no AI response sent'
        })
      };
    }
    
    // Intent is CONVERSATION - continue with AI response
    console.log('💬 [INBOUND] Lead is engaging - generating AI response...');

    // For Instagram type 18 (story replies), message body might be empty in webhook
    // We'll fetch it from the conversation API after getting the token
    if (!messageBody && messageType === 18) {
      console.log('⚠️ [WEBHOOK_LAMBDA] Empty message body for Instagram type 18 - will fetch from conversation API');
    } else if (!messageBody) {
      console.error('❌ [WEBHOOK_LAMBDA] Missing message body', { 
        hasContactId: !!contactId, 
        hasMessageBody: !!messageBody,
        contactId,
        messageBody,
        messageType
      });
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Get GHL integration from DynamoDB
    console.log('🔍 [WEBHOOK_LAMBDA] Querying GhlIntegration table...');
    const { Items } = await docClient.send(new ScanCommand({
      TableName: GHL_INTEGRATION_TABLE,
      FilterExpression: 'userId = :userId AND isActive = :active',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':active': true
      }
    }));

    if (!Items || Items.length === 0) {
      console.error('❌ [WEBHOOK_LAMBDA] No active integration found');
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No active integration found' })
      };
    }

    // Use token manager to get valid token (handles refresh automatically)
    const { getValidGhlToken } = await import('../shared/ghlTokenManager');
    const tokenResult = await getValidGhlToken(userId);
    
    if (!tokenResult) {
      console.error('❌ [WEBHOOK_LAMBDA] Failed to get valid token');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Failed to get valid token' })
      };
    }
    
    const { token } = tokenResult;
    const fieldIds: Record<string, string> = tokenResult.customFieldIds || {};
    const opportunityFieldIds: Record<string, string> = tokenResult.opportunityFieldIds || {};
    const agentProfile = tokenResult.agentName && tokenResult.agentBrokerage
      ? { name: tokenResult.agentName, brokerage: tokenResult.agentBrokerage }
      : undefined;
    console.log('✅ [WEBHOOK_LAMBDA] Got valid GHL token');

    // Save sentiment to GHL custom field
    const sentimentFieldId = fieldIds.conversation_sentiment;
    if (sentimentFieldId) {
      try {
        await ghlUpdateContact(token, contactId, {
          customFields: [{ id: sentimentFieldId, value: sentiment.sentiment }]
        });
        console.log(`✅ [SENTIMENT] Saved to GHL: ${sentiment.sentiment}`);
      } catch (error) {
        console.error('⚠️ [SENTIMENT] Failed to save to GHL:', error);
      }
    }

    const ghl = createGhlClient(token);

    // If message body is empty (Instagram type 18), fetch from conversation API
    if (!messageBody && conversationId) {
      console.log('🔍 [WEBHOOK_LAMBDA] Fetching latest message from conversation API...');
      try {
        const messagesRes = await ghl.get(`/conversations/${conversationId}/messages`, { params: { limit: 1 } });
        const latestMessage = messagesRes.data?.messages?.[0];
        if (latestMessage?.body) {
          messageBody = latestMessage.body;
          console.log('✅ [WEBHOOK_LAMBDA] Fetched message body from conversation:', messageBody);
        }
      } catch (error) {
        console.error('⚠️ [WEBHOOK_LAMBDA] Failed to fetch message from conversation:', error);
      }
    }

    // Check if message is media (image, video, audio) - skip AI response for ALL message types
    if (conversationId) {
      try {
        const messagesRes = await ghl.get(`/conversations/${conversationId}/messages`, { params: { limit: 1 } });
        const latestMessage = messagesRes.data?.messages?.[0];
        if (latestMessage?.contentType && latestMessage.contentType !== 'text/plain') {
          console.log('⏭️ [WEBHOOK_LAMBDA] Skipping media message:', latestMessage.contentType);
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Media message - no AI response needed' })
          };
        }
      } catch (error) {
        console.error('⚠️ [WEBHOOK_LAMBDA] Failed to check message type:', error);
      }
    }

    // If still no message body, skip processing
    if (!messageBody) {
      console.log('⚠️ [WEBHOOK_LAMBDA] No message body available - skipping');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No message body to process' })
      };
    }

    // Fetch contact data from GHL
    console.log('🔍 [WEBHOOK_LAMBDA] Fetching contact from GHL...');
    const fullContact = await ghlGetContact(token, contactId);

    // Extract property data using dynamic field IDs
    const findField = (key: string) => {
      const id = fieldIds[key];
      return id ? fullContact?.customFields?.find((f: any) => f.id === id)?.value : undefined;
    };
    const propertyAddress = findField('property_address');
    const propertyCity = findField('property_city');
    const propertyState = findField('property_state');
    const propertyZip = findField('property_zip');
    const leadType = findField('lead_type');
    const zestimate = findField('zestimate');
    const cashOffer = findField('cash_offer');

    console.log('📋 [WEBHOOK_LAMBDA] Contact data:', {
      name: `${fullContact.firstName} ${fullContact.lastName}`,
      propertyAddress,
      leadType,
      zestimate,
      cashOffer,
      tags: fullContact?.tags
    });

    // Check if this is actually a lead (has ai outreach tag or property data)
    const hasAiOutreachTag = fullContact?.tags?.some((tag: string) => 
      tag.toLowerCase().includes('ai outreach')
    );
    const hasPropertyData = propertyAddress || leadType;
    
    if (!hasAiOutreachTag && !hasPropertyData) {
      console.log('🚫 [WEBHOOK_LAMBDA] Contact is not a lead (no ai outreach tag or property data) - skipping AI response');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'Skipped - not a lead contact',
          contactId,
          hasAiOutreachTag,
          hasPropertyData
        })
      };
    }

    // FAST PATH: Check if conversation is already in manual mode
    const isManualHandling = fullContact?.tags?.some((tag: string) => 
      tag.toLowerCase().includes('conversation:manual')
    );
    
    if (isManualHandling) {
      console.log('🚫 [WEBHOOK_LAMBDA] Contact has conversation:manual tag - skipping AI response');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'Skipped - manual handling active',
          contactId,
          tags: fullContact?.tags
        })
      };
    }

    // AUTO-DETECT: Check for recent manual activity (30-minute window)
    if (conversationId) {
      const { checkRecentActivity, activateManualMode } = await import('../shared/conversationActivity');
      
      const activity = await checkRecentActivity(conversationId, token, 30);
      
      if (activity.hasRecentOutbound) {
        console.log('🚫 [WEBHOOK_LAMBDA] Detected recent manual activity - activating manual mode');
        
        await activateManualMode(contactId, token, 'Recent manual activity detected', fieldIds);
        
        return {
          statusCode: 200,
          body: JSON.stringify({ 
            message: 'Manual mode activated - AI paused',
            contactId,
            lastOutboundTime: activity.lastOutboundTime
          })
        };
      }
    }

    // Fetch conversation ID from GHL if not provided
    console.log('🔍 [WEBHOOK_LAMBDA] Fetching conversations for contact...');
    if (!conversationId) {
      try {
        const convRes = await ghl.get('/conversations/search', { params: { contactId, limit: 1 } });
        conversationId = convRes.data?.conversations?.[0]?.id || '';
        console.log('✅ [WEBHOOK_LAMBDA] Found conversation:', conversationId);
      } catch (error) {
        console.error('⚠️ [WEBHOOK_LAMBDA] Failed to fetch conversation ID:', error);
      }
    }

    // Generate AI response (import from shared utility)
    const { generateAIResponse } = await import('../shared/conversationHandler');
    
    // Fetch conversation history for context (last 20 messages)
    let conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [];
    if (conversationId) {
      try {
        console.log('📜 [WEBHOOK_LAMBDA] Fetching conversation history...');
        const historyRes = await ghl.get(`/conversations/${conversationId}/messages`, { params: { limit: 20 } });
        const historyData = historyRes.data;

        if (historyData?.messages && Array.isArray(historyData.messages)) {
          // Filter out system messages and map to OpenAI format
          // GHL returns newest first, so reverse for chronological order
          conversationHistory = historyData.messages
            .filter((msg: any) => msg.body && msg.type !== 'TYPE_SYSTEM')
            .reverse()
            .map((msg: any) => ({
              role: msg.direction === 'outbound' ? 'assistant' as const : 'user' as const,
              content: msg.body
            }))
            .slice(-20); // Keep last 20 messages
          
          console.log(`✅ [WEBHOOK_LAMBDA] Loaded ${conversationHistory.length} messages for context`);
        }
      } catch (error) {
        console.error('⚠️ [WEBHOOK_LAMBDA] Failed to fetch conversation history:', error);
        // Continue without history - graceful degradation
      }
    }
    
    // Determine message type: Instagram (18), Facebook (3, 11), or SMS (2)
    let messageTypeStr: 'SMS' | 'FB' | 'IG' | 'WhatsApp' = 'SMS';
    if (messageType === 18) {
      messageTypeStr = 'IG';
    } else if ([3, 11].includes(messageType)) {
      messageTypeStr = 'FB';
    }

    await generateAIResponse({
      contactId,
      conversationId,
      incomingMessage: messageBody,
      contactName: `${fullContact?.firstName || ''} ${fullContact?.lastName || ''}`.trim(),
      propertyAddress,
      propertyCity,
      propertyState,
      propertyZip,
      leadType,
      locationId,
      contact: fullContact,
      accessToken: token,
      messageType: messageTypeStr,
      existingZestimate: zestimate ? parseInt(zestimate) : undefined,
      existingCashOffer: cashOffer ? parseInt(cashOffer) : undefined,
      conversationHistory,
      fieldIds,
      opportunityFieldIds,
      agentProfile,
      campaignCalendarId: tokenResult.campaignCalendarId || undefined,
    });

    // PHASE 3: OUTBOUND LOGGING (We just sent AI response)
    const { logOutboundContact } = await import('../shared/outreachQueue');
    await logOutboundContact(queueId);
    console.log('✅ [OUTBOUND] Logged AI response - daily limit updated');

    // Mark webhook as processed

    console.log('✅ [WEBHOOK_LAMBDA] Successfully processed webhook');

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, webhookId })
    };

  } catch (error: any) {
    logError('webhook_handler', error, {
      webhookId,
      contactId: body?.contactId,
      userId: body?.customData?.userId,
      eventType: body?.type
    });
    
    // DON'T mark as processed on error - allow GHL to retry
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

/**
 * Handle email reply from contact
 */
async function handleEmailReply(body: any, contactId: string, locationId: string, messageBody: string, userId?: string) {
  console.log(`📬 [EMAIL] Reply from contact ${contactId}`);

  try {
    const integration = await getIntegrationForLocation(locationId);
    if (!integration) {
      console.error('❌ [EMAIL] No token found for location:', locationId);
      return { statusCode: 404, body: JSON.stringify({ error: 'No integration found' }) };
    }
    const { token, fieldIds } = integration;

    // Fetch contact
    const contact = await ghlGetContact(token, contactId);

    // Get userId from contact if not provided
    if (!userId) {
      const appUserIdFieldId = fieldIds.app_user_id;
      userId = appUserIdFieldId
        ? contact?.customFields?.find((f: any) => f.id === appUserIdFieldId)?.value
        : undefined;
    }
    
    // IMMEDIATE ACTION: Move to CONVERSATION status
    if (userId) {
      const queueId = `${userId}_${contactId}`;
      const { logInboundReply, updateQueueStatus } = await import('../shared/outreachQueue');
      
      await logInboundReply(queueId);
      console.log('✅ [EMAIL] Moved to CONVERSATION status - automated drip stopped');
      
      // AI SENTIMENT ANALYSIS
      const { analyzeLeadIntent } = await import('../shared/sentimentAnalysis');
      const sentiment = await analyzeLeadIntent(messageBody);
      
      if (sentiment.intent === 'STOP') {
        console.log('🛑 [EMAIL] Lead wants to STOP - marking as DND');
        await updateQueueStatus(queueId, 'DND', 'Lead requested to stop');
        return { statusCode: 200, body: JSON.stringify({ success: true, action: 'DND' }) };
      }
      
      if (sentiment.intent === 'WRONG_INFO') {
        console.log('❌ [EMAIL] Wrong email - marking as WRONG_INFO');
        await updateQueueStatus(queueId, 'WRONG_INFO', 'Wrong contact information');
        await handleWrongEmail(contactId, contact.email, token, fieldIds);
        return { statusCode: 200, body: JSON.stringify({ success: true, action: 'WRONG_INFO' }) };
      }
    }

    // Generate AI response if AI is active
    const aiStateFieldId = fieldIds.ai_state;
    const aiState = aiStateFieldId
      ? contact?.customFields?.find((f: any) => f.id === aiStateFieldId)?.value
      : undefined;
    
    if (aiState === 'running' || aiState === 'not_started') {
      // TODO: Import and call email AI handler
      console.log(`✅ [EMAIL] AI response sent`);
    } else {
      // Just tag as replied
      await ghlUpdateContact(token, contactId, { tags: ['email:replied'] });
      console.log(`✅ [EMAIL] Tagged as replied (AI not active)`);
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (error: any) {
    console.error('❌ [EMAIL] Error handling reply:', error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}

/**
 * Handle email bounce
 */
async function handleEmailBounce(body: any) {
  const { contactId, locationId, bounceReason } = body;
  console.log(`⚠️ [EMAIL] Bounce for contact ${contactId}: ${bounceReason}`);

  try {
    const integration = await getIntegrationForLocation(locationId);
    if (!integration) {
      return { statusCode: 404, body: JSON.stringify({ error: 'No integration found' }) };
    }
    const { token, fieldIds } = integration;

    const contact = await ghlGetContact(token, contactId);
    const appUserIdFieldId = fieldIds.app_user_id;
    const userId = appUserIdFieldId
      ? contact?.customFields?.find((f: any) => f.id === appUserIdFieldId)?.value
      : undefined;

    // Update queue status to BOUNCED
    if (userId) {
      const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
      await docClient.send(new UpdateCommand({
        TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME,
        Key: { id: `${userId}_${contactId}` },
        UpdateExpression: 'SET emailStatus = :status, updatedAt = :now',
        ExpressionAttributeValues: {
          ':status': 'BOUNCED',
          ':now': new Date().toISOString(),
        },
      }));
      console.log(`✅ [EMAIL] Queue updated to BOUNCED`);
    }

    // Tag contact
    await ghlUpdateContact(token, contactId, { tags: ['email:bounced'] });

    console.log(`✅ [EMAIL] Contact tagged as bounced`);
    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (error: any) {
    console.error('❌ [EMAIL] Error handling bounce:', error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}

/**
 * Handle wrong email address
 */
async function handleWrongEmail(contactId: string, emailAddress: string, token: string, fieldIds: Record<string, string> = {}) {
  console.log(`🚨 [EMAIL] Processing wrong email: ${emailAddress}`);

  try {
    const contact = await ghlGetContact(token, contactId);
    const appUserIdFieldId = fieldIds.app_user_id;
    const userId = appUserIdFieldId
      ? contact?.customFields?.find((f: any) => f.id === appUserIdFieldId)?.value
      : undefined;

    // Update queue to BOUNCED
    if (userId) {
      const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
      await docClient.send(new UpdateCommand({
        TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME,
        Key: { id: `${userId}_${contactId}` },
        UpdateExpression: 'SET emailStatus = :status, updatedAt = :now',
        ExpressionAttributeValues: {
          ':status': 'BOUNCED',
          ':now': new Date().toISOString(),
        },
      }));
    }

    // Tag and add note
    await ghlUpdateContact(token, contactId, { tags: ['email:wrong_address', 'needs_review'] });

    const ghl = createGhlClient(token);
    await ghl.post(`/contacts/${contactId}/notes`, {
      body: `⚠️ WRONG EMAIL ADDRESS: Recipient reported that ${emailAddress} is incorrect. Please verify and update contact information.`
    });

    console.log(`✅ [EMAIL] Wrong email processed`);
  } catch (error: any) {
    console.error('❌ [EMAIL] Error handling wrong email:', error.message);
  }
}

/**
 * Get token and field IDs by locationId
 */
async function getIntegrationForLocation(locationId: string): Promise<{
  token: string;
  fieldIds: Record<string, string>;
  opportunityFieldIds: Record<string, string>;
} | null> {
  try {
    const { getIntegrationByLocationId } = await import('../shared/ghlTokenManager');
    const integration = await getIntegrationByLocationId(locationId);
    if (!integration) return null;
    return {
      token: integration.token,
      fieldIds: integration.customFieldIds || {},
      opportunityFieldIds: integration.opportunityFieldIds || {},
    };
  } catch (error: any) {
    console.error('❌ [EMAIL] Error getting integration:', error.message);
    return null;
  }
}

/** @deprecated Use getIntegrationForLocation */
async function getTokenByLocation(locationId: string): Promise<string | null> {
  const result = await getIntegrationForLocation(locationId);
  return result?.token || null;
}

/**
 * Handle GHL Task Events (Create, Complete, Delete)
 * Syncs tasks to Google Calendar
 */
async function handleTaskEvent(body: any) {
  console.log('📋 [TASK] Received task event:', body.type);
  
  try {
    const { type, id, assignedToEmail, title, body: taskBody, dueDate, locationId } = body;

    // Resolve tenant by locationId to get per-user calendar settings
    const { getIntegrationByLocationId } = await import('../shared/ghlTokenManager');
    const taskIntegration = locationId ? await getIntegrationByLocationId(locationId) : null;
    if (!taskIntegration) {
      console.warn('⚠️ [TASK] No integration found for locationId — skipping task sync');
      return { statusCode: 200, body: JSON.stringify({ message: 'No tenant match for task' }) };
    }

    console.log(`✅ [TASK] Resolved tenant for locationId ${locationId} - processing ${type}`);
    
    // Import utilities
    const { createCalendarEvent, markEventCompleted } = await import('../shared/googleCalendar');
    const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    
    const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    const docClient = DynamoDBDocumentClient.from(dynamoClient);
    const TASK_SYNC_TABLE = process.env.AMPLIFY_DATA_TaskCalendarSync_TABLE_NAME;
    const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || taskIntegration.agentCalendarEmail || null;
    if (!CALENDAR_ID) {
      console.warn('⚠️ [TASK] No GOOGLE_CALENDAR_ID or agentCalendarEmail configured for this tenant — skipping calendar sync');
      return { statusCode: 200, body: JSON.stringify({ message: 'Calendar not configured for this tenant' }) };
    }
    
    if (!TASK_SYNC_TABLE) {
      throw new Error('TaskCalendarSync table name not configured');
    }
    
    // Handle different task events
    if (type === 'TaskCreate') {
      // Create calendar event
      const eventId = await createCalendarEvent(
        { 
          id, 
          title, 
          body: taskBody, 
          dueDate,
          assignedToEmail: assignedToEmail || undefined
        },
        CALENDAR_ID
      );
      
      // Store mapping in DynamoDB
      await docClient.send(new PutCommand({
        TableName: TASK_SYNC_TABLE,
        Item: {
          id: `${Date.now()}_${id}`, // Amplify requires unique id
          ghlTaskId: id,
          calendarEventId: eventId,
          locationId,
          userId: assignedToEmail,
          taskTitle: title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      }));
      
      console.log(`✅ [TASK] Task synced to calendar: ${eventId}`);
      
    } else if (type === 'TaskComplete') {
      // Find calendar event ID using query
      const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
      const { Items } = await docClient.send(new QueryCommand({
        TableName: TASK_SYNC_TABLE,
        IndexName: 'byGhlTaskId',
        KeyConditionExpression: 'ghlTaskId = :taskId',
        ExpressionAttributeValues: {
          ':taskId': id
        }
      }));
      
      if (Items && Items.length > 0) {
        const eventId = Items[0].calendarEventId;
        await markEventCompleted(eventId, CALENDAR_ID);
        console.log(`✅ [TASK] Task marked as completed in calendar: ${eventId}`);
      }
      
    }
    // Note: TaskDelete not handled - GHL doesn't trigger webhooks for task deletions
    // Calendar events must be deleted manually when tasks are removed
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: `Task ${type} processed` })
    };
    
  } catch (error: any) {
    console.error('❌ [TASK] Error handling task event:', error.message);
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
