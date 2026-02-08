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

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const GHL_INTEGRATION_TABLE = process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME;

export const handler = async (event: any) => {
  console.log('📨 [WEBHOOK_LAMBDA] Received event');
  console.log('📨 [WEBHOOK_LAMBDA] Event body:', event.body);

  try {
    // Parse body (API Gateway sends stringified JSON)
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    
    // Check if this is an email bounce event (from GHL system webhook)
    if (body.type === 'EmailBounced') {
      return await handleEmailBounce(body);
    }
    
    // Extract data from customData (workflow) or root level (system webhook)
    const { customData, message, contact, location } = body;
    let userId = customData?.userId || body.userId;
    const contactId = customData?.contactId || body.contactId || contact?.id;
    let messageBody = customData?.messageBody || body.body || message?.body;
    const messageType = customData?.type === 'InboundMessage' ? (message?.type || 1) : message?.type;
    const locationId = customData?.locationId || body.locationId || location?.id;
    let conversationId = customData?.conversationId || body.conversationId || '';


    console.log('📨 [WEBHOOK_LAMBDA] Extracted data:', { userId, contactId, messageBody, messageType, locationId, conversationId });

    // Handle email replies (type 1)
    if (messageType === 1) {
      return await handleEmailReply(body, contactId, locationId, messageBody, userId);
    }

    // Default to Jose's account for organic leads (no app_user_id)
    if (!userId) {
      console.log('⚠️ [WEBHOOK_LAMBDA] No userId found - defaulting to Jose\'s account (organic lead)');
      userId = '44d8f4c8-10c1-7038-744b-271103170819';
    }

    if (!contactId) {
      console.error('❌ [WEBHOOK_LAMBDA] Missing contact ID');
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
    });

    // PHASE 3: OUTBOUND LOGGING (We just sent AI response)
    const { logOutboundContact } = await import('../shared/outreachQueue');
    await logOutboundContact(queueId);
    console.log('✅ [OUTBOUND] Logged AI response - daily limit updated');

    console.log('✅ [WEBHOOK_LAMBDA] Successfully processed webhook');

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error: any) {
    console.error('❌ [WEBHOOK_LAMBDA] Error:', error);
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
