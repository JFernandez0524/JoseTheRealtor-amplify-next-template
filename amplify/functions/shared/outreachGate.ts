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
 * Build the tag list to send to GHL for a contact.
 *
 * **`PUT /contacts/{id}` REPLACES the tag array — it does not merge.** Verified 2026-07-29: a
 * contact carrying `mail:delivered` and `mail:touch2` came back with neither after a sync that
 * never mentioned them. So whatever this returns is the contact's complete tag list afterwards,
 * and anything omitted is destroyed — including tags the app knows nothing about: `mail:*`
 * delivery tracking, `conversation:manual`, `conversation:active`, `max_attempts_reached`,
 * `email-cadence-complete`, and anything applied by hand.
 *
 * Hence: start from what the contact already has, add what the app computed, and remove only the
 * tags the caller explicitly asks to drop. The app corrects what it owns and preserves the rest.
 *
 * Two subtleties:
 * - Dedupe is case-insensitive because GHL lowercases every tag it stores, so `App:Synced` and
 *   `app:synced` are the same tag and sending both would be meaningless.
 * - `ai outreach` is not *added* to a contact already tagged `email-cadence-complete`. The sync
 *   re-derives that tag from `skipTraceStatus === 'COMPLETED'` plus an email — both permanently
 *   true — while GHL removes it on completion, so without this every re-sync restarts the whole
 *   7-touch cadence on someone who already got 7 emails and never replied. An existing
 *   `ai outreach` is left alone: removing it would halt a cadence that is genuinely running.
 */
export function mergeTagsForSync(
  computed: string[],
  existingContactTags: (string | null | undefined)[] | null | undefined,
  removeTags: readonly string[] = []
): string[] {
  const existing = existingContactTags ?? [];
  const remove = new Set(removeTags.map((t) => t.toLowerCase()));
  const completedCadence = existing.some(
    (t) => typeof t === 'string' && t.trim().toLowerCase() === CADENCE_COMPLETE_TAG
  );

  const out: string[] = [];
  const seen = new Set<string>();
  const add = (tag: string) => {
    const key = tag.trim().toLowerCase();
    if (!key || seen.has(key) || remove.has(key)) return;
    seen.add(key);
    out.push(tag);
  };

  for (const t of existing) if (typeof t === 'string') add(t);
  for (const t of computed) {
    if (completedCadence && t === AI_OUTREACH_TAG) continue;
    add(t);
  }
  return out;
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
