/**
 * FACEBOOK WEBHOOK HANDLER - Lambda Version
 * 
 * Handles webhooks from Facebook for:
 * - Messenger conversations (AI responses)
 * - Lead Ads (new lead notifications)
 * - Page events
 */

import type { Handler } from 'aws-lambda';
import crypto from 'crypto';
import axios from 'axios';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getValidGhlToken } from '../shared/ghlTokenManager';
import { generateAIResponse } from '../shared/conversationHandler';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const META_APP_SECRET = process.env.META_APP_SECRET;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const GHL_API_BASE = 'https://services.leadconnectorhq.com';

// Validate environment variables
if (!META_VERIFY_TOKEN || !META_APP_SECRET || !FB_PAGE_ACCESS_TOKEN) {
  throw new Error('Missing required Meta configuration');
}

// Rate limiting: Track message IDs to prevent duplicates
const processedMessages = new Set<string>();

export const handler: Handler = async (event) => {
  // Handle GET requests (webhook verification)
  if (event.requestContext?.http?.method === 'GET') {
    const params = event.queryStringParameters || {};
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
      console.log('✅ [FB_WEBHOOK] Verified');
      return {
        statusCode: 200,
        body: challenge
      };
    }

    return {
      statusCode: 403,
      body: 'Verification failed'
    };
  }

  // Handle POST requests (webhook events)
  try {
    const signature = event.headers['x-hub-signature-256'];
    const rawBody = event.body;

    // Validate signature
    if (!signature || !validateSignature(rawBody, signature)) {
      console.error('❌ [FB_WEBHOOK] Invalid signature');
      return {
        statusCode: 401,
        body: 'Unauthorized'
      };
    }

    const body = JSON.parse(rawBody);
    console.log('📩 [FB_WEBHOOK] Received:', body.object);

    // Handle page events
    if (body.object === 'page') {
      for (const entry of body.entry) {
        // Handle messaging events (Messenger)
        if (entry.messaging) {
          for (const messagingEvent of entry.messaging) {
            await processMessagingEvent(messagingEvent);
          }
        }

        // Handle lead ads
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'leadgen') {
              await processLeadAd(change.value);
            }
          }
        }
      }
    }

    return {
      statusCode: 200,
      body: 'EVENT_RECEIVED'
    };
  } catch (error: any) {
    console.error('❌ [FB_WEBHOOK] Error:', error);
    return {
      statusCode: 500,
      body: 'Internal Server Error'
    };
  }
};

function validateSignature(payload: string, signature: string): boolean {
  const [, hash] = signature.split('=');
  const expectedHash = crypto
    .createHmac('sha256', META_APP_SECRET!)
    .update(payload, 'utf8')
    .digest('hex');
  return hash === expectedHash;
}

async function processMessagingEvent(event: any) {
  const senderPsid = event.sender.id;
  const messageId = event.message?.mid;

  // Prevent duplicate processing
  if (messageId && processedMessages.has(messageId)) {
    console.log(`⏭️ [FB_WEBHOOK] Already processed ${messageId}`);
    return;
  }

  // Ignore echoes (our own messages)
  if (event.message?.is_echo) {
    return;
  }

  // Check for handover events
  if (event.pass_thread_control) {
    console.log(`👤 [FB_WEBHOOK] Thread passed to human for ${senderPsid}`);
    return;
  }

  if (event.take_thread_control) {
    console.log(`🤖 [FB_WEBHOOK] Thread taken back by AI for ${senderPsid}`);
    return;
  }

  if (event.request_thread_control) {
    console.log(`🙋 [FB_WEBHOOK] Human requested control for ${senderPsid}`);
    return;
  }

  // Handle text messages
  if (event.message?.text) {
    const messageText = event.message.text;
    console.log(`💬 [FB_WEBHOOK] Message from ${senderPsid}: ${messageText}`);

    try {
      // Mark as processed
      if (messageId) processedMessages.add(messageId);

      // Generate AI response directly (no GHL contact needed)
      const aiResponse = await generateSimpleAIResponse(messageText, senderPsid);
      
      // Send response via Facebook
      await sendFBMessage(senderPsid, aiResponse);
      console.log(`✅ [FB_WEBHOOK] Sent AI response to ${senderPsid}`);

      // Check if we should hand off to human (qualified lead)
      if (messageText.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/)) {
        // They gave us a phone number - qualified lead, hand off to you
        await passThreadControl(senderPsid, "Lead provided phone number - ready for human follow-up");
      }

    } catch (error: any) {
      console.error(`❌ [FB_WEBHOOK] Error processing message:`, error.message);
      // Send fallback message
      await sendFBMessage(senderPsid, "Thanks for reaching out! I'll get back to you shortly.");
    }
  }

  // Handle postbacks (button clicks)
  if (event.postback) {
    console.log(`🔘 [FB_WEBHOOK] Postback:`, event.postback.payload);
    // TODO: Handle button clicks
  }
}

async function processLeadAd(leadData: any) {
  console.log('📋 [FB_WEBHOOK] New lead ad:', leadData);

  try {
    const leadId = leadData.leadgen_id;
    
    // Fetch full lead details from Facebook
    const leadDetails = await axios.get(
      `https://graph.facebook.com/v18.0/${leadId}`,
      {
        params: { access_token: FB_PAGE_ACCESS_TOKEN }
      }
    );

    const lead = leadDetails.data;
    console.log('📝 [FB_WEBHOOK] Lead details:', lead);

    // Extract form data
    const formData: any = {};
    lead.field_data?.forEach((field: any) => {
      formData[field.name] = field.values[0];
    });

    // Create contact in GHL
    await createGHLContactFromLead(formData);

  } catch (error: any) {
    console.error('❌ [FB_WEBHOOK] Error processing lead ad:', error.message);
  }
}

async function generateSimpleAIResponse(message: string, psid: string): Promise<string> {
  try {
    // Check if message contains an address
    const addressMatch = message.match(/\d+\s+[\w\s]+(st|street|ave|avenue|rd|road|dr|drive|blvd|boulevard|ln|lane|way|ct|court|pl|place|pkwy|parkway)/i);
    
    if (addressMatch) {
      // Extract full address
      const address = addressMatch[0];
      console.log(`🏠 [FB_WEBHOOK] Address detected: ${address}`);
      
      // Call property analyzer
      try {
        const propertyData = await analyzeProperty(address);
        
        if (propertyData.zestimate) {
          const zestimate = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(propertyData.zestimate);
          const cashOffer = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(propertyData.zestimate * 0.7);
          
          return `Great! I pulled up ${address}. Current market value is around ${zestimate}. I can offer ${cashOffer} cash (close in 7 days) or list it for retail to get closer to ${zestimate}. What's the best number to reach you at so we can discuss your options?`;
        } else {
          return `Thanks for the address! I'm pulling up the details now. What's the best number to reach you at so I can call you with a full market analysis?`;
        }
      } catch (error) {
        console.error('❌ [FB_WEBHOOK] Property analysis failed:', error);
        return `Thanks for the address! Let me research ${address} and I'll get back to you with a detailed analysis. What's the best number to reach you at?`;
      }
    }

    // Use OpenAI for other messages
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are Jose Fernandez, a real estate agent with RE/MAX in Florida.

YOUR PERSONALITY:
- Professional but friendly and approachable
- Direct and honest - no pushy sales tactics
- Genuinely want to help people, not just close deals
- Respond quickly and keep messages short (2-3 sentences max)

YOUR EXPERTISE:
- Probate properties (helping families during difficult times)
- Pre-foreclosure situations (finding solutions before it's too late)
- Investment properties (cash buyers and flippers)
- Traditional home sales and purchases
- Market analysis and property valuations

HOW YOU HANDLE LEADS:

**Sellers:**
1. Get property address first (you'll analyze it automatically)
2. After they give address, you'll provide Zestimate and cash offer
3. Present two options: cash offer (quick, as-is) OR list for retail (higher price, takes longer)
4. Get their phone number to discuss details

**Buyers:**
1. Ask what area they're looking in
2. Ask their budget
3. Ask what they need (beds/baths)
4. Get their phone number to send listings

**Probate/Foreclosure:**
- Show empathy - these are tough situations
- Explain you specialize in these cases
- Offer solutions, not just sales pitches
- Mention you can close quickly if needed

**When asking for property address:**
"What's the property address? I'll pull up the current market value for you."

**When they're not ready:**
"No problem! I'm here when you're ready. Feel free to reach out anytime with questions."

**Red flags to watch for:**
- Already working with another agent → Respect that, wish them well
- Just browsing/not serious → Keep it brief, offer to help later

IMPORTANT RULES:
- Keep responses under 160 characters when possible
- Always ask ONE question at a time
- Get contact info (phone number) early
- Never give legal or financial advice
- If you don't know something, say "Let me check on that and get back to you"

Your goal: Build trust, provide value, and get their phone number so you can follow up properly.`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content || "Thanks for reaching out! I'll get back to you shortly.";
  } catch (error: any) {
    console.error('❌ [FB_WEBHOOK] OpenAI error:', error.message);
    return "Thanks for reaching out! I'm Jose Fernandez with RE/MAX. How can I help you today?";
  }
}

async function analyzeProperty(address: string): Promise<any> {
  try {
    const response = await axios.post(
      `${process.env.APP_URL}/api/v1/analyze-property`,
      { address },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('❌ [FB_WEBHOOK] Property analysis error:', error.message);
    throw error;
  }
}

// Simple in-memory pause tracking (resets on Lambda cold start)
const pausedContacts = new Set<string>();

async function pauseAIForContact(psid: string) {
  pausedContacts.add(psid);
  // Auto-resume after 24 hours
  setTimeout(() => pausedContacts.delete(psid), 24 * 60 * 60 * 1000);
}

async function isAIPaused(psid: string): Promise<boolean> {
  return pausedContacts.has(psid);
}

async function findContactByPSID(psid: string): Promise<any> {
  try {
    // Look up in OutreachQueue by Facebook PSID
    const result = await docClient.send(new ScanCommand({
      TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME!,
      FilterExpression: 'facebookPsid = :psid',
      ExpressionAttributeValues: {
        ':psid': psid
      },
      Limit: 1
    }));

    if (result.Items && result.Items.length > 0) {
      return {
        userId: result.Items[0].userId,
        ghlContactId: result.Items[0].contactId
      };
    }

    return null;
  } catch (error: any) {
    console.error('❌ [FB_WEBHOOK] Error finding contact:', error.message);
    return null;
  }
}

async function sendFBMessage(recipientPsid: string, messageText: string) {
  try {
    await axios.post(
      'https://graph.facebook.com/v18.0/me/messages',
      {
        recipient: { id: recipientPsid },
        message: { text: messageText }
      },
      {
        params: { access_token: FB_PAGE_ACCESS_TOKEN }
      }
    );
  } catch (error: any) {
    console.error('❌ [FB_WEBHOOK] Error sending message:', error.response?.data || error.message);
  }
}

async function passThreadControl(recipientPsid: string, metadata: string) {
  try {
    // Pass control to Page Inbox (app ID 263902037430900)
    await axios.post(
      'https://graph.facebook.com/v18.0/me/pass_thread_control',
      {
        recipient: { id: recipientPsid },
        target_app_id: 263902037430900, // Facebook Page Inbox
        metadata: metadata
      },
      {
        params: { access_token: FB_PAGE_ACCESS_TOKEN }
      }
    );
    console.log(`👤 [FB_WEBHOOK] Passed control to human for ${recipientPsid}`);
  } catch (error: any) {
    console.error('❌ [FB_WEBHOOK] Error passing control:', error.response?.data || error.message);
  }
}

async function updateOutreachStatus(contactId: string, status: 'OUTREACH' | 'CONVERSATION' | 'DND' | 'WRONG_INFO' | 'COMPLETED') {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME!,
      FilterExpression: 'contactId = :contactId AND channel = :channel',
      ExpressionAttributeValues: {
        ':contactId': contactId,
        ':channel': 'FACEBOOK'
      },
      Limit: 1
    }));

    if (result.Items && result.Items.length > 0) {
      const { updateQueueStatus } = await import('../shared/outreachQueue');
      await updateQueueStatus(result.Items[0].id, status);
    }
  } catch (error: any) {
    console.error('❌ [FB_WEBHOOK] Error updating queue:', error.message);
  }
}

async function createGHLContactFromLead(formData: any) {
  try {
    // Get first active GHL integration
    const integrationResult = await docClient.send(new ScanCommand({
      TableName: process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME!,
      Limit: 1
    }));

    if (!integrationResult.Items?.length) {
      console.error('❌ [FB_WEBHOOK] No GHL integration found');
      return;
    }

    const tokenData = await getValidGhlToken(integrationResult.Items[0].userId);
    if (!tokenData) return;

    // Create contact in GHL
    const contactData = {
      firstName: formData.first_name || formData.full_name?.split(' ')[0],
      lastName: formData.last_name || formData.full_name?.split(' ').slice(1).join(' '),
      email: formData.email,
      phone: formData.phone_number,
      source: 'Facebook Lead Ad',
      tags: ['facebook-lead', 'new-lead']
    };

    const response = await axios.post(
      `${GHL_API_BASE}/contacts/`,
      contactData,
      {
        headers: {
          Authorization: `Bearer ${tokenData.token}`,
          Version: '2021-07-28'
        }
      }
    );

    console.log(`✅ [FB_WEBHOOK] Created GHL contact: ${response.data.contact.id}`);

    // TODO: Send notification to you about new lead

  } catch (error: any) {
    console.error('❌ [FB_WEBHOOK] Error creating contact:', error.response?.data || error.message);
  }
}
