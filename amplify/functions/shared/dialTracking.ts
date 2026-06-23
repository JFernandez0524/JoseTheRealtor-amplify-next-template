import { createGhlClient, ghlGetContact, ghlUpdateContact } from './ghlClient';

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
 * Prevents duplicate messages on the same day
 */
export function shouldSendNextMessage(contact: any, fieldIds: Record<string, string> = {}): boolean {
  const callAttemptId = fieldIds.call_attempt_counter;
  const lastCallDateId = fieldIds.last_call_date;
  const callAttempts = parseInt(contact.customFields?.find((f: any) => callAttemptId && f.id === callAttemptId)?.value || '0');
  const lastCallDate = contact.customFields?.find((f: any) => lastCallDateId && f.id === lastCallDateId)?.value;
  
  // Max attempts reached
  if (callAttempts >= MAX_OUTREACH_ATTEMPTS) {
    console.log(`⏹️ Contact ${contact.id} reached max attempts (${callAttempts})`);
    return false;
  }
  
  // Check if already messaged today (prevent duplicates)
  if (lastCallDate) {
    const lastCall = new Date(lastCallDate);
    const now = new Date();
    const hoursSinceLastCall = (now.getTime() - lastCall.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLastCall < 24) {
      console.log(`⏸️ Contact ${contact.id} was messaged ${Math.round(hoursSinceLastCall)} hours ago - skipping`);
      return false;
    }
  }
  
  return true;
}

/**
 * Increment dial counter and update last call date
 */
export async function incrementDialCounter(contactId: string, ghlToken: string, fieldIds: Record<string, string> = {}, opportunityFieldIds: Record<string, string> = {}): Promise<void> {
  const callAttemptId = fieldIds.call_attempt_counter;
  const lastCallDateId = fieldIds.last_call_date;

  try {
    // Get current counter value
    const contact = await ghlGetContact(ghlToken, contactId);
    const currentCount = parseInt(contact.customFields?.find((f: any) => callAttemptId && f.id === callAttemptId)?.value || '0');
    const newCount = currentCount + 1;

    const updateFields = [
      callAttemptId && { id: callAttemptId, value: newCount.toString() },
      lastCallDateId && { id: lastCallDateId, value: new Date().toISOString() },
    ].filter(Boolean);

    if (updateFields.length > 0) {
      await ghlUpdateContact(ghlToken, contactId, { customFields: updateFields });
    }

    console.log(`📊 Updated dial counter for ${contactId}: ${newCount} attempts`);

    // Check if terminal status reached
    if (newCount >= MAX_OUTREACH_ATTEMPTS) {
      await markTerminalDisposition(contactId, ghlToken, opportunityFieldIds);
    }

  } catch (error) {
    console.error(`Failed to increment dial counter for ${contactId}:`, error);
  }
}

/**
 * Mark contact's opportunity with terminal disposition
 */
async function markTerminalDisposition(contactId: string, ghlToken: string, opportunityFieldIds: Record<string, string> = {}): Promise<void> {
  const dispositionId = opportunityFieldIds.disposition;
  if (!dispositionId) {
    console.warn(`⚠️ No disposition field ID available for contact ${contactId} — skipping terminal disposition`);
    return;
  }

  try {
    const ghl = createGhlClient(ghlToken);
    const oppResponse = await ghl.get(`/opportunities/search?contactId=${contactId}`);
    const opportunities = oppResponse.data.opportunities || [];

    if (opportunities.length === 0) {
      console.log(`⚠️ No opportunity found for contact ${contactId} - cannot set disposition`);
      return;
    }

    const opportunityId = opportunities[0].id;
    await ghl.put(`/opportunities/${opportunityId}`, {
      customFields: [{ id: dispositionId, value: 'Direct Mail Campaign' }]
    });

    console.log(`🏁 Marked opportunity ${opportunityId} as "Direct Mail Campaign" after 8 attempts`);

  } catch (error) {
    console.error(`Failed to mark terminal disposition for ${contactId}:`, error);
  }
}
