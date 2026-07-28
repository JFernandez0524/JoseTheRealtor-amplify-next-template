/**
 * CONTACT CHANNEL RULES
 *
 * Pure predicates deciding how a lead can be reached, and therefore whether direct mail applies.
 * Side-effect free so they can be unit-tested (`__tests__/shared/contactChannels.test.ts`).
 *
 * THE RULE (from the account owner):
 *   "A landline still counts as a phone number and should not be marked as a direct mail lead at
 *    all. Direct mail leads are leads without a qualified mobile line, land line or an email.
 *    Direct mail is the last resort if no other forms of contact are found via skiptracing."
 *
 * Two consequences worth stating, because the previous implementation got both backwards:
 *
 * 1. Having an email *disqualifies* a lead from direct mail. The old rule marked a lead as
 *    direct-mail precisely *because* it had an email and no phone.
 * 2. "found via skiptracing" is load-bearing: a lead that has never been traced has no contacts
 *    *yet*, which is not the same as having none. Mailing it is premature — a trace may still turn
 *    up a phone or an email.
 */

/** Skip-trace states that mean a trace actually ran and reached a conclusion. */
const CONCLUDED_TRACE_STATUSES = new Set(['COMPLETED', 'NO_MATCH', 'NO_QUALITY_CONTACTS']);

export interface LeadChannels {
  /** SMS-capable mobiles. */
  phones?: (string | null)[] | null;
  /** Non-DNC landlines — callable and mailable, but never SMS. */
  landlinePhones?: (string | null)[] | null;
  emails?: (string | null)[] | null;
  skipTraceStatus?: string | null;
}

const any = (list: (string | null)[] | null | undefined): boolean =>
  Array.isArray(list) && list.some((v) => typeof v === 'string' && v.trim() !== '');

/** True once a skip trace has run and concluded, whatever it found. */
export function hasConcludedSkipTrace(status: string | null | undefined): boolean {
  return CONCLUDED_TRACE_STATUSES.has(String(status ?? '').toUpperCase());
}

/** Any phone we can dial — a landline counts. */
export function isCallableLead(lead: LeadChannels): boolean {
  return any(lead.phones) || any(lead.landlinePhones);
}

/** Any means of contact at all. */
export function hasAnyContactChannel(lead: LeadChannels): boolean {
  return isCallableLead(lead) || any(lead.emails);
}

/**
 * Direct mail is the last resort: only for a lead whose skip trace has concluded and turned up no
 * phone, no landline and no email.
 *
 * Note this is about *eligibility by channel*. The property-value window is a separate filter
 * applied by the caller.
 */
export function isDirectMailOnlyLead(lead: LeadChannels): boolean {
  return hasConcludedSkipTrace(lead.skipTraceStatus) && !hasAnyContactChannel(lead);
}

/**
 * The number this GHL contact should be dialed on.
 *
 * `specificPhone` is the mobile assigned to this contact by the one-phone-one-contact loop. When a
 * lead has no mobile, the best landline takes its place — the dialer reads only the primary phone
 * field, so a landline parked in a custom field would never be called.
 */
export function resolveDialablePhone(
  specificPhone: string | null | undefined,
  landlinePhones: (string | null)[] | null | undefined
): string | null {
  if (specificPhone && specificPhone.trim() !== '') return specificPhone;
  const first = (landlinePhones ?? []).find((v) => typeof v === 'string' && v.trim() !== '');
  return first ?? null;
}
