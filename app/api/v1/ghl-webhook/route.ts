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
    
    // 1. Verify webhook signature
    const signature = req.headers.get('x-wh-signature');
    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. Check for duplicates
    if (body.webhookId && processedWebhooks.has(body.webhookId)) {
      console.log('Duplicate webhook, skipping:', body.webhookId);
      return NextResponse.json({ message: 'Already processed' });
    }

    const {
      type,
      contactId,
      conversationId,
      message,
      contact,
      locationId,
      webhookId
    } = body;

    // Only handle incoming messages from contacts
    if (type !== 'InboundMessage' || !message?.body) {
      return NextResponse.json({ success: true, message: 'Ignored' });
    }

    // 🔄 Update outreach queue status to REPLIED
    if (contactId) {
      try {
        // Get user ID from contact's custom fields (app_user_id)
        const userId = contact?.customFields?.find((f: any) => f.id === 'CNoGugInWOC59hAPptxY')?.value;
        
        if (userId) {
          const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
          const { DynamoDBDocumentClient, UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
          
          const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
          const docClient = DynamoDBDocumentClient.from(dynamoClient);
          
          const queueId = `${userId}_${contactId}`;
          
          await docClient.send(new UpdateCommand({
            TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME,
            Key: { id: queueId },
            UpdateExpression: 'SET smsStatus = :status, updatedAt = :now',
            ExpressionAttributeValues: {
              ':status': 'REPLIED',
              ':now': new Date().toISOString(),
            },
          }));
          
          console.log(`✅ Updated queue status to REPLIED for contact ${contactId}`);
        }
      } catch (queueError) {
        console.error(`⚠️ Failed to update queue status:`, queueError);
        // Don't fail webhook processing if queue update fails
      }
    }

    // 3. Process asynchronously
    setImmediate(() => {
      processConversationAsync(body);
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
