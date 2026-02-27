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
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

// Custom field IDs in GHL
const CUSTOM_FIELD_IDS = {
  MAIL_SENT_COUNT: 'DTEW0PLqxp35WHOiDLWR',
  LAST_MAIL_DATE: '4fRJXKv1A22BdMLrJfxO',
  MAIL_DELIVERY_DATE: 'bQqrO0OicE1N7EShmoQZ',
  QR_SCAN_COUNT: '981A5iFqndhODq2naOu4',
};

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

  // Get user ID from contact (need to look up in GHL or OutreachQueue)
  const userId = await getUserIdFromContact(contactId);
  if (!userId) return;

  // Get GHL token
  const tokenData = await getValidGhlToken(userId);
  if (!tokenData) return;

  const { token } = tokenData;

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

  console.log(`✅ [THANKS.IO] Updated contact ${contactId} - mail ${newMailCount} delivered`);
}

async function handleQRScan(contactId: string, data: any) {
  const scanCount = data['order_item.scans'];

  console.log(`📱 [THANKS.IO] QR scan for ${contactId}: ${scanCount} scans`);

  // Get user ID from contact
  const userId = await getUserIdFromContact(contactId);
  if (!userId) return;

  // Get GHL token
  const tokenData = await getValidGhlToken(userId);
  if (!tokenData) return;

  const { token } = tokenData;

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

async function getUserIdFromContact(contactId: string): Promise<string | null> {
  try {
    const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    
    // Get any GHL integration to fetch contact details
    const integrationResult = await docClient.send(new ScanCommand({
      TableName: process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME!,
      Limit: 1
    }));

    if (!integrationResult.Items?.length) {
      console.error(`❌ [THANKS.IO] No GHL integrations found`);
      return null;
    }

    const tokenData = await getValidGhlToken(integrationResult.Items[0].userId);
    if (!tokenData) return null;

    // Get contact's locationId from GHL
    const contactResponse = await axios.get(
      `${GHL_API_BASE}/contacts/${contactId}`,
      { headers: { Authorization: `Bearer ${tokenData.token}`, Version: '2021-07-28' } }
    );

    const locationId = contactResponse.data.contact.locationId;
    
    // Find userId for this locationId
    const userResult = await docClient.send(new ScanCommand({
      TableName: process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME!,
      FilterExpression: 'locationId = :locationId',
      ExpressionAttributeValues: { ':locationId': locationId },
      Limit: 1
    }));

    if (userResult.Items?.length) {
      return userResult.Items[0].userId;
    }

    console.error(`❌ [THANKS.IO] No userId found for locationId ${locationId}`);
    return null;
  } catch (error: any) {
    console.error('❌ [THANKS.IO] Error getting userId:', error.message);
    return null;
  }
}
