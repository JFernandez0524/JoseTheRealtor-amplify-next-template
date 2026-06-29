/**
 * CALL DISPOSITION CLASSIFICATION
 *
 * Maps GHL "Call Outcome" values to whether they should terminate AI outreach.
 * Terminal dispositions move the OutreachQueue item to DND / OPTED_OUT so the
 * email agent stops the cadence (it only sends to items in OUTREACH status —
 * see shared/outreachQueue.ts).
 *
 * Non-terminal dispositions (No Answer, Voicemail, Follow Up, Requested
 * Appointment) leave the contact in outreach.
 */

// Canonical terminal dispositions plus common aliases, all lowercase for
// case-insensitive matching. "Incorrect Number" has several phrasings.
const TERMINAL_DISPOSITIONS = new Set<string>([
  'sold already',
  'not interested',
  'dnc',
  'listed with realtor',
  'incorrect number',
  // aliases of "Incorrect Number"
  'wrong number',
  'disconnected',
  'invalid number',
]);

/**
 * True if this call outcome should stop AI outreach for the contact.
 * Tolerant of casing and surrounding whitespace; empty/undefined → false.
 */
export function isTerminalDisposition(callOutcome: string | null | undefined): boolean {
  if (!callOutcome || typeof callOutcome !== 'string') return false;
  return TERMINAL_DISPOSITIONS.has(callOutcome.trim().toLowerCase());
}
