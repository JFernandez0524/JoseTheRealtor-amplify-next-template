/**
 * GHL TAG HELPERS
 *
 * Pure helpers for reading GHL contact tags. Side-effect free so they can be unit-tested
 * (`__tests__/shared/ghlTags.test.ts`).
 *
 * GHL hands tags back in two different shapes depending on the surface: the contacts API returns
 * an array, while workflow webhook payloads flatten them into a single comma-separated string
 * (`"probate,absentee,app:synced,ai outreach"`). GHL also lowercases every tag on write, so all
 * comparisons here are case-insensitive.
 */

/** Tag that pauses the AI on a conversation a human has taken over. */
export const MANUAL_MODE_TAG = 'conversation:manual';

/** Tag marking a contact as enrolled in AI outreach. */
export const AI_OUTREACH_TAG = 'ai outreach';

/**
 * Normalise GHL's two tag shapes into a trimmed, lowercased array.
 * Returns `[]` for anything unrecognised rather than throwing.
 */
export function parseGhlTags(tags: unknown): string[] {
  const raw: unknown[] = Array.isArray(tags)
    ? tags
    : typeof tags === 'string'
      ? tags.split(',')
      : [];

  return raw
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
}

/** Case-insensitive membership test against either tag shape. */
export function hasTag(tags: unknown, tag: string): boolean {
  return parseGhlTags(tags).includes(tag.trim().toLowerCase());
}

/** Whether a contact is currently in manual mode, so the AI must not respond. */
export function isInManualMode(tags: unknown): boolean {
  return hasTag(tags, MANUAL_MODE_TAG);
}
