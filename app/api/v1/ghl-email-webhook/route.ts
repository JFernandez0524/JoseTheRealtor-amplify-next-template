import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * GHL EMAIL WEBHOOK HANDLER
 * 
 * Handles email events from GoHighLevel:
 * - InboundMessage (email replies)
 * - EmailBounced (delivery failures)
 * 
 * WEBHOOK SETUP IN GHL:
 * Settings → Integrations → Webhooks
 * - Event: InboundMessage (Email)
 * - Event: EmailBounced
 * - URL: https://leads.josetherealtor.com/api/v1/ghl-email-webhook
 */
export async function POST(req: Request) {
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

    // Stop automated emails - contact has replied
    await axios.put(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        tags: ['Email:Replied'], // Add tag to stop automation
        customFields: [
          { id: 'wWlrXoXeMXcM6kUexf2L', value: '99' } // Set counter to 99 to stop drip
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

    console.log(`✅ Marked contact ${contactId} as replied - stopped automation`);

    // TODO: Notify user of reply (email, SMS, or dashboard notification)

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
