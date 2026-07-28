/**
 * Conversation Activity Checker
 *
 * Detects recent manual (human) activity in GHL conversations to prevent AI from
 * interrupting active conversations.
 */

import { ghlGetContact, ghlUpdateContact, createGhlClient } from './ghlClient';
import { extractGhlMessages, isHumanOutbound } from './ghlMessages';

/**
 * Resolve a contact's conversation id.
 *
 * Webhook payloads don't always carry one — workflow webhooks in particular carry none at all —
 * so callers that need conversation-level data have to look it up.
 */
export async function findConversationId(
  contactId: string,
  token: string
): Promise<string | null> {
  try {
    const ghl = createGhlClient(token);
    const res = await ghl.get('/conversations/search', { params: { contactId, limit: 1 } });
    return res.data?.conversations?.[0]?.id || null;
  } catch (error: any) {
    console.error(`❌ [ACTIVITY] Failed to find conversation for ${contactId}:`, error.message);
    return null;
  }
}

export interface ActivityResult {
  hasRecentOutbound: boolean;
  lastActivityTime: string | null;
  lastOutboundTime: string | null;
  messageCount: number;
}

/**
 * Was the most recent outbound message in this conversation sent by a human?
 *
 * This is the takeover test for **texts**. It asks an ordering question rather than a time-window
 * one: if the last thing sent to this lead came from the agent, the AI must not speak next,
 * however long ago it was. A fixed window (the previous approach) silently fails whenever a lead
 * replies the following morning.
 *
 * Only the newest outbound is considered — once the AI has legitimately replied after the agent,
 * the conversation is back in its hands.
 */
export async function wasLastOutboundHuman(
  conversationId: string,
  token: string
): Promise<{ isHuman: boolean; lastOutboundTime: string | null }> {
  try {
    const ghl = createGhlClient(token);
    const res = await ghl.get(`/conversations/${conversationId}/messages`, { params: { limit: 20 } });
    const messages = extractGhlMessages(res.data);

    // GHL returns newest-first, so the first outbound encountered is the most recent one.
    const lastOutbound = messages.find((m) => m.direction === 'outbound');
    if (!lastOutbound) {
      return { isHuman: false, lastOutboundTime: null };
    }

    const isHuman = isHumanOutbound(lastOutbound);
    console.log(
      `🔍 [ACTIVITY] Last outbound at ${lastOutbound.dateAdded} was ${isHuman ? 'human' : 'automated'}`
    );
    return { isHuman, lastOutboundTime: lastOutbound.dateAdded ?? null };
  } catch (error: any) {
    // Fail open: a lookup failure must not silence the agent everywhere.
    console.error('❌ [ACTIVITY] Failed to check last outbound sender:', error.message);
    return { isHuman: false, lastOutboundTime: null };
  }
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
    const messages = extractGhlMessages(messagesRes.data);

    console.log(`📊 [ACTIVITY] Found ${messages.length} messages`);

    // Calculate time threshold
    const thresholdTime = Date.now() - (windowMinutes * 60 * 1000);
    
    let lastActivityTime: string | null = null;
    let lastOutboundTime: string | null = null;
    let hasRecentOutbound = false;

    // Check messages for recent *human* outbound activity.
    // Only human-sent messages count: this app's own AI replies and GHL workflow sends are also
    // outbound, and counting them would make the agent read its own message from seconds earlier as
    // a manual takeover and pause itself on every conversation. See isHumanOutbound.
    for (const msg of messages) {
      if (!msg.dateAdded) continue;
      const messageTime = new Date(msg.dateAdded).getTime();

      // Track last activity (any direction, any sender)
      if (!lastActivityTime || messageTime > new Date(lastActivityTime).getTime()) {
        lastActivityTime = msg.dateAdded;
      }

      if (isHumanOutbound(msg) && messageTime > thresholdTime) {
        hasRecentOutbound = true;

        if (!lastOutboundTime || messageTime > new Date(lastOutboundTime).getTime()) {
          lastOutboundTime = msg.dateAdded;
        }

        console.log(`📤 [ACTIVITY] Found recent human outbound message at ${msg.dateAdded}`);
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
