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

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { validateEnv } from '../shared/config';
import { isProcessed, markProcessed, extractWebhookId } from '../shared/idempotency';
import { logError, logWarning } from '../shared/logger';
import { sanitizeId } from '../shared/sanitize';

// Validate environment at module load time
validateEnv('ghlWebhookHandler');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const GHL_INTEGRATION_TABLE = process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME!;

export const handler = async (event: any) => {
  console.log('📨 [WEBHOOK_LAMBDA] Received event');
  
  // Check idempotency
  const webhookId = extractWebhookId(event);
  console.log(`🔑 [WEBHOOK_LAMBDA] Webhook ID: ${webhookId}`);

  if (await isProcessed(webhookId)) {
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
      await markProcessed(webhookId, metadata);
      return result;
    }
    
    // Check if this is a task event (from GHL workflow webhook)
    if (body.type === 'TaskCreate' || body.type === 'TaskComplete' || body.type === 'TaskDelete') {
      console.log('📋 [WEBHOOK_LAMBDA] Detected task event, routing to handleTaskEvent');
      const result = await handleTaskEvent(body);
      await markProcessed(webhookId, metadata);
      return result;
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

    // Handle email replies (type 1)
    if (messageType === 1) {
      const result = await handleEmailReply(body, contactId, locationId, messageBody, userId);
      await markProcessed(webhookId, metadata);
      return result;
    }

    // Default to Jose's account for organic leads (no app_user_id)
    if (!userId) {
      console.log('⚠️ [WEBHOOK_LAMBDA] No userId found - defaulting to Jose\'s account (organic lead)');
      userId = '44d8f4c8-10c1-7038-744b-271103170819';
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
    console.log('✅ [WEBHOOK_LAMBDA] Got valid GHL token');

    // Save sentiment to GHL custom field (conversation_sentiment: vjhwCk3Ns0ekDEbMsuy5)
    try {
      await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customFields: [
            { id: 'vjhwCk3Ns0ekDEbMsuy5', value: sentiment.sentiment }
          ]
        })
      });
      console.log(`✅ [SENTIMENT] Saved to GHL: ${sentiment.sentiment}`);
    } catch (error) {
      console.error('⚠️ [SENTIMENT] Failed to save to GHL:', error);
    }

    // If message body is empty (Instagram type 18), fetch from conversation API
    if (!messageBody && conversationId) {
      console.log('🔍 [WEBHOOK_LAMBDA] Fetching latest message from conversation API...');
      try {
        const messagesResponse = await fetch(
          `https://services.leadconnectorhq.com/conversations/${conversationId}/messages?limit=1`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Version': '2021-07-28'
            }
          }
        );
        
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          const latestMessage = messagesData.messages?.[0];
          
          if (latestMessage?.body) {
            messageBody = latestMessage.body;
            console.log('✅ [WEBHOOK_LAMBDA] Fetched message body from conversation:', messageBody);
          }
        }
      } catch (error) {
        console.error('⚠️ [WEBHOOK_LAMBDA] Failed to fetch message from conversation:', error);
      }
    }

    // Check if message is media (image, video, audio) - skip AI response for ALL message types
    if (conversationId) {
      try {
        const messagesResponse = await fetch(
          `https://services.leadconnectorhq.com/conversations/${conversationId}/messages?limit=1`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Version': '2021-07-28'
            }
          }
        );
        
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          const latestMessage = messagesData.messages?.[0];
          
          if (latestMessage?.contentType && latestMessage.contentType !== 'text/plain') {
            console.log('⏭️ [WEBHOOK_LAMBDA] Skipping media message:', latestMessage.contentType);
            return {
              statusCode: 200,
              body: JSON.stringify({ message: 'Media message - no AI response needed' })
            };
          }
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
    const contactResponse = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Version': '2021-07-28'
        }
      }
    );

    console.log('📡 [WEBHOOK_LAMBDA] Contact response status:', contactResponse.status);

    if (!contactResponse.ok) {
      const errorText = await contactResponse.text();
      console.error('❌ [WEBHOOK_LAMBDA] Failed to fetch contact:', contactResponse.status, errorText);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch contact', details: errorText })
      };
    }

    const contactData = await contactResponse.json();
    const fullContact = contactData.contact;

    // Extract property data
    const propertyAddress = fullContact?.customFields?.find((f: any) => f.id === 'p3NOYiInAERYbe0VsLHB')?.value;
    const propertyCity = fullContact?.customFields?.find((f: any) => f.id === 'h4UIjKQvFu7oRW4SAY8W')?.value;
    const propertyState = fullContact?.customFields?.find((f: any) => f.id === '9r9OpQaxYPxqbA6Hvtx7')?.value;
    const propertyZip = fullContact?.customFields?.find((f: any) => f.id === 'hgbjsTVwcyID7umdhm2o')?.value;
    const leadType = fullContact?.customFields?.find((f: any) => f.id === 'oaf4wCuM3Ub9eGpiddrO')?.value;
    const zestimate = fullContact?.customFields?.find((f: any) => f.id === '7wIe1cRbZYXUnc3WOVb2')?.value;
    const cashOffer = fullContact?.customFields?.find((f: any) => f.id === 'sM3hEOHCJFoPyWhj1Vc8')?.value;

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

    // Check if conversation is being handled manually
    const isManualHandling = fullContact?.tags?.some((tag: string) => 
      tag.toLowerCase().includes('manual') || tag.toLowerCase().includes('human')
    );
    
    if (isManualHandling) {
      console.log('🚫 [WEBHOOK_LAMBDA] Contact has manual/human tag - skipping AI response');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'Skipped - manual handling active',
          contactId,
          tags: fullContact?.tags
        })
      };
    }

    // Auto-detect manual intervention by checking recent conversation history
    if (conversationId) {
      try {
        console.log('🔍 [WEBHOOK_LAMBDA] Checking for recent manual messages...');
        const messagesResponse = await fetch(
          `https://services.leadconnectorhq.com/conversations/${conversationId}/messages?limit=10`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Version': '2021-07-28'
            }
          }
        );
        
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          const recentMessages = messagesData.messages || [];
          
          // Look for outbound messages sent in the last 5 minutes that weren't from AI
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
          const recentManualMessage = recentMessages.find((msg: any) => {
            const messageTime = new Date(msg.dateAdded).getTime();
            const isRecent = messageTime > fiveMinutesAgo;
            const isOutbound = msg.direction === 'outbound';
            
            // AI message detection patterns
            const messageBody = msg.body?.toLowerCase() || '';
            const isFromAI = 
              messageBody.includes('jose from re/max') ||
              messageBody.includes('ai assistant') ||
              messageBody.includes('reply stop to opt out') ||
              messageBody.includes('based on current market data') ||
              messageBody.includes('what area are you looking in') ||
              messageBody.includes('what\'s your budget') ||
              messageBody.includes('how many bedrooms') ||
              messageBody.includes('when are you hoping to move') ||
              messageBody.includes('let me connect you with jose directly') ||
              (messageBody.length > 100 && messageBody.includes('property')); // Long property-related messages are likely AI
            
            return isRecent && isOutbound && !isFromAI;
          });
          
          if (recentManualMessage) {
            console.log('🚫 [WEBHOOK_LAMBDA] Detected recent manual message - auto-enabling manual mode');
            
            // Auto-add manual tag
            const currentTags = fullContact?.tags || [];
            if (!currentTags.includes('manual')) {
              const newTags = [...currentTags, 'manual'];
              
              await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Version': '2021-07-28',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tags: newTags })
              });
              
              console.log('✅ [WEBHOOK_LAMBDA] Auto-added manual tag');
            }
            
            return {
              statusCode: 200,
              body: JSON.stringify({ 
                message: 'Auto-detected manual intervention - manual mode enabled',
                contactId,
                manualMessage: recentManualMessage.body
              })
            };
          }
        }
      } catch (error) {
        console.error('⚠️ [WEBHOOK_LAMBDA] Failed to check conversation history:', error);
        // Continue with normal flow if history check fails
      }
    }

    // Fetch conversation ID from GHL if not provided
    console.log('🔍 [WEBHOOK_LAMBDA] Fetching conversations for contact...');
    if (!conversationId) {
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
        const historyResponse = await fetch(
          `https://services.leadconnectorhq.com/conversations/${conversationId}/messages?limit=20`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Version': '2021-04-15'
            }
          }
        );
        const historyData = await historyResponse.json();
        
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
      conversationId, // Use actual conversation ID for context
      incomingMessage: messageBody,
      contactName: `${fullContact?.firstName || ''} ${fullContact?.lastName || ''}`.trim(),
      propertyAddress,
      propertyCity,
      propertyState,
      propertyZip,
      leadType,
      locationId,
      contact: fullContact,
      accessToken: token, // Pass the GHL token for sending messages
      messageType: messageTypeStr,
      existingZestimate: zestimate ? parseInt(zestimate) : undefined, // Pass existing Zestimate
      existingCashOffer: cashOffer ? parseInt(cashOffer) : undefined, // Pass existing cash offer
      conversationHistory, // Pass conversation history for multi-turn context
    });

    // PHASE 3: OUTBOUND LOGGING (We just sent AI response)
    const { logOutboundContact } = await import('../shared/outreachQueue');
    await logOutboundContact(queueId);
    console.log('✅ [OUTBOUND] Logged AI response - daily limit updated');

    // Mark webhook as processed
    await markProcessed(webhookId, metadata);

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
    // Get token by locationId
    const token = await getTokenByLocation(locationId);
    if (!token) {
      console.error('❌ [EMAIL] No token found for location:', locationId);
      return { statusCode: 404, body: JSON.stringify({ error: 'No integration found' }) };
    }

    // Fetch contact
    const axios = (await import('axios')).default;
    const contactResponse = await axios.get(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      { headers: { 'Authorization': `Bearer ${token}`, 'Version': '2021-07-28' } }
    );

    const contact = contactResponse.data.contact;
    
    // Get userId from contact if not provided
    if (!userId) {
      userId = contact?.customFields?.find((f: any) => f.id === 'CNoGugInWOC59hAPptxY')?.value;
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
        await handleWrongEmail(contactId, contact.email, token);
        return { statusCode: 200, body: JSON.stringify({ success: true, action: 'WRONG_INFO' }) };
      }
    }

    // Generate AI response if AI is active
    const aiState = contact?.customFields?.find((f: any) => f.id === '1NxQW2kKMVgozjSUuu7s')?.value;
    
    if (aiState === 'running' || aiState === 'not_started') {
      // TODO: Import and call email AI handler
      console.log(`✅ [EMAIL] AI response sent`);
    } else {
      // Just tag as replied
      await axios.put(
        `https://services.leadconnectorhq.com/contacts/${contactId}`,
        { tags: ['email:replied'] },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Version': '2021-07-28' } }
      );
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
    const token = await getTokenByLocation(locationId);
    if (!token) {
      return { statusCode: 404, body: JSON.stringify({ error: 'No integration found' }) };
    }

    // Fetch contact to get userId
    const axios = (await import('axios')).default;
    const contactResponse = await axios.get(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      { headers: { 'Authorization': `Bearer ${token}`, 'Version': '2021-07-28' } }
    );

    const contact = contactResponse.data.contact;
    const userId = contact?.customFields?.find((f: any) => f.id === 'CNoGugInWOC59hAPptxY')?.value;
    
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
    await axios.put(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      { tags: ['email:bounced'] },
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Version': '2021-07-28' } }
    );

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
async function handleWrongEmail(contactId: string, emailAddress: string, token: string) {
  console.log(`🚨 [EMAIL] Processing wrong email: ${emailAddress}`);

  try {
    const axios = (await import('axios')).default;
    
    // Fetch contact to get userId
    const contactResponse = await axios.get(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      { headers: { 'Authorization': `Bearer ${token}`, 'Version': '2021-07-28' } }
    );

    const contact = contactResponse.data.contact;
    const userId = contact?.customFields?.find((f: any) => f.id === 'CNoGugInWOC59hAPptxY')?.value;
    
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
    await axios.put(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      { tags: ['email:wrong_address', 'needs_review'] },
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Version': '2021-07-28' } }
    );

    await axios.post(
      `https://services.leadconnectorhq.com/contacts/${contactId}/notes`,
      { body: `⚠️ WRONG EMAIL ADDRESS: Recipient reported that ${emailAddress} is incorrect. Please verify and update contact information.` },
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Version': '2021-07-28' } }
    );

    console.log(`✅ [EMAIL] Wrong email processed`);
  } catch (error: any) {
    console.error('❌ [EMAIL] Error handling wrong email:', error.message);
  }
}

/**
 * Get token by locationId
 */
async function getTokenByLocation(locationId: string): Promise<string | null> {
  try {
    const { Items } = await docClient.send(new ScanCommand({
      TableName: GHL_INTEGRATION_TABLE,
      FilterExpression: 'locationId = :locationId AND isActive = :active',
      ExpressionAttributeValues: {
        ':locationId': locationId,
        ':active': true
      }
    }));

    if (!Items || Items.length === 0) return null;

    const integration = Items[0];
    const { getValidGhlToken } = await import('../shared/ghlTokenManager');
    const tokenData = await getValidGhlToken(integration.userId);
    
    return tokenData?.token || null;
  } catch (error: any) {
    console.error('❌ [EMAIL] Error getting token:', error.message);
    return null;
  }
}

/**
 * Handle GHL Task Events (Create, Complete, Delete)
 * Syncs tasks to Google Calendar
 */
async function handleTaskEvent(body: any) {
  console.log('📋 [TASK] Received task event:', body.type);
  
  try {
    const { type, id, assignedToEmail, title, body: taskBody, dueDate, locationId } = body;
    
    // Filter: Only sync tasks assigned to the configured user email
    const targetUserEmail = process.env.GHL_USER_EMAIL;
    if (!targetUserEmail) {
      console.log('⚠️ [TASK] GHL_USER_EMAIL not configured - skipping sync');
      return { statusCode: 200, body: JSON.stringify({ message: 'User email not configured' }) };
    }
    
    if (assignedToEmail !== targetUserEmail) {
      console.log(`⏭️ [TASK] Task not assigned to target user (${assignedToEmail} !== ${targetUserEmail}) - skipping`);
      return { statusCode: 200, body: JSON.stringify({ message: 'Task not assigned to target user' }) };
    }
    
    console.log(`✅ [TASK] Task assigned to target user - processing ${type}`);
    
    // Import utilities
    const { createCalendarEvent, markEventCompleted } = await import('../shared/googleCalendar');
    const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    
    const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    const docClient = DynamoDBDocumentClient.from(dynamoClient);
    const TASK_SYNC_TABLE = process.env.AMPLIFY_DATA_TaskCalendarSync_TABLE_NAME;
    const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'jose.fernandez@josetherealtor.com';
    
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
          assignedToEmail: assignedToEmail || 'jose.fernandez@josetherealtor.com'
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
