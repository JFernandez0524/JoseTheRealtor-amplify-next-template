/**
 * THANKS.IO WEBHOOK HANDLER
 * 
 * Handles webhooks from thanks.io for:
 * - Order Item Status Updates (delivery tracking)
 * - QR Code Scans (engagement tracking)
 * 
 * Updates GHL contacts with mail tracking data
 */

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

// Custom field IDs in GHL
const CUSTOM_FIELD_IDS = {
  MAIL_SENT_COUNT: 'DTEW0PLqxp35WHOiDLWR',
  LAST_MAIL_DATE: '4fRJXKv1A22BdMLrJfxO',
  MAIL_DELIVERY_DATE: 'bQqrO0OicE1N7EShmoQZ',
  QR_SCAN_COUNT: '981A5iFqndhODq2naOu4',
};

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.log('📬 [THANKS.IO] Received webhook:', payload.event_type);

    const eventType = payload.event_type;
    const data = payload.data;

    // Extract contact identifier (use custom_1 for GHL contact ID)
    const ghlContactId = data['recipient.custom_1'];
    
    if (!ghlContactId) {
      console.log('⚠️ [THANKS.IO] No GHL contact ID in custom_1 field');
      return NextResponse.json({ success: true, message: 'No contact ID' });
    }

    // Handle different event types
    if (eventType === 'order_item.status_update') {
      await handleDeliveryUpdate(ghlContactId, data);
    } else if (eventType === 'scans.scan_update') {
      await handleQRScan(ghlContactId, data);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ [THANKS.IO] Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleDeliveryUpdate(contactId: string, data: any) {
  const currentStatus = data['order_item.current_status'];
  const deliveryDate = data['order_item.delivery_date'];
  const orderId = data['order.id'];

  console.log(`📦 [THANKS.IO] Delivery update for ${contactId}: ${currentStatus}`);

  // Only process "Delivered" status
  if (currentStatus !== 'Delivered') {
    return;
  }

  // Get GHL token
  const token = await getGhlToken(contactId);
  if (!token) return;

  // Get current contact to check mail count
  const contactResponse = await axios.get(
    `${GHL_API_BASE}/contacts/${contactId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: '2021-07-28'
      }
    }
  );

  const contact = contactResponse.data.contact;
  const currentMailCount = parseInt(contact.customFields?.find((f: any) => f.id === CUSTOM_FIELD_IDS.MAIL_SENT_COUNT)?.value || '0');
  const newMailCount = currentMailCount + 1;

  // Determine which stage to move to based on mail count
  const stageMap: Record<number, string> = {
    1: 'Touch 1 - Delivered',
    2: 'Touch 2 - Delivered', 
    3: 'Touch 3 - Delivered'
  };

  const newStage = stageMap[newMailCount];

  // Update GHL contact
  await axios.put(
    `${GHL_API_BASE}/contacts/${contactId}`,
    {
      customFields: [
        {
          id: CUSTOM_FIELD_IDS.MAIL_SENT_COUNT,
          value: newMailCount.toString()
        },
        {
          id: CUSTOM_FIELD_IDS.LAST_MAIL_DATE,
          value: deliveryDate
        },
        {
          id: CUSTOM_FIELD_IDS.MAIL_DELIVERY_DATE,
          value: deliveryDate
        }
      ],
      tags: ['mail:delivered', `mail:touch${newMailCount}`]
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: '2021-07-28'
      }
    }
  );

  console.log(`✅ [THANKS.IO] Updated contact ${contactId} - mail ${newMailCount} delivered, stage: ${newStage}`);
}

async function handleQRScan(contactId: string, data: any) {
  const scanCount = data['order_item.scans'];
  const qrUrl = data['qrcode.url'];

  console.log(`📱 [THANKS.IO] QR scan for ${contactId}: ${scanCount} scans`);

  // Get GHL token
  const token = await getGhlToken(contactId);
  if (!token) return;

  // Update GHL contact with scan count and high-engagement tag
  await axios.put(
    `${GHL_API_BASE}/contacts/${contactId}`,
    {
      customFields: [
        {
          id: CUSTOM_FIELD_IDS.QR_SCAN_COUNT,
          value: scanCount.toString()
        }
      ],
      tags: ['mail:scanned', 'high-engagement']
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: '2021-07-28'
      }
    }
  );

  console.log(`✅ [THANKS.IO] Updated contact ${contactId} - QR scanned ${scanCount} times`);
}

async function getGhlToken(contactId: string): Promise<string | null> {
  try {
    // Get contact from GHL to find which location it belongs to
    // We'll use a system token or find the user from the locationId
    
    // For now, get the first active integration for the location
    // TODO: Improve this to match contact to specific user
    const { generateServerClientUsingReqRes } = await import('@/app/utils/aws/amplifyServerUtils');
    const { cookieBasedClient } = await generateServerClientUsingReqRes();
    
    const { data: integrations } = await cookieBasedClient.models.GhlIntegration.list({
      filter: {
        locationId: { eq: 'mHaAy3ZaUHgrbPyughDG' },
        isActive: { eq: true }
      }
    });
    
    if (!integrations || integrations.length === 0) {
      console.error('❌ No active GHL integration found');
      return null;
    }
    
    const integration = integrations[0];
    
    // Check if token is expired and refresh if needed
    const expiresAt = new Date(integration.expiresAt);
    const now = new Date();
    
    if (expiresAt <= now) {
      console.log('🔄 Token expired, refreshing...');
      // Token refresh logic here (use existing ghlTokenManager)
      return null;
    }
    
    return integration.accessToken;
  } catch (error) {
    console.error('❌ Error getting GHL token:', error);
    return null;
  }
}
