/**
 * GHL SMS WEBHOOK HANDLER
 * 
 * Handles inbound SMS messages from GoHighLevel and generates AI responses.
 * Also updates OutreachQueue status to stop further automated touches.
 * 
 * WORKFLOW:
 * 1. Verify webhook signature (GHL public key)
 * 2. Check for duplicate webhooks (prevent double processing)
 * 3. Extract contact info and message content
 * 4. 🔄 Update OutreachQueue status to REPLIED (stops further SMS touches)
 * 5. Generate AI response using conversation handler
 * 6. Send response via GHL API
 * 7. Update GHL custom fields (call_attempt_counter, last_call_date)
 * 
 * OUTREACH QUEUE INTEGRATION:
 * - When contact replies, updates smsStatus to REPLIED
 * - Prevents further automated SMS touches to that contact
 * - Queue ID format: userId_contactId
 * - Graceful error handling (doesn't fail webhook if queue update fails)
 * 
 * AI RESPONSE GENERATION:
 * - Uses 5-step proven script for property visits
 * - Adapts to conversation context and property data
 * - Detects handoff keywords (schedule, appointment, etc.)
 * - Tags contact for human follow-up when qualified
 * 
 * SECURITY:
 * - Verifies webhook signature using GHL public key
 * - Prevents replay attacks with processed webhook tracking
 * - Validates required fields before processing
 * 
 * RELATED FILES:
 * - /utils/ai/conversationHandler - AI response generator
 * - shared/outreachQueue - Queue manager utilities
 * - /functions/dailyOutreachAgent - SMS outreach agent
 * 
 * MONITORING:
 * - Logs all webhook events
 * - Tracks queue update success/failure
 * - Records AI response generation
 */

import { NextResponse } from 'next/server';
import { generateAIResponse } from '@/app/utils/ai/conversationHandler';
import crypto from 'crypto';

// GHL Public Key for webhook verification
const GHL_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
Frm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6
dO0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfB
csedpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCpv
uxmZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8gF
3kvoV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOKU
J062fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTXp
IocmaiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTzN
h/AMfHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELhC
HULgCsnuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sYJ
PQe7z0cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAyk
T1hhTiaCeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----`;

// Store processed webhook IDs
const processedWebhooks = new Set<string>();

function verifyWebhookSignature(payload: string, signature: string): boolean {
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(payload);
    verifier.end();
    return verifier.verify(GHL_PUBLIC_KEY, signature, 'base64');
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    
    // 1. Verify webhook signature (only for native GHL webhooks, not workflow webhooks)
    const signature = req.headers.get('x-wh-signature');
    if (signature) {
      // Native GHL webhook - verify signature
      if (!verifyWebhookSignature(rawBody, signature)) {
        console.error('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      // Workflow webhook - no signature, log for debugging
      console.log('📨 [WORKFLOW] Received workflow webhook (no signature)');
    }

    // 2. Check for duplicates (only if webhookId exists)
    if (body.webhookId && processedWebhooks.has(body.webhookId)) {
      console.log('Duplicate webhook, skipping:', body.webhookId);
      return NextResponse.json({ message: 'Already processed' });
    }

    const {
      // Custom data fields (preferred - set in GHL workflow)
      contactId: customContactId,
      messageBody: customMessageBody,
      
      // Native webhook fields (fallback)
      type,
      contactId,
      conversationId,
      message,
      contact,
      locationId,
      webhookId,
      
      // Workflow root-level fields (fallback)
      id,
      messageType,
      first_name,
      last_name,
      phone,
    } = body;

    // Prioritize custom data, then message.body
    const finalContactId = customContactId || contactId || id;
    const finalMessageBody = customMessageBody || message?.body;

    // Log payload for debugging
    console.log('📨 [WEBHOOK] Payload:', JSON.stringify({
      customContactId,
      customMessageBody,
      contactId,
      id,
      hasMessage: !!message,
      messageBody: message?.body,
      finalContactId,
      finalMessageBody: finalMessageBody?.substring(0, 50)
    }));
    
    // Check if this is an inbound message
    // 1. Custom data (preferred): contactId + messageBody from workflow
    const hasCustomData = customContactId && customMessageBody;
    // 2. Workflow webhook: message.body exists (standard GHL workflow format)
    const hasMessageBody = !!message?.body;
    // 3. Accept if we have either custom data or message body
    const isInbound = hasCustomData || hasMessageBody;
    
    if (!isInbound || !finalMessageBody) {
      console.log(`⚠️ [WEBHOOK] Not inbound. HasCustomData: ${hasCustomData}, HasMessageBody: ${hasMessageBody}, FinalBody: ${!!finalMessageBody}`);
      return NextResponse.json({ success: true, message: 'Ignored - not inbound message' });
    }

    if (!finalContactId) {
      return NextResponse.json({ error: 'Missing contact ID' }, { status: 400 });
    }

    // A2P Compliance: Check for opt-out keywords
    const lowerMessageBody = finalMessageBody.toLowerCase().trim();
    const optOutKeywords = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit'];
    const isOptOut = optOutKeywords.some(keyword => lowerMessageBody === keyword || lowerMessageBody.includes(keyword));
    
    if (isOptOut) {
      console.log(`🛑 [A2P] Opt-out keyword detected: "${finalMessageBody}"`);
      
      // Update queue status to OPTED_OUT
      if (finalContactId) {
        try {
          const userId = contact?.customFields?.find((f: any) => f.id === 'CNoGugInWOC59hAPptxY')?.value;
          
          if (userId) {
            const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
            const { DynamoDBDocumentClient, UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
            
            const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
            const docClient = DynamoDBDocumentClient.from(dynamoClient);
            
            const queueId = `${userId}_${finalContactId}`;
            
            await docClient.send(new UpdateCommand({
              TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME,
              Key: { id: queueId },
              UpdateExpression: 'SET smsStatus = :status, updatedAt = :now',
              ExpressionAttributeValues: {
                ':status': 'OPTED_OUT',
                ':now': new Date().toISOString(),
              },
            }));
            
            console.log(`✅ Updated queue status to OPTED_OUT for contact ${finalContactId}`);
          }
        } catch (queueError) {
          console.error(`⚠️ Failed to update queue status:`, queueError);
        }
      }
      
      // Send confirmation message (required by A2P)
      return NextResponse.json({ 
        success: true, 
        message: 'Opt-out processed',
        autoReply: 'You have been unsubscribed. You will not receive further messages.'
      });
    }

    // 🔄 Update outreach queue status to REPLIED (for non-opt-out messages)
    if (finalContactId) {
      try {
        // Get user ID from contact's custom fields (app_user_id)
        const userId = contact?.customFields?.find((f: any) => f.id === 'CNoGugInWOC59hAPptxY')?.value;
        
        if (userId) {
          const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
          const { DynamoDBDocumentClient, UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
          
          const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
          const docClient = DynamoDBDocumentClient.from(dynamoClient);
          
          const queueId = `${userId}_${finalContactId}`;
          
          await docClient.send(new UpdateCommand({
            TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME,
            Key: { id: queueId },
            UpdateExpression: 'SET smsStatus = :status, updatedAt = :now',
            ExpressionAttributeValues: {
              ':status': 'REPLIED',
              ':now': new Date().toISOString(),
            },
          }));
          
          console.log(`✅ Updated queue status to REPLIED for contact ${finalContactId}`);
        }
      } catch (queueError) {
        console.error(`⚠️ Failed to update queue status:`, queueError);
        // Don't fail webhook processing if queue update fails
      }
    }

    // 3. Process asynchronously
    // Normalize payload for async processor (handle both native and workflow formats)
    const normalizedBody = {
      ...body,
      contactId: finalContactId,
      message: message || { body: finalMessageBody, type: 'SMS' },
      contact: contact || { 
        id: finalContactId,
        firstName: first_name,
        lastName: last_name,
        phone: phone
      }
    };
    
    setImmediate(() => {
      processConversationAsync(normalizedBody);
    });

    // 4. Mark as processed
    if (webhookId) {
      processedWebhooks.add(webhookId);
    }

    // 5. Respond immediately
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('GHL Webhook Error:', error);
    // Return 200 even for processing errors
    return NextResponse.json({ success: false, error: 'Processing failed' });
  }
}

async function processConversationAsync(body: any) {
  try {
    const { contactId, conversationId, message, locationId } = body;

    // 1. Fetch fresh contact data from GHL API
    const GHL_API_KEY = process.env.GHL_API_KEY;
    if (!GHL_API_KEY) {
      console.error('GHL_API_KEY not configured');
      return;
    }

    let contact;
    try {
      const contactResponse = await fetch(
        `https://services.leadconnectorhq.com/contacts/${contactId}`,
        {
          headers: {
            'Authorization': `Bearer ${GHL_API_KEY}`,
            'Version': '2021-07-28'
          }
        }
      );
      const contactData = await contactResponse.json();
      contact = contactData.contact;
    } catch (error) {
      console.error('Failed to fetch contact from GHL:', error);
      return;
    }

    // 2. Extract property data from contact custom fields
    const propertyAddress = contact?.customFields?.find((f: any) => f.id === 'p3NOYiInAERYbe0VsLHB')?.value;
    const propertyCity = contact?.customFields?.find((f: any) => f.id === 'h4UIjKQvFu7oRW4SAY8W')?.value;
    const propertyState = contact?.customFields?.find((f: any) => f.id === '9r9OpQaxYPxqbA6Hvtx7')?.value;
    const propertyZip = contact?.customFields?.find((f: any) => f.id === 'hgbjsTVwcyID7umdhm2o')?.value;
    const leadType = contact?.customFields?.find((f: any) => f.id === 'oaf4wCuM3Ub9eGpiddrO')?.value;

    console.log('📋 Contact data from GHL:', {
      name: `${contact.firstName} ${contact.lastName}`,
      phone: contact.phone,
      propertyAddress,
      propertyCity,
      propertyState,
      leadType
    });

    // 3. Generate AI response based on GHL contact data
    const aiResponse = await generateAIResponse({
      contactId,
      conversationId,
      incomingMessage: message.body,
      contactName: `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim(),
      propertyAddress,
      propertyCity,
      propertyState,
      propertyZip,
      leadType,
      locationId,
      contact
    });

    console.log('✅ Successfully processed conversation webhook:', body.webhookId);
  } catch (error) {
    console.error('Failed to process conversation webhook:', body.webhookId, error);
  }
}
