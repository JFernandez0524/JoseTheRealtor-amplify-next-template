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

// Hard DNC / Legal Opt-Out outcomes
const HARD_DNC_DISPOSITIONS = new Set<string>([
  'dnc',
  'do not call',
  'unsubscribe',
  'remove',
]);

// Terminal business dispositions (stop AI outreach, but not marked OPTED_OUT)
const STOP_DISPOSITIONS = new Set<string>([
  'sold already',
  'not interested',
  'not for sale',
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

export type DispositionAction = 'DNC' | 'STOP' | 'ENGAGED' | 'NONE';

/**
 * Classify a Call Outcome value into the action the app should take on email outreach.
 * Tolerant of casing/whitespace; empty/undefined → 'NONE'.
 */
export function dispositionAction(callOutcome: string | null | undefined): DispositionAction {
  if (!callOutcome || typeof callOutcome !== 'string') return 'NONE';
  const v = callOutcome.trim().toLowerCase();
  if (HARD_DNC_DISPOSITIONS.has(v)) return 'DNC';
  if (STOP_DISPOSITIONS.has(v)) return 'STOP';
  if (ENGAGED_DISPOSITIONS.has(v)) return 'ENGAGED';
  return 'NONE';
}

/**
 * True if this call outcome should stop AI outreach (negative terminal).
 */
export function isTerminalDisposition(callOutcome: string | null | undefined): boolean {
  const action = dispositionAction(callOutcome);
  return action === 'DNC' || action === 'STOP';
}

/**
 * True if this call outcome is a legal DNC / unsubscribe request.
 */
export function isDncDisposition(callOutcome: string | null | undefined): boolean {
  return dispositionAction(callOutcome) === 'DNC';
}

/**
 * Detect the appropriate GHL "Call Outcome" picklist string from an incoming lead message.
 */
export function detectCallOutcomeFromMessage(message: string | null | undefined): string | null {
  if (!message || typeof message !== 'string') return null;
  const msg = message.trim().toLowerCase();

  if (msg.includes('realtor') || msg.includes('listed') || msg.includes('agent')) {
    return 'Listed With Realtor';
  }
  if (msg.includes('sold')) {
    return 'Sold Already';
  }
  if (
    msg.includes('wrong number') ||
    msg.includes('wrong person') ||
    msg.includes('incorrect number') ||
    msg.includes('not my property') ||
    msg.includes('not my house') ||
    msg.includes('not my home') ||
    msg.includes('not the owner') ||
    msg.includes('not owner') ||
    msg.includes("don't own") ||
    msg.includes('dont own') ||
    msg.includes('do not own') ||
    msg.includes('not own') ||
    msg.includes('never owned') ||
    msg.includes('wrong contact') ||
    msg.includes("doesn't belong to me") ||
    msg.includes('does not belong to me') ||
    msg.includes('not mine')
  ) {
    return 'Wrong Number / Disconnected / Invalid Number';
  }
  if (msg.includes('dnc') || msg.includes('do not call') || msg.includes('unsubscribe') || msg === 'stop' || msg.includes('remove me')) {
    return 'DNC';
  }
  if (
    msg.includes('not for sale') ||
    msg.includes('not selling') ||
    msg.includes('never selling') ||
    msg.includes('not interested') ||
    msg.includes('keeping it') ||
    msg.includes("don't want to sell") ||
    msg.includes('dont want to sell')
  ) {
    return 'Not Interested';
  }

  return null;
}

/**
 * Map an AI `end_conversation` reason (from conversationHandler) to the GHL "Call Outcome"
 * picklist value to write on the contact.
 */
export function callOutcomeForEndReason(reason: string | null | undefined): string {
  const r = (reason || '').trim().toLowerCase();
  if (r.includes('realtor') || r.includes('listed') || r.includes('agent')) return 'Listed With Realtor';
  if (r.includes('sold')) return 'Sold Already';
  if (r.includes('wrong')) return 'Wrong Number / Disconnected / Invalid Number';
  if (r.includes('dnc') || r.includes('stop')) return 'DNC';
  return 'Not Interested';
}
