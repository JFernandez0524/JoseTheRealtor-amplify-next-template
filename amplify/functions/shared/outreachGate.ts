/**
 * OUTREACH ENROLMENT GATE
 *
 * Pure predicate deciding whether a freshly-synced GHL contact should be enrolled in the email
 * outreach queue. Extracted from `manualGhlSync/integrations/gohighlevel.ts` so the rule is stated
 * once, in one place, and can be unit-tested (`__tests__/shared/outreachGate.test.ts`).
 *
 * The `ai outreach` tag is itself gated upstream on `skipTraceStatus === 'COMPLETED'` plus an
 * AI-plan or admin user, so this predicate deliberately checks only the tag rather than
 * re-deriving those conditions.
 */

/** The GHL tag that marks a contact as eligible for AI email outreach. */
export const AI_OUTREACH_TAG = 'ai outreach';

/** Applied by the GHL cadence when a contact has received all 7 email touches. */
export const CADENCE_COMPLETE_TAG = 'email-cadence-complete';

/**
 * Drop `ai outreach` from an outgoing tag list when the contact has already completed its email
 * cadence.
 *
 * The sync re-derives `ai outreach` from `skipTraceStatus === 'COMPLETED'` plus an email, which are
 * both still true long after the 7 touches are done — and GHL removes the tag on completion. So
 * without this, every re-sync silently resurrects the tag and starts the whole cadence again on
 * someone who already received 7 emails and never replied. Found 2026-07-29, where 10 of a 25-lead
 * sample were about to be re-enrolled that way.
 *
 * Only applies to contacts that already exist; a brand-new contact has no history to preserve.
 */
export function tagsForSync(
  tags: string[],
  existingContactTags: (string | null | undefined)[] | null | undefined
): string[] {
  const completed = (existingContactTags ?? []).some(
    (t) => typeof t === 'string' && t.trim().toLowerCase() === CADENCE_COMPLETE_TAG
  );
  return completed ? tags.filter((t) => t !== AI_OUTREACH_TAG) : tags;
}

/**
 * True only when all three requirements hold:
 * - a contact id came back from GHL (create or update),
 * - the contact carries the `ai outreach` tag,
 * - there is a primary email to send to (outreach is email-only; SMS is disabled).
 *
 * Note `contactId` must be non-empty, not merely defined — GHL returning `''` would otherwise
 * produce a queue row keyed `${userId}_` that no lookup could reach.
 */
export function shouldQueueForOutreach(
  contactId: string | null | undefined,
  // Amplify types `leadLabels` as Nullable<string>[], and nulls do occur — the DNC check in
  // gohighlevel.ts filters them explicitly. Accept them here rather than forcing every caller to.
  tags: (string | null | undefined)[] | null | undefined,
  primaryEmail: string | null | undefined
): boolean {
  return Boolean(contactId) && Boolean(primaryEmail) && (tags ?? []).includes(AI_OUTREACH_TAG);
}
