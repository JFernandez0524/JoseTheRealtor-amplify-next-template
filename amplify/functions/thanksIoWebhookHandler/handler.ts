/**
 * THANKS.IO WEBHOOK HANDLER - Lambda Version
 * 
 * Handles webhooks from thanks.io for:
 * - Order Item Status Updates (delivery tracking)
 * - QR Code Scans (engagement tracking)
 * 
 * Updates GHL contacts with mail tracking data
 */

import type { Handler } from 'aws-lambda';
import { getValidGhlToken } from '../shared/ghlTokenManager';
import { ghlGetContact, ghlUpdateContact } from '../shared/ghlClient';
import { resolveOwnerByGhlContactId } from '../shared/tenantResolver';


export const handler: Handler = async (event) => {
  try {
    const payload = JSON.parse(event.body || '{}');
    console.log('📬 [THANKS.IO] Received webhook:', payload.event_type);

    const eventType = payload.event_type;
    const data = payload.data;

    // Extract contact identifier (use custom_1 for GHL contact ID)
    const ghlContactId = data['recipient.custom_1'];
    
    if (!ghlContactId) {
      console.log('⚠️ [THANKS.IO] No GHL contact ID in custom_1 field');
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'No contact ID' })
      };
    }

    // Handle different event types
    if (eventType === 'order_item.status_update') {
      await handleDeliveryUpdate(ghlContactId, data);
    } else if (eventType === 'scans.scan_update') {
      await handleQRScan(ghlContactId, data);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error: any) {
    console.error('❌ [THANKS.IO] Webhook error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook processing failed' })
    };
  }
};

async function handleDeliveryUpdate(contactId: string, data: any) {
  const itemStatus = data['order_item.current_status'];
  const orderStatus = data['order.status'];
  const deliveryDate = data['order_item.delivery_date'];

  console.log(`📦 [THANKS.IO] Delivery update for ${contactId}: order=${orderStatus}, item=${itemStatus}, delivered=${deliveryDate}`);

  // Check order-level status for "Delivered"
  if (orderStatus !== 'Delivered') {
    console.log(`⏭️ [THANKS.IO] Skipping - order not delivered yet`);
    return;
  }

  // Resolve the owning tenant from our own records (multi-tenant safe).
  const userId = await resolveOwnerByGhlContactId(contactId);
  if (!userId) {
    console.error(`❌ [THANKS.IO] No owner found for contact ${contactId} — skipping`);
    return;
  }

  // Get GHL token and dynamic field IDs
  const tokenData = await getValidGhlToken(userId);
  if (!tokenData) return;

  const { token } = tokenData;
  const fieldIds: Record<string, string> = tokenData.customFieldIds || {};

  const contact = await ghlGetContact(token, contactId);
  const mailSentCountId = fieldIds.mail_sent_count;
  const lastMailDateId = fieldIds.last_mail_date;
  const mailDeliveryDateId = fieldIds.mail_delivery_date;

  const currentMailCount = mailSentCountId
    ? parseInt(contact.customFields?.find((f: any) => f.id === mailSentCountId)?.value || '0')
    : 0;
  const newMailCount = currentMailCount + 1;

  // Update GHL contact
  const updateFields = [
    mailSentCountId && { id: mailSentCountId, value: newMailCount.toString() },
    lastMailDateId && { id: lastMailDateId, value: deliveryDate },
    mailDeliveryDateId && { id: mailDeliveryDateId, value: deliveryDate },
  ].filter(Boolean);

  if (updateFields.length > 0) {
    await ghlUpdateContact(token, contactId, {
      customFields: updateFields,
      tags: ['mail:delivered', `mail:touch${newMailCount}`]
    });
  }

  console.log(`✅ [THANKS.IO] Updated contact ${contactId} - mail ${newMailCount} delivered`);
}

async function handleQRScan(contactId: string, data: any) {
  const scanCount = data['order_item.scans'];

  console.log(`📱 [THANKS.IO] QR scan for ${contactId}: ${scanCount} scans`);

  // Resolve the correct owning tenant for this contact (multi-tenant safe)
  const userId = await resolveOwnerByGhlContactId(contactId);
  if (!userId) {
    console.error(`❌ [THANKS.IO] No owner found for contact ${contactId} — skipping`);
    return;
  }

  const tokenData = await getValidGhlToken(userId);
  if (!tokenData) return;

  const { token } = tokenData;
  const fieldIds: Record<string, string> = tokenData.customFieldIds || {};
  const qrScanCountId = fieldIds.qr_scan_count;

  const updateFields = qrScanCountId
    ? [{ id: qrScanCountId, value: scanCount.toString() }]
    : [];

  await ghlUpdateContact(token, contactId, {
    customFields: updateFields,
    tags: ['mail:scanned', 'high-engagement']
  });

  console.log(`✅ [THANKS.IO] Updated contact ${contactId} - QR scanned ${scanCount} times`);
}
