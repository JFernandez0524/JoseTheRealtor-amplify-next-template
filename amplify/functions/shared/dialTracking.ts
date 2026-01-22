import axios from 'axios';

/**
 * GHL DIAL TRACKING & CADENCE UTILITIES
 * 
 * Manages the 8-message follow-up cadence:
 * 1. Initial outreach
 * 2. Wait 5 business days if no response
 * 3. Send follow-up (repeat up to 8 total messages)
 * 4. After 8 attempts, mark disposition as "Direct Mail Campaign"
 * 
 * FIELD IDS:
 * - call_attempt_counter: 0MD4Pp2LCyOSCbCjA5qF (Contact)
 * - last_call_date: dWNGeSckpRoVUxXLgxMj (Contact)
 * - disposition: 5PTlyH0ahrPVzYTKicYn (Opportunity)
 */

const MAX_OUTREACH_ATTEMPTS = 8;
const BUSINESS_DAYS_BETWEEN_MESSAGES = 5;

/**
 * Calculate business days between two dates (excludes weekends)
 */
function getBusinessDaysDiff(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Check if contact is ready for next outreach message
 * 
 * DIAL TRACKING DISABLED - Always returns true for immediate sending
 */
export function shouldSendNextMessage(contact: any): boolean {
  const callAttempts = parseInt(contact.customFields?.find((f: any) => f.id === '0MD4Pp2LCyOSCbCjA5qF')?.value || '0');
  
  // Max attempts reached
  if (callAttempts >= MAX_OUTREACH_ATTEMPTS) {
    console.log(`⏹️ Contact ${contact.id} reached max attempts (${callAttempts})`);
    return false;
  }
  
  // DIAL TRACKING DISABLED - Send immediately
  return true;
}

/**
 * Increment dial counter and update last call date
 */
export async function incrementDialCounter(contactId: string, ghlToken: string): Promise<void> {
  try {
    // Get current counter value
    const contactResponse = await axios.get(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${ghlToken}`,
          'Version': '2021-07-28'
        }
      }
    );
    
    const contact = contactResponse.data.contact;
    const currentCount = parseInt(contact.customFields?.find((f: any) => f.id === '0MD4Pp2LCyOSCbCjA5qF')?.value || '0');
    const newCount = currentCount + 1;
    
    // Update counter and date
    await axios.put(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        customFields: [
          { id: '0MD4Pp2LCyOSCbCjA5qF', value: newCount.toString() },
          { id: 'dWNGeSckpRoVUxXLgxMj', value: new Date().toISOString() }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${ghlToken}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );
    
    console.log(`📊 Updated dial counter for ${contactId}: ${newCount} attempts`);
    
    // Check if terminal status reached
    if (newCount >= MAX_OUTREACH_ATTEMPTS) {
      await markTerminalDisposition(contactId, ghlToken);
    }
    
  } catch (error) {
    console.error(`Failed to increment dial counter for ${contactId}:`, error);
  }
}

/**
 * Mark contact's opportunity with terminal disposition
 */
async function markTerminalDisposition(contactId: string, ghlToken: string): Promise<void> {
  try {
    // Get contact's opportunities
    const oppResponse = await axios.get(
      `https://services.leadconnectorhq.com/opportunities/search?contactId=${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${ghlToken}`,
          'Version': '2021-07-28'
        }
      }
    );
    
    const opportunities = oppResponse.data.opportunities || [];
    
    if (opportunities.length === 0) {
      console.log(`⚠️ No opportunity found for contact ${contactId} - cannot set disposition`);
      return;
    }
    
    // Update first opportunity with terminal disposition
    const opportunityId = opportunities[0].id;
    
    await axios.put(
      `https://services.leadconnectorhq.com/opportunities/${opportunityId}`,
      {
        customFields: [
          { id: '5PTlyH0ahrPVzYTKicYn', value: 'Direct Mail Campaign' }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${ghlToken}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );
    
    console.log(`🏁 Marked opportunity ${opportunityId} as "Direct Mail Campaign" after 8 attempts`);
    
  } catch (error) {
    console.error(`Failed to mark terminal disposition for ${contactId}:`, error);
  }
}
