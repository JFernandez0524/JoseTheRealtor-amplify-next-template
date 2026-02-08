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
 * - amplify/functions/dailyOutreachAgent/handler.ts - SMS agent (uses queue)
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
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  queueStatus?: 'OUTREACH' | 'CONVERSATION' | 'DND' | 'WRONG_INFO' | 'COMPLETED';
  smsStatus?: 'PENDING' | 'SENT' | 'REPLIED' | 'FAILED' | 'OPTED_OUT';
  emailStatus?: 'PENDING' | 'SENT' | 'REPLIED' | 'BOUNCED' | 'FAILED' | 'OPTED_OUT';
  smsAttempts?: number;
  emailAttempts?: number;
  lastSmsSent?: string;
  lastEmailSent?: string;
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
  const id = item.id || `${item.userId}_${item.contactId}`;
  
  // Check if contact already exists in queue
  try {
    const existing = await docClient.send(new GetCommand({
      TableName: OUTREACH_QUEUE_TABLE,
      Key: { id }
    }));

    if (existing.Item) {
      console.log(`⚠️ Contact ${item.contactId} already in queue - skipping to preserve progress`);
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
    contactName: item.contactName,
    contactPhone: item.contactPhone,
    contactEmail: item.contactEmail,
    queueStatus: 'OUTREACH' as const,
    smsStatus: item.contactPhone ? 'PENDING' : undefined,
    emailStatus: item.contactEmail ? 'PENDING' : undefined,
    smsAttempts: 0,
    emailAttempts: 0,
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
 * Get pending SMS contacts for a user
 * Used by SMS agent to find contacts needing outreach
 * 
 * Enforces 7-touch limit and 4-day cadence between touches
 * 
 * @param userId - User ID to query
 * @param limit - Max contacts to return
 * @returns Array of pending contacts ready for next touch
 */
export async function getPendingSmsContacts(userId: string, limit: number = 50): Promise<OutreachQueueItem[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: OUTREACH_QUEUE_TABLE,
    IndexName: 'outreachQueuesByUserIdAndSmsStatus',
    KeyConditionExpression: 'userId = :userId AND smsStatus = :status',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':status': 'PENDING',
    },
    Limit: limit * 2, // Get extra to filter by cadence and queue status
  }));

  const now = new Date();
  const items = (result.Items || []) as OutreachQueueItem[];
  
  // Filter by queue status, 7-touch limit, and 4-day cadence
  return items.filter(item => {
    // Only send to contacts in OUTREACH status
    const status = item.queueStatus || 'OUTREACH'; if (status !== 'OUTREACH') {
      console.log(`⏹️ Contact ${item.contactId} not in OUTREACH status (${status})`);
      return false;
    }
    
    // Check if we already contacted them today (any channel)
    if (item.lastContactDate) {
      const lastContact = new Date(item.lastContactDate);
      const today = new Date().toDateString();
      const lastContactDay = lastContact.toDateString();
      
      if (today === lastContactDay) {
        console.log(`⏹️ Contact ${item.contactId} already contacted today`);
        return false;
      }
    }
    
    const attempts = item.smsAttempts || 0;
    
    // Max 7 touches per phone
    if (attempts >= 7) {
      console.log(`⏹️ Contact ${item.contactId} reached max SMS attempts (7)`);
      return false;
    }
    
    // First touch - send immediately
    if (attempts === 0) return true;
    
    // Subsequent touches - wait 4 days (AND at least 24 hours to prevent same-day duplicates)
    if (item.lastSmsSent) {
      const lastSent = new Date(item.lastSmsSent);
      const hoursSince = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
      const daysSince = hoursSince / 24;
      
      // Prevent duplicate sends within same day (24 hours minimum)
      if (hoursSince < 24) {
        console.log(`⏳ Contact ${item.contactId} sent recently - only ${hoursSince.toFixed(1)} hours ago`);
        return false;
      }
      
      if (daysSince < 4) {
        console.log(`⏳ Contact ${item.contactId} not ready - only ${daysSince.toFixed(1)} days since last SMS`);
        return false;
      }
    }
    
    return true;
  }).slice(0, limit);
}

/**
 * Get pending email contacts for a user
 * Used by email agent to find contacts needing outreach
 * 
 * Enforces 7-touch limit and 4-day cadence between touches
 * 
 * @param userId - User ID to query
 * @param limit - Max contacts to return
 * @returns Array of pending contacts ready for next touch
 */
export async function getPendingEmailContacts(userId: string, limit: number = 50): Promise<OutreachQueueItem[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: OUTREACH_QUEUE_TABLE,
    IndexName: 'outreachQueuesByUserIdAndEmailStatus',
    KeyConditionExpression: 'userId = :userId AND emailStatus = :status',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':status': 'PENDING',
    },
    Limit: limit * 2, // Get extra to filter by cadence and queue status
  }));

  const now = new Date();
  const items = (result.Items || []) as OutreachQueueItem[];
  
  // Filter by queue status, 7-touch limit, and 4-day cadence
  return items.filter(item => {
    // Only send to contacts in OUTREACH status
    const status = item.queueStatus || 'OUTREACH'; if (status !== 'OUTREACH') {
      console.log(`⏹️ Contact ${item.contactId} not in OUTREACH status (${status})`);
      return false;
    }
    
    // Check if we already contacted them today (any channel)
    if (item.lastContactDate) {
      const lastContact = new Date(item.lastContactDate);
      const today = new Date().toDateString();
      const lastContactDay = lastContact.toDateString();
      
      if (today === lastContactDay) {
        console.log(`⏹️ Contact ${item.contactId} already contacted today`);
        return false;
      }
    }
    
    const attempts = item.emailAttempts || 0;
    
    // Max 7 touches per email
    if (attempts >= 7) {
      console.log(`⏹️ Contact ${item.contactId} reached max email attempts (7)`);
      return false;
    }
    
    // First touch - send immediately
    if (attempts === 0) return true;
    
    // Subsequent touches - wait 4 days (AND at least 24 hours to prevent same-day duplicates)
    if (item.lastEmailSent) {
      const lastSent = new Date(item.lastEmailSent);
      const hoursSince = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
      const daysSince = hoursSince / 24;
      
      // Prevent duplicate sends within same day (24 hours minimum)
      if (hoursSince < 24) {
        console.log(`⏳ Contact ${item.contactId} emailed recently - only ${hoursSince.toFixed(1)} hours ago`);
        return false;
      }
      
      if (daysSince < 4) {
        console.log(`⏳ Contact ${item.contactId} not ready - only ${daysSince.toFixed(1)} days since last email`);
        return false;
      }
    }
    
    return true;
  }).slice(0, limit);
}

/**
 * Update SMS status after sending
 * Keeps status as PENDING for follow-ups (up to 7 touches)
 * 
 * @param id - Queue item ID
 * @param status - New status
 * @param attempts - Current attempt count
 */
export async function updateSmsStatus(
  id: string,
  status: 'SENT' | 'REPLIED' | 'FAILED' | 'OPTED_OUT',
  attempts?: number
): Promise<void> {
  // Keep as PENDING if under 7 attempts and not replied/opted out
  const finalStatus = (status === 'SENT' && attempts && attempts < 7) ? 'PENDING' : status;
  
  const updateExpression = attempts !== undefined
    ? 'SET smsStatus = :status, smsAttempts = :attempts, lastSmsSent = :now, updatedAt = :now'
    : 'SET smsStatus = :status, updatedAt = :now';

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

  console.log(`✅ Updated SMS status to ${finalStatus} for queue item ${id} (attempt ${attempts || 0})`);
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
  status: 'OUTREACH' | 'CONVERSATION' | 'DND' | 'WRONG_INFO' | 'COMPLETED',
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
