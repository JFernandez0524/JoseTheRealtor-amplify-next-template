/**
 * Conversation Activity Checker
 *
 * Detects recent manual (human) activity in GHL conversations to prevent AI from
 * interrupting active conversations.
 */

import { ghlGetContact, ghlUpdateContact, createGhlClient } from './ghlClient';

export interface ActivityResult {
  hasRecentOutbound: boolean;
  lastActivityTime: string | null;
  lastOutboundTime: string | null;
  messageCount: number;
}

/**
 * Check for recent outbound activity in a conversation
 * 
 * @param conversationId - GHL conversation ID
 * @param token - GHL OAuth token
 * @param windowMinutes - Time window to check (default: 30 minutes)
 * @returns Activity result with timestamps
 */
export async function checkRecentActivity(
  conversationId: string,
  token: string,
  windowMinutes: number = 30
): Promise<ActivityResult> {
  try {
    console.log(`🔍 [ACTIVITY] Checking last ${windowMinutes} minutes of conversation ${conversationId}`);
    
    // Fetch recent messages
    const ghl = createGhlClient(token);
    const messagesRes = await ghl.get(`/conversations/${conversationId}/messages`, { params: { limit: 20 } });
    const messages = messagesRes.data?.messages || [];
    
    console.log(`📊 [ACTIVITY] Found ${messages.length} messages`);

    // Calculate time threshold
    const thresholdTime = Date.now() - (windowMinutes * 60 * 1000);
    
    let lastActivityTime: string | null = null;
    let lastOutboundTime: string | null = null;
    let hasRecentOutbound = false;

    // Check messages for recent outbound activity
    for (const msg of messages) {
      const messageTime = new Date(msg.dateAdded).getTime();
      const isOutbound = msg.direction === 'outbound';
      
      // Track last activity (any direction)
      if (!lastActivityTime || messageTime > new Date(lastActivityTime).getTime()) {
        lastActivityTime = msg.dateAdded;
      }
      
      // Check for recent outbound messages
      if (isOutbound && messageTime > thresholdTime) {
        hasRecentOutbound = true;
        
        if (!lastOutboundTime || messageTime > new Date(lastOutboundTime).getTime()) {
          lastOutboundTime = msg.dateAdded;
        }
        
        console.log(`📤 [ACTIVITY] Found recent outbound message at ${msg.dateAdded}`);
      }
    }

    const result = {
      hasRecentOutbound,
      lastActivityTime,
      lastOutboundTime,
      messageCount: messages.length
    };

    console.log(`✅ [ACTIVITY] Result:`, result);
    return result;

  } catch (error: any) {
    console.error('❌ [ACTIVITY] Error checking activity:', error.message);
    return {
      hasRecentOutbound: false,
      lastActivityTime: null,
      lastOutboundTime: null,
      messageCount: 0
    };
  }
}

/**
 * Activate manual mode for a contact
 * 
 * @param contactId - GHL contact ID
 * @param token - GHL OAuth token
 * @param reason - Optional reason for activation
 */
export async function activateManualMode(
  contactId: string,
  token: string,
  reason?: string,
  fieldIds: Record<string, string> = {}
): Promise<boolean> {
  try {
    console.log(`🤚 [MANUAL_MODE] Activating for contact ${contactId}`);
    
    // Fetch current contact to get existing tags
    const contact = await ghlGetContact(token, contactId);
    if (!contact) {
      console.error('❌ [MANUAL_MODE] Failed to fetch contact');
      return false;
    }

    const currentTags = contact?.tags || [];

    // Add conversation:manual tag if not already present
    if (!currentTags.includes('conversation:manual')) {
      await ghlUpdateContact(token, contactId, { tags: [...currentTags, 'conversation:manual'] });
      console.log('✅ [MANUAL_MODE] Added conversation:manual tag');
    }

    // Add note with timestamp
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'short',
      timeStyle: 'short'
    });

    const noteBody = reason
      ? `🤖 AI paused - ${reason} (${timestamp})`
      : `🤖 AI paused - manual conversation detected at ${timestamp}`;

    const ghl = createGhlClient(token);
    await ghl.post(`/contacts/${contactId}/notes`, { body: noteBody });

    console.log('✅ [MANUAL_MODE] Added note to contact');

    // Update OutreachQueue status if userId available
    const appUserIdFieldId = fieldIds.app_user_id;
    const userId = appUserIdFieldId
      ? contact?.customFields?.find((f: any) => f.id === appUserIdFieldId)?.value
      : undefined;
    
    if (userId) {
      const { updateQueueStatus } = await import('./outreachQueue');
      const queueId = `${userId}_${contactId}`;
      await updateQueueStatus(queueId, 'MANUAL_HANDLING', 'Manual conversation detected');
      console.log('✅ [MANUAL_MODE] Updated queue status to MANUAL_HANDLING');
    }

    return true;

  } catch (error: any) {
    console.error('❌ [MANUAL_MODE] Error activating:', error.message);
    return false;
  }
}
