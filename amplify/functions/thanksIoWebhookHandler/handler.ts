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
    const ghlContactId = data?.['recipient.custom_1'];

    // When a recipient scans a QR code, Thanks.io automatically adds them to the "All QR Scans"
    // (#302538 -> Monthly Market Update Postcard) list. Remove them from the active cold drip
    // lists (#302546 Probate, #309826 Lis Pendens, #337586 Auction) so they don't keep getting cold follow-up
    // letters (like the Day 42 breakup letter) after engaging.
    if (eventType === 'scans.scan_update' && data) {
      await removeRecipientFromColdListsOnScan(data);
    }

    if (!ghlContactId) {
      console.log('⚠️ [THANKS.IO] No GHL contact ID in custom_1 field');
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'No contact ID' })
      };
    }

    // Handle different event types
    if (eventType === 'order_item.status_update' || eventType === 'order_item.delivered') {
      await handleDeliveryUpdate(ghlContactId, data, eventType);
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

async function handleDeliveryUpdate(contactId: string, data: any, eventType?: string) {
  const itemStatus = data['order_item.current_status'];
  const orderStatus = data['order.status'];
  const deliveryDate = data['order_item.delivery_date'] || new Date().toISOString().split('T')[0];

  console.log(
    `📦 [THANKS.IO] Delivery update for ${contactId}: event=${eventType}, order=${orderStatus}, item=${itemStatus}, delivered=${deliveryDate}`,
  );

  // Check item-level status or explicit order_item.delivered event
  // (Thanks.io often sends order.status = "Printing" or "Fulfilled" while order_item.current_status = "Delivered")
  const isDelivered =
    eventType === 'order_item.delivered' ||
    itemStatus === 'Delivered' ||
    orderStatus === 'Delivered';

  if (!isDelivered) {
    console.log(`⏭️ [THANKS.IO] Skipping - mail piece not delivered yet (item=${itemStatus}, order=${orderStatus})`);
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

// Active cold drip mailing lists to remove a recipient from once they scan a QR code
// (Thanks.io's built-in "All QR Scans" list #302538 automatically takes over for Monthly Market Updates)
const COLD_DRIP_MAILING_LIST_IDS = [
  302546, // Probate Mailing List
  309826, // Preforeclosure - Lis Pendens
  337586, // Preforeclosure - Auction
];

async function removeRecipientFromColdListsOnScan(data: any) {
  const apiKey = process.env.THANKS_IO_API;
  const address = data['recipient.address'];
  const postalCode = data['recipient.postal_code'];
  if (!apiKey || !address || !postalCode) return;

  for (const listId of COLD_DRIP_MAILING_LIST_IDS) {
    try {
      const res = await fetch('https://api.thanks.io/api/v2/recipients-utils/delete-by-address', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          mailing_list_id: listId,
          address,
          postal_code: String(postalCode),
          city: data['recipient.city'] || undefined,
          province: data['recipient.province'] || undefined,
          country: data['recipient.country'] || 'US',
        }),
      });
      if (res.ok) {
        console.log(`🔄 [THANKS.IO] Removed scanned recipient (${address}, ${postalCode}) from cold list ${listId}`);
      }
    } catch (err) {
      console.warn(`⚠️ [THANKS.IO] Failed to remove scanned recipient from list ${listId}:`, err);
    }
  }
}
