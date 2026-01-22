/**
 * GHL EMAIL WEBHOOK HANDLER
 * 
 * Handles email events from GoHighLevel and updates OutreachQueue status.
 * Processes both email replies (InboundMessage) and bounces (EmailBounced).
 * 
 * WEBHOOK EVENTS:
 * 1. InboundMessage (Email Reply)
 *    - Contact replied to prospecting email
 *    - Updates queue emailStatus to REPLIED
 *    - Generates AI response using AMMO framework
 *    - Tags contact with "email:replied"
 *    - Stops further automated email touches
 * 
 * 2. EmailBounced (Delivery Failure)
 *    - Email address is invalid or unreachable
 *    - Updates queue emailStatus to BOUNCED
 *    - Tags contact with "email:bounced"
 *    - Stops further email attempts to that address
 * 
 * OUTREACH QUEUE INTEGRATION:
 * - When contact replies: emailStatus → REPLIED (stops touches)
 * - When email bounces: emailStatus → BOUNCED (stops touches)
 * - Queue ID format: userId_contactId
 * - Graceful error handling (doesn't fail webhook if queue update fails)
 * 
 * AI RESPONSE GENERATION (Replies Only):
 * - Uses AMMO framework (Hook-Relate-Bridge-Ask)
 * - Adapts to conversation context and property data
 * - Detects handoff keywords (schedule, appointment, etc.)
 * - Tags contact for human follow-up when qualified
 * 
 * WORKFLOW:
 * 1. Receive webhook from GHL
 * 2. Validate required fields (contactId, locationId)
 * 3. Fetch contact details from GHL
 * 4. Extract userId from custom field
 * 5. 🔄 Update OutreachQueue status (REPLIED or BOUNCED)
 * 6. For replies: Generate and send AI response
 * 7. Update GHL tags and custom fields
 * 
 * WEBHOOK SETUP IN GHL:
 * Settings → Integrations → Webhooks
 * - Event: InboundMessage (Email)
 * - Event: EmailBounced
 * - URL: https://leads.josetherealtor.com/api/v1/ghl-email-webhook
 * 
 * RELATED FILES:
 * - /utils/ai/emailConversationHandler - AI email response generator
 * - shared/outreachQueue - Queue manager utilities
 * - /functions/dailyEmailAgent - Email outreach agent
 * 
 * MONITORING:
 * - Logs all webhook events
 * - Tracks queue update success/failure
 * - Records AI response generation
 * - Monitors bounce rate
 */

import { NextResponse } from 'next/server';
import axios from 'axios';
  try {
    const payload = await req.json();
    console.log('📧 Email webhook received:', payload.type);

    const { type, contactId, locationId, body, subject, from } = payload;

    if (!contactId || !locationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Handle different email events
    switch (type) {
      case 'InboundMessage':
        await handleEmailReply(contactId, locationId, body, from);
        break;
        
      case 'EmailBounced':
        await handleEmailBounce(contactId, locationId, payload.bounceReason);
        break;
        
      default:
        console.log(`⚠️ Unhandled email event type: ${type}`);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('❌ Email webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Handle email reply from contact
 */
async function handleEmailReply(
  contactId: string,
  locationId: string,
  body: string,
  from: string
): Promise<void> {
  console.log(`📬 Email reply from ${from}`);

  try {
    // Get user's GHL token (find by locationId)
    const token = await getGhlTokenByLocation(locationId);
    if (!token) {
      console.error('No GHL integration found for location:', locationId);
      return;
    }

    // Fetch full contact details
    const contactResponse = await axios.get(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Version': '2021-07-28'
        }
      }
    );

    const contact = contactResponse.data.contact;
    
    // 🔄 Update outreach queue status to REPLIED
    const userId = contact?.customFields?.find((f: any) => f.id === 'CNoGugInWOC59hAPptxY')?.value;
    
    if (userId) {
      try {
        const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
        
        const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
        const docClient = DynamoDBDocumentClient.from(dynamoClient);
        
        const queueId = `${userId}_${contactId}`;
        
        await docClient.send(new UpdateCommand({
          TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME,
          Key: { id: queueId },
          UpdateExpression: 'SET emailStatus = :status, updatedAt = :now',
          ExpressionAttributeValues: {
            ':status': 'REPLIED',
            ':now': new Date().toISOString(),
          },
        }));
        
        console.log(`✅ Updated queue status to REPLIED for contact ${contactId}`);
      } catch (queueError) {
        console.error(`⚠️ Failed to update queue status:`, queueError);
      }
    }

    // Check if AI is enabled for this contact
    const aiState = contact?.customFields?.find((f: any) => f.id === '1NxQW2kKMVgozjSUuu7s')?.value;
    
    if (aiState === 'running' || aiState === 'not_started') {
      // Generate AI response
      const { generateEmailAIResponse } = await import('@/app/utils/ai/emailConversationHandler');
      
      const propertyAddress = contact?.customFields?.find((f: any) => f.id === 'p3NOYiInAERYbe0VsLHB')?.value;
      const propertyCity = contact?.customFields?.find((f: any) => f.id === 'h4UIjKQvFu7oRW4SAY8W')?.value;
      const propertyState = contact?.customFields?.find((f: any) => f.id === '9r9OpQaxYPxqbA6Hvtx7')?.value;
      const propertyZip = contact?.customFields?.find((f: any) => f.id === 'hgbjsTVwcyID7umdhm2o')?.value;
      const leadType = contact?.customFields?.find((f: any) => f.id === 'oaf4wCuM3Ub9eGpiddrO')?.value;

      await generateEmailAIResponse({
        contactId,
        conversationId: 'auto',
        incomingMessage: body,
        contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        propertyAddress,
        propertyCity,
        propertyState,
        propertyZip,
        leadType,
        locationId,
        contact,
        accessToken: token
      });

      console.log(`✅ AI email response sent to ${from}`);
    } else {
      // AI not active - just tag as replied
      await axios.put(
        `https://services.leadconnectorhq.com/contacts/${contactId}`,
        {
          tags: ['email:replied']
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28'
          }
        }
      );

      console.log(`✅ Marked contact ${contactId} as replied (AI not active)`);
    }

  } catch (error: any) {
    console.error('Failed to handle email reply:', error.message);
  }
}

/**
 * Handle bounced email
 */
async function handleEmailBounce(
  contactId: string,
  locationId: string,
  bounceReason?: string
): Promise<void> {
  console.log(`⚠️ Email bounced for contact ${contactId}: ${bounceReason}`);

  try {
    // Get user's GHL token
    const token = await getGhlTokenByLocation(locationId);
    if (!token) {
      console.error('No GHL integration found for location:', locationId);
      return;
    }

    // Fetch contact to get userId
    const contactResponse = await axios.get(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Version': '2021-07-28'
        }
      }
    );

    const contact = contactResponse.data.contact;
    const userId = contact?.customFields?.find((f: any) => f.id === 'CNoGugInWOC59hAPptxY')?.value;
    
    // 🔄 Update outreach queue status to BOUNCED
    if (userId) {
      try {
        const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
        
        const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
        const docClient = DynamoDBDocumentClient.from(dynamoClient);
        
        const queueId = `${userId}_${contactId}`;
        
        await docClient.send(new UpdateCommand({
          TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME,
          Key: { id: queueId },
          UpdateExpression: 'SET emailStatus = :status, updatedAt = :now',
          ExpressionAttributeValues: {
            ':status': 'BOUNCED',
            ':now': new Date().toISOString(),
          },
        }));
        
        console.log(`✅ Updated queue status to BOUNCED for contact ${contactId}`);
      } catch (queueError) {
        console.error(`⚠️ Failed to update queue status:`, queueError);
      }
    }

    // Mark contact with bounce tag and stop emails
    await axios.put(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        tags: ['Email:Bounced'], // Add bounce tag
        customFields: [
          { id: 'wWlrXoXeMXcM6kUexf2L', value: '99' } // Stop email attempts
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );

    console.log(`✅ Marked contact ${contactId} as bounced - stopped emails`);

  } catch (error: any) {
    console.error('Failed to handle email bounce:', error.message);
  }
}

/**
 * Get GHL token by locationId
 * Helper to find user's integration from locationId
 */
async function getGhlTokenByLocation(locationId: string): Promise<string | null> {
  try {
    // Import here to avoid circular dependencies
    const { cookiesClient } = await import('@/app/utils/aws/auth/amplifyServerUtils.server');
    
    const { data: integrations } = await cookiesClient.models.GhlIntegration.list({
      filter: {
        locationId: { eq: locationId },
        isActive: { eq: true }
      }
    });

    if (!integrations || integrations.length === 0) {
      return null;
    }

    const integration = integrations[0];
    
    // Check if token is expired and refresh if needed
    const isExpired = new Date(integration.expiresAt) < new Date();
    if (isExpired && integration.refreshToken) {
      const { refreshGhlToken } = await import('@/app/utils/aws/data/ghlIntegration.server');
      return await refreshGhlToken(integration.id, integration.refreshToken);
    }

    return integration.accessToken;
  } catch (error: any) {
    console.error('Failed to get GHL token by location:', error.message);
    return null;
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/v1/ghl-email-webhook',
    method: 'POST',
    description: 'Webhook for GHL email events (replies and bounces)',
    events: ['InboundMessage', 'EmailBounced']
  });
}
