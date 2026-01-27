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
    
    const { customData, message, contact, location } = body;
    let userId = customData?.userId;
    const contactId = customData?.contactId || contact?.id;
    let messageBody = customData?.messageBody || message?.body;
    const messageType = message?.type; // 2 = SMS, 3 = Facebook Messenger, 4 = Instagram, 18 = Instagram Story Reply
    const locationId = location?.id;
    let conversationId = customData?.conversationId || '';

    console.log('📨 [WEBHOOK_LAMBDA] Extracted data:', { userId, contactId, messageBody, messageType, locationId, conversationId });

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
      cashOffer
    });

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
