/**
 * WEBHOOK IDEMPOTENCY MANAGER
 * 
 * Prevents duplicate webhook processing when GHL/Facebook retries failed requests.
 * Uses DynamoDB with TTL to automatically clean up old records after 24 hours.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const IDEMPOTENCY_TABLE = process.env.AMPLIFY_DATA_WebhookIdempotency_TABLE_NAME;

interface IdempotencyMetadata {
  source: string;
  eventType: string;
  contactId?: string;
}

export async function isProcessed(webhookId: string): Promise<boolean> {
  if (!webhookId) return false;

  try {
    const result = await docClient.send(new GetCommand({
      TableName: IDEMPOTENCY_TABLE,
      Key: { webhookId }
    }));

    if (result.Item) {
      console.log(`⏭️ [IDEMPOTENCY] Webhook ${webhookId} already processed`);
      return true;
    }
    return false;
  } catch (error: any) {
    console.error(`❌ [IDEMPOTENCY] Check failed:`, error.message);
    return false; // Fail open - allow processing if check fails
  }
}

export async function markProcessed(webhookId: string, metadata: IdempotencyMetadata): Promise<void> {
  if (!webhookId) return;

  try {
    const now = new Date();
    const ttl = Math.floor(now.getTime() / 1000) + (24 * 60 * 60); // 24 hours

    await docClient.send(new PutCommand({
      TableName: IDEMPOTENCY_TABLE,
      Item: {
        webhookId,
        processedAt: now.toISOString(),
        source: metadata.source,
        eventType: metadata.eventType,
        contactId: metadata.contactId,
        ttl,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }
    }));

    console.log(`✅ [IDEMPOTENCY] Marked ${webhookId} as processed`);
  } catch (error: any) {
    console.error(`❌ [IDEMPOTENCY] Mark failed:`, error.message);
  }
}

export function extractWebhookId(event: any): string {
  // 1. GHL webhook ID header
  if (event.headers?.['x-ghl-webhook-id']) {
    return event.headers['x-ghl-webhook-id'];
  }

  // 2. Custom webhook ID from body
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  if (body?.webhookId) {
    return body.webhookId;
  }

  // 3. Generate from request context
  if (event.requestContext?.requestId) {
    const contactId = body?.contactId || body?.customData?.contactId || 'unknown';
    const timestamp = body?.timestamp || Date.now();
    return `${event.requestContext.requestId}_${contactId}_${timestamp}`;
  }

  // 4. Fallback to body hash
  const bodyStr = JSON.stringify(body);
  let hash = 0;
  for (let i = 0; i < bodyStr.length; i++) {
    hash = ((hash << 5) - hash) + bodyStr.charCodeAt(i);
    hash = hash & hash;
  }
  return `hash_${Math.abs(hash).toString(36)}`;
}
