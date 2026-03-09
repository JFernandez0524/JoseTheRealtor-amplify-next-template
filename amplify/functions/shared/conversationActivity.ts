/**
 * Conversation Activity Checker
 * 
 * Detects recent manual (human) activity in GHL conversations to prevent AI from
 * interrupting active conversations.
 */

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
    const response = await fetch(
      `https://services.leadconnectorhq.com/conversations/${conversationId}/messages?limit=20`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Version': '2021-07-28'
        }
      }
    );

    if (!response.ok) {
      console.error('❌ [ACTIVITY] Failed to fetch messages:', response.status);
      return {
        hasRecentOutbound: false,
        lastActivityTime: null,
        lastOutboundTime: null,
        messageCount: 0
      };
    }

    const data = await response.json();
    const messages = data.messages || [];
    
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
  reason?: string
): Promise<boolean> {
  try {
    console.log(`🤚 [MANUAL_MODE] Activating for contact ${contactId}`);
    
    // Fetch current contact to get existing tags
    const contactResponse = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Version': '2021-07-28'
        }
      }
    );

    if (!contactResponse.ok) {
      console.error('❌ [MANUAL_MODE] Failed to fetch contact');
      return false;
    }

    const contactData = await contactResponse.json();
    const contact = contactData.contact;
    const currentTags = contact?.tags || [];

    // Add conversation:manual tag if not already present
    if (!currentTags.includes('conversation:manual')) {
      const newTags = [...currentTags, 'conversation:manual'];
      
      await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tags: newTags })
      });
      
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

    await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ body: noteBody })
    });

    console.log('✅ [MANUAL_MODE] Added note to contact');

    // Update OutreachQueue status if userId available
    const userId = contact?.customFields?.find((f: any) => f.id === 'CNoGugInWOC59hAPptxY')?.value;
    
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
