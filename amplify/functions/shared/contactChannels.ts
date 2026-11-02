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

import { computeForeclosureFinancials } from './foreclosureFinancials';

/** Skip-trace states that mean a trace actually ran and matched an owner. NO_MATCH is not syncable/mailable. */
const CONCLUDED_TRACE_STATUSES = new Set(['COMPLETED', 'NO_QUALITY_CONTACTS']);

/**
 * The tag a mail-eligible contact carries. GHL lowercases every tag, so this must be written
 * lowercase here or two spellings become the same tag in GHL and silently overwrite each other.
 */
export const DIRECT_MAIL_TAG = 'direct-mail-only';

/**
 * Every tag that can put a contact into a Thanks.io campaign, across the tag names this app has
 * used over time. Removed together when a lead stops being mail-eligible.
 *
 * Deliberately excludes delivery-tracking tags (`mail:delivered`, `mail:touch2`, …): those record
 * what was already sent and are history, not eligibility.
 */
export const DIRECT_MAIL_TAGS = [
  DIRECT_MAIL_TAG,
  'thanks_io_eligible',
  'probate_mail', // superseded by DIRECT_MAIL_TAG, still present on contacts synced before that
  'direct_mail_only', // the DIRECT_MAIL_ONLY lead label, lowercased by GHL
] as const;

/**
 * A stored lead label asserting direct-mail status, written by the skip tracer before landlines
 * counted as contact. It is a cached verdict, not an input: the live rule below supersedes it, so
 * it must never be shipped to GHL as a tag or it would re-mail a lead we can now call.
 */
const STALE_DIRECT_MAIL_LABEL = 'DIRECT_MAIL_ONLY';

/** Lead labels minus any stale direct-mail verdict, ready to be sent to GHL as tags. */
export function labelsForSync(labels: (string | null)[] | null | undefined): string[] {
  return (labels ?? []).filter(
    (l): l is string => typeof l === 'string' && l !== STALE_DIRECT_MAIL_LABEL
  );
}

export interface LeadChannels {
  /** SMS-capable mobiles. */
  phones?: (string | null)[] | null;
  /** Non-DNC landlines — callable and mailable, but never SMS. */
  landlinePhones?: (string | null)[] | null;
  emails?: (string | null)[] | null;
  skipTraceStatus?: string | null;
  type?: string | null;
  [key: string]: any;
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
 * Direct mail is the last resort: for leads whose skip trace has concluded without phone/email,
 * or Preforeclosure Auction leads that can be mailed immediately before or alongside skip-tracing.
 */
export function isDirectMailOnlyLead(lead: LeadChannels): boolean {
  if (hasAnyContactChannel(lead)) return false;

  if (hasConcludedSkipTrace(lead.skipTraceStatus)) return true;

  const isPreforeclosure =
    String(lead.type || '').toUpperCase().replace(/[_\s-]+/g, '') === 'PREFORECLOSURE';
  if (isPreforeclosure) {
    const fin = computeForeclosureFinancials(lead);
    if (fin.isSheriffSale) return true;
  }

  return false;
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
