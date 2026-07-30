import { describe, it, expect } from 'vitest';
import {
  shouldQueueForOutreach,
  mergeTagsForSync,
  AI_OUTREACH_TAG,
  CADENCE_COMPLETE_TAG,
} from '../../amplify/functions/shared/outreachGate';

// Gate for enrolling a synced GHL contact into the email outreach queue. A false negative silently
// drops a lead out of outreach (the 2026-07-28 miss); a false positive emails someone who was never
// meant to be enrolled — which is how the earlier GHL email suspension started.

const TAGS = ['probate', AI_OUTREACH_TAG, 'app:synced'];

describe('shouldQueueForOutreach', () => {
  it('enrols when contactId, the ai outreach tag and an email are all present', () => {
    expect(shouldQueueForOutreach('TmNb5687NUy4hRX7MlAT', TAGS, 'a@b.com')).toBe(true);
  });

  it('does not enrol without the ai outreach tag', () => {
    expect(shouldQueueForOutreach('abc', ['probate', 'app:synced'], 'a@b.com')).toBe(false);
  });

  it('does not enrol without a primary email (outreach is email-only)', () => {
    expect(shouldQueueForOutreach('abc', TAGS, null)).toBe(false);
    expect(shouldQueueForOutreach('abc', TAGS, undefined)).toBe(false);
    expect(shouldQueueForOutreach('abc', TAGS, '')).toBe(false);
  });

  it('does not enrol without a contact id', () => {
    expect(shouldQueueForOutreach(null, TAGS, 'a@b.com')).toBe(false);
    expect(shouldQueueForOutreach(undefined, TAGS, 'a@b.com')).toBe(false);
  });

  it('treats an empty-string contact id as missing', () => {
    // A falsy id would produce a queue row keyed `${userId}_` that no lookup could reach.
    expect(shouldQueueForOutreach('', TAGS, 'a@b.com')).toBe(false);
  });

  it('handles empty, null and undefined tag lists', () => {
    expect(shouldQueueForOutreach('abc', [], 'a@b.com')).toBe(false);
    expect(shouldQueueForOutreach('abc', null, 'a@b.com')).toBe(false);
    expect(shouldQueueForOutreach('abc', undefined, 'a@b.com')).toBe(false);
  });

  it('matches the tag exactly — no partial or case-insensitive match', () => {
    // GHL lowercases tags on its side, but the value we push must match verbatim here.
    expect(shouldQueueForOutreach('abc', ['AI Outreach'], 'a@b.com')).toBe(false);
    expect(shouldQueueForOutreach('abc', ['ai outreach disabled'], 'a@b.com')).toBe(false);
  });

  it('returns a boolean, never a truthy string', () => {
    // Guards against a `contactId && ...` style rewrite leaking the id out of the predicate.
    expect(shouldQueueForOutreach('abc', TAGS, 'a@b.com')).toStrictEqual(true);
    expect(shouldQueueForOutreach('abc', [], 'a@b.com')).toStrictEqual(false);
  });
});

// GHL's PUT /contacts/{id} REPLACES the tag array rather than merging it — verified 2026-07-29 when
// a contact carrying mail:delivered and mail:touch2 came back with neither. Whatever this function
// returns IS the contact's tag list afterwards, so anything it omits is destroyed.
describe('mergeTagsForSync', () => {
  const computed = () => ['App:Synced', 'ai outreach', 'probate'];

  it('preserves GHL-owned tags the app knows nothing about', () => {
    // The whole point: mail delivery tracking and conversation state are not ours to delete.
    const out = mergeTagsForSync(computed(), [
      'mail:delivered',
      'mail:touch2',
      'conversation:manual',
    ]);
    expect(out).toEqual(expect.arrayContaining(['mail:delivered', 'mail:touch2', 'conversation:manual']));
    expect(out).toEqual(expect.arrayContaining(computed()));
  });

  it('removes only what the caller asks to remove', () => {
    const out = mergeTagsForSync(computed(), ['thanks_io_eligible', 'mail:delivered'], [
      'thanks_io_eligible',
    ]);
    expect(out).not.toContain('thanks_io_eligible');
    expect(out).toContain('mail:delivered');
  });

  it('removes case-insensitively, since GHL lowercases stored tags', () => {
    expect(mergeTagsForSync([], ['Thanks_IO_Eligible'], ['thanks_io_eligible'])).toEqual([]);
    expect(mergeTagsForSync(['Direct-Mail-Only'], [], ['direct-mail-only'])).toEqual([]);
  });

  it('does not duplicate a tag that differs only by case', () => {
    expect(mergeTagsForSync(['App:Synced'], ['app:synced'])).toEqual(['app:synced']);
  });

  it('withholds ai outreach when the cadence already completed', () => {
    const out = mergeTagsForSync(computed(), ['email-cadence-complete']);
    expect(out).not.toContain(AI_OUTREACH_TAG);
    expect(out).toContain('email-cadence-complete'); // and the marker itself survives
    expect(out).toContain('probate');
  });

  it('keeps an existing ai outreach tag even when cadence-complete is present', () => {
    // Contradictory state, but removing it would halt a cadence that is genuinely running.
    expect(mergeTagsForSync([], [AI_OUTREACH_TAG, CADENCE_COMPLETE_TAG])).toContain(AI_OUTREACH_TAG);
  });

  it('applies the app tags for a brand-new contact', () => {
    expect(mergeTagsForSync(computed(), undefined)).toEqual(computed());
    expect(mergeTagsForSync(computed(), null)).toEqual(computed());
  });

  it('ignores nulls and blanks in the existing list', () => {
    expect(mergeTagsForSync(['a'], [null, undefined, '  ', 'b'])).toEqual(['b', 'a']);
  });

  it('never returns an empty-string tag', () => {
    expect(mergeTagsForSync([''], ['   '])).toEqual([]);
  });
});
