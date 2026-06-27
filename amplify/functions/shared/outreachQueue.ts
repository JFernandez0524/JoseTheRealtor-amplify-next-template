/**
 * OUTREACH QUEUE MANAGER
 * 
 * Manages the OutreachQueue table for efficient contact outreach tracking.
 * This replaces expensive GHL searches with fast DynamoDB queries.
 * 
 * ARCHITECTURE:
 * - Contacts added to queue when synced to GHL with "ai outreach" tag
 * - Hourly agents query queue for PENDING contacts (fast, cheap)
 * - After sending, status updated to SENT
 * - Webhooks update status to REPLIED/OPTED_OUT/BOUNCED
 * 
 * BENEFITS:
 * - 90% reduction in GHL API calls
 * - Sub-second queries vs 2-3 second GHL searches
 * - Better tracking and analytics
 * - Costs pennies instead of dollars
 * 
 * RELATED FILES:
 * - amplify/data/resource.ts - OutreachQueue schema
 * - amplify/functions/dailyEmailAgent/handler.ts - Email agent (uses queue)
 * - app/api/v1/ghl-webhook/route.ts - Updates queue on SMS replies
 * - app/api/v1/ghl-email-webhook/route.ts - Updates queue on email replies
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const OUTREACH_QUEUE_TABLE = process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME;

interface OutreachQueueItem {
  id?: string;
  userId: string;
  locationId: string;
  contactId: string;
  leadId?: string; // Links all contacts for the same PropertyLead
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  queueStatus?: 'OUTREACH' | 'CONVERSATION' | 'DND' | 'WRONG_INFO' | 'COMPLETED';
  emailStatus?: 'PENDING' | 'SENT' | 'REPLIED' | 'BOUNCED' | 'FAILED' | 'OPTED_OUT';
  emailAttempts?: number;
  lastEmailSent?: string;
  nextEmailDate?: string; // Scheduled date for next email
  lastContactDate?: string;
  lastLeadReplyDate?: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  leadType?: string;
}

/**
 * Add or update a contact in the outreach queue
 * Called when contact is synced to GHL with "ai outreach" tag
 * 
 * @param item - Contact information for outreach
 * @returns Queue item ID
 */
export async function addToOutreachQueue(item: OutreachQueueItem): Promise<string> {
  // Create unique ID per contact+email combination (supports multiple emails per contact)
  const emailSuffix = item.contactEmail ? `_${item.contactEmail.replace(/[^a-zA-Z0-9]/g, '')}` : '';
  const id = item.id || `${item.userId}_${item.contactId}${emailSuffix}`;
  
  // Check if this specific contact+email already exists in queue
  try {
    const existing = await docClient.send(new GetCommand({
      TableName: OUTREACH_QUEUE_TABLE,
      Key: { id }
    }));

    if (existing.Item) {
      console.log(`⚠️ Contact ${item.contactId} (${item.contactEmail}) already in queue - skipping to preserve progress`);
      return id;
    }
  } catch (error) {
    console.error(`Error checking for existing queue item:`, error);
    // Continue to add if check fails
  }
  
  const queueItem = {
    id,
    userId: item.userId,
    locationId: item.locationId,
    contactId: item.contactId,
    leadId: item.leadId, // Link to PropertyLead
    contactName: item.contactName,
    contactPhone: item.contactPhone,
    contactEmail: item.contactEmail,
    queueStatus: 'OUTREACH' as const,
    emailStatus: item.contactEmail ? 'PENDING' : undefined,
    emailAttempts: 0,
    nextEmailDate: item.contactEmail ? new Date().toISOString() : undefined, // Send first email immediately
    propertyAddress: item.propertyAddress,
    propertyCity: item.propertyCity,
    propertyState: item.propertyState,
    leadType: item.leadType,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: OUTREACH_QUEUE_TABLE,
    Item: queueItem,
  }));

  console.log(`✅ Added contact ${item.contactId} to outreach queue`);
  return id;
}

/**
 * Get pending email contacts for a user
 * Used by email agent to find contacts needing outreach
 * 
 * Returns contacts whose nextEmailDate is today or earlier
 * 
 * @param userId - User ID to query
 * @param limit - Max contacts to return
 * @returns Array of pending contacts ready for next touch
 */
export async function getPendingEmailContacts(userId: string, limit: number = 50): Promise<OutreachQueueItem[]> {
  // Paginate through ALL pending email contacts (not just first 1000)
  let items: OutreachQueueItem[] = [];
  let lastEvaluatedKey: any = undefined;
  
  do {
    const params: any = {
      TableName: OUTREACH_QUEUE_TABLE,
      IndexName: 'outreachQueuesByUserIdAndEmailStatus',
      KeyConditionExpression: 'userId = :userId AND emailStatus = :status',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':status': 'PENDING',
      },
      Limit: 1000,
    };
    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }
    const result = await docClient.send(new QueryCommand(params));
    items.push(...(result.Items || []) as OutreachQueueItem[]);
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  // Filter by nextEmailDate and queue status
  return items.filter(item => {
    // Must have email address
    if (!item.contactEmail) {
      console.log(`⚠️ Contact ${item.contactId} has no email - skipping`);
      return false;
    }

    // Only send to contacts in OUTREACH status
    const status = item.queueStatus || 'OUTREACH';
    if (status !== 'OUTREACH') {
      console.log(`⏹️ Contact ${item.contactId} not in OUTREACH status (${status})`);
      return false;
    }

    // Must have nextEmailDate set
    if (!item.nextEmailDate) {
      console.log(`⚠️ Contact ${item.contactId} missing nextEmailDate`);
      return false;
    }

    // Check if nextEmailDate is today or earlier
    const nextDate = new Date(item.nextEmailDate);
    nextDate.setHours(0, 0, 0, 0);

    if (nextDate > today) {
      console.log(`⏳ Contact ${item.contactId} not ready - scheduled for ${nextDate.toDateString()}`);
      return false;
    }

    // Safety: enforce minimum 24 hours since last email (mirrors SMS guard; protects against
    // race conditions if two Lambda invocations overlap on the same contact)
    if (item.lastEmailSent) {
      const lastSent = new Date(item.lastEmailSent);
      const hoursSince = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        console.log(`⏳ Contact ${item.contactId} emailed ${hoursSince.toFixed(1)}h ago - too soon`);
        return false;
      }
    }

    return true;
  }).slice(0, limit);
}

/**
 * Update email status after sending
 * Keeps status as PENDING for follow-ups (up to 7 touches)
 * 
 * @param id - Queue item ID
 * @param status - New status
 * @param attempts - Current attempt count
 */
export async function updateEmailStatus(
  id: string,
  status: 'SENT' | 'REPLIED' | 'BOUNCED' | 'FAILED' | 'OPTED_OUT',
  attempts?: number
): Promise<void> {
  // Keep as PENDING if under 7 attempts and not replied/bounced/opted out
  const finalStatus = (status === 'SENT' && attempts && attempts < 7) ? 'PENDING' : status;
  
  const updateExpression = attempts !== undefined
    ? 'SET emailStatus = :status, emailAttempts = :attempts, lastEmailSent = :now, updatedAt = :now'
    : 'SET emailStatus = :status, updatedAt = :now';

  const expressionValues: any = {
    ':status': finalStatus,
    ':now': new Date().toISOString(),
  };

  if (attempts !== undefined) {
    expressionValues[':attempts'] = attempts;
  }

  await docClient.send(new UpdateCommand({
    TableName: OUTREACH_QUEUE_TABLE,
    Key: { id },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionValues,
  }));

  console.log(`✅ Updated email status to ${finalStatus} for queue item ${id} (attempt ${attempts || 0})`);
}

/**
 * Pre-lock a contact before sending email to prevent double-sends.
 * Sets nextEmailDate = +4 days before the email goes out, so if the post-send
 * updateEmailSent call fails (DynamoDB error, Lambda timeout, etc.), the contact
 * is still protected from being picked up again on the next hourly run.
 *
 * @param id - Queue item ID
 */
export async function preLockEmailSend(id: string): Promise<void> {
  const lockDate = new Date();
  lockDate.setDate(lockDate.getDate() + 4);
  lockDate.setHours(0, 0, 0, 0);

  await docClient.send(new UpdateCommand({
    TableName: OUTREACH_QUEUE_TABLE,
    Key: { id },
    UpdateExpression: 'SET nextEmailDate = :lockDate, updatedAt = :now',
    ExpressionAttributeValues: {
      ':lockDate': lockDate.toISOString(),
      ':now': new Date().toISOString(),
    },
  }));

  console.log(`🔒 Pre-locked email send for ${id} until ${lockDate.toDateString()}`);
}

/**
 * Release an email pre-lock after a transient send failure.
 * Resets nextEmailDate to tomorrow so the contact is retried on the next business day.
 *
 * @param id - Queue item ID
 */
export async function releaseEmailLock(id: string): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  await docClient.send(new UpdateCommand({
    TableName: OUTREACH_QUEUE_TABLE,
    Key: { id },
    UpdateExpression: 'SET nextEmailDate = :tomorrow, updatedAt = :now',
    ExpressionAttributeValues: {
      ':tomorrow': tomorrow.toISOString(),
      ':now': new Date().toISOString(),
    },
  }));

  console.log(`🔓 Released email lock for ${id} - retry from ${tomorrow.toDateString()}`);
}

/**
 * Update email sent - increments counter, updates timestamp, and schedules next email
 * Keeps status as PENDING for follow-up touches
 *
 * @param id - Queue item ID (userId_contactId)
 */
export async function updateEmailSent(id: string): Promise<void> {
  // Get current attempts
  const result = await docClient.send(new GetCommand({
    TableName: OUTREACH_QUEUE_TABLE,
    Key: { id }
  }));

  const currentAttempts = (result.Item?.emailAttempts as number) || 0;
  const newAttempts = currentAttempts + 1;

  // Cap at 7 touches — mark COMPLETED after final touch
  const MAX_EMAIL_TOUCHES = 7;
  const finalStatus = newAttempts >= MAX_EMAIL_TOUCHES ? 'COMPLETED' : 'PENDING';

  // Calculate next email date (4 days from now) — only relevant if still PENDING
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + 4);
  nextDate.setHours(0, 0, 0, 0);

  await docClient.send(new UpdateCommand({
    TableName: OUTREACH_QUEUE_TABLE,
    Key: { id },
    UpdateExpression: 'SET emailStatus = :status, emailAttempts = :attempts, lastEmailSent = :timestamp, nextEmailDate = :nextDate, updatedAt = :now',
    ExpressionAttributeValues: {
      ':status': finalStatus,
      ':attempts': newAttempts,
      ':timestamp': new Date().toISOString(),
      ':nextDate': nextDate.toISOString(),
      ':now': new Date().toISOString(),
    },
  }));

  console.log(`✅ Updated email for queue item ${id} - attempt ${newAttempts}/${MAX_EMAIL_TOUCHES}, status: ${finalStatus}, next: ${nextDate.toDateString()}`);
}

/**
 * Get queue item by contact ID
 * Used by webhooks to update status on replies
 * 
 * @param userId - User ID
 * @param contactId - GHL contact ID
 * @returns Queue item or null
 */
export async function getQueueItemByContact(userId: string, contactId: string): Promise<OutreachQueueItem | null> {
  const id = `${userId}_${contactId}`;
  
  const result = await docClient.send(new GetCommand({
    TableName: OUTREACH_QUEUE_TABLE,
    Key: { id },
  }));

  return result.Item as OutreachQueueItem || null;
}

/**
 * Find queue item by contactId only (scan operation)
 * Used when userId is unknown (e.g., GHL disposition webhooks)
 * 
 * @param contactId - GHL contact ID
 * @returns Queue item or null
 */
export async function findQueueItemByContactId(contactId: string): Promise<OutreachQueueItem | null> {
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  
  const result = await docClient.send(new ScanCommand({
    TableName: OUTREACH_QUEUE_TABLE,
    FilterExpression: 'contactId = :contactId',
    ExpressionAttributeValues: {
      ':contactId': contactId,
    },
    Limit: 1,
  }));

  return result.Items?.[0] as OutreachQueueItem || null;
}

/**
 * Update queue lifecycle status
 * Moves contact between OUTREACH, CONVERSATION, DND, WRONG_INFO, COMPLETED
 * 
 * @param id - Queue item ID
 * @param status - New queue status
 * @param reason - Optional reason for status change
 */
export async function updateQueueStatus(
  id: string,
  status: 'OUTREACH' | 'CONVERSATION' | 'DND' | 'WRONG_INFO' | 'COMPLETED' | 'MANUAL_HANDLING',
  reason?: string
): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: OUTREACH_QUEUE_TABLE,
    Key: { id },
    UpdateExpression: 'SET queueStatus = :status, updatedAt = :now',
    ExpressionAttributeValues: {
      ':status': status,
      ':now': new Date().toISOString(),
    },
  }));

  console.log(`✅ Updated queue status to ${status} for ${id}${reason ? ` (${reason})` : ''}`);
}

/**
 * Log outbound contact (we sent a message)
 * Updates lastContactDate to prevent same-day duplicates
 * 
 * @param id - Queue item ID
 */
export async function logOutboundContact(id: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: OUTREACH_QUEUE_TABLE,
    Key: { id },
    UpdateExpression: 'SET lastContactDate = :now, updatedAt = :now',
    ExpressionAttributeValues: {
      ':now': new Date().toISOString(),
    },
  }));

  console.log(`✅ Logged outbound contact for ${id}`);
}

/**
 * Log inbound reply (they sent a message)
 * Updates lastLeadReplyDate and moves to CONVERSATION status
 * 
 * @param id - Queue item ID
 */
export async function logInboundReply(id: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: OUTREACH_QUEUE_TABLE,
    Key: { id },
    UpdateExpression: 'SET lastLeadReplyDate = :now, queueStatus = :status, updatedAt = :now',
    ExpressionAttributeValues: {
      ':now': new Date().toISOString(),
      ':status': 'CONVERSATION',
    },
  }));

  console.log(`✅ Logged inbound reply for ${id} - moved to CONVERSATION`);
}
