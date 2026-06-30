/**
 * CALL DISPOSITION CLASSIFICATION
 *
 * Maps GHL "Call Outcome" (contact custom field) values to how they affect AI
 * email outreach. Values must match the field's option strings exactly — see
 * ghlFieldProvisioner.ts CONTACT_FIELDS 'Call Outcome' and the GHL "Terminal
 * Outcome Guard" workflow.
 *
 * - STOP    (negative outcome): opt the contact out → OutreachQueue DND / OPTED_OUT.
 * - ENGAGED (positive outcome): the lead booked an appointment, so pause cold
 *   email but do NOT mark them opted-out → OutreachQueue CONVERSATION.
 * - NONE: leave the cadence running (No Answer, Voicemail, Follow Up, Timeline,
 *   DEAD / Max Attempts — the dialer workflow falls back to email/mail there).
 *
 * The email agent only sends to OUTREACH-status items (shared/outreachQueue.ts),
 * so both STOP and ENGAGED pause email; STOP additionally opts the contact out.
 */

// Negative outcomes → opt out. Lowercased for case-insensitive matching.
// The wrong-number option is a SINGLE combined string in GHL; aliases cover the
// alternate "Incorrect Number" call-disposition naming too.
const STOP_DISPOSITIONS = new Set<string>([
  'sold already',
  'not interested',
  'dnc',
  'listed with realtor',
  'wrong number / disconnected / invalid number',
  // robust aliases
  'incorrect number',
  'wrong number',
  'disconnected',
  'invalid number',
]);

// Positive outcome → pause cold email as "engaged" (not opted out).
const ENGAGED_DISPOSITIONS = new Set<string>([
  'appointment set',
]);

export type DispositionAction = 'STOP' | 'ENGAGED' | 'NONE';

/**
 * Classify a Call Outcome value into the action the app should take on email outreach.
 * Tolerant of casing/whitespace; empty/undefined → 'NONE'.
 */
export function dispositionAction(callOutcome: string | null | undefined): DispositionAction {
  if (!callOutcome || typeof callOutcome !== 'string') return 'NONE';
  const v = callOutcome.trim().toLowerCase();
  if (STOP_DISPOSITIONS.has(v)) return 'STOP';
  if (ENGAGED_DISPOSITIONS.has(v)) return 'ENGAGED';
  return 'NONE';
}

/**
 * True if this call outcome should opt the contact out of outreach (negative terminal).
 * Thin wrapper over dispositionAction for backward compatibility.
 */
export function isTerminalDisposition(callOutcome: string | null | undefined): boolean {
  return dispositionAction(callOutcome) === 'STOP';
}
