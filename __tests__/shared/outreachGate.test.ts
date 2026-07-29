import { describe, it, expect } from 'vitest';
import {
  shouldQueueForOutreach,
  tagsForSync,
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

// A synced lead keeps `skipTraceStatus === 'COMPLETED'` and its email forever, so the sync happily
// re-derives `ai outreach` long after the 7 touches are done — and GHL drops the tag on completion,
// so nothing else stops it. Without this guard every re-sync restarts the cadence.
describe('tagsForSync', () => {
  const tags = () => ['probate', AI_OUTREACH_TAG, 'app:synced'];

  it('withholds ai outreach when the contact already completed its cadence', () => {
    expect(tagsForSync(tags(), ['app:synced', CADENCE_COMPLETE_TAG])).toEqual([
      'probate',
      'app:synced',
    ]);
  });

  it('leaves the tag alone when the cadence has not completed', () => {
    expect(tagsForSync(tags(), ['app:synced'])).toEqual(tags());
  });

  it('leaves the tag alone for a brand-new contact', () => {
    // No existing contact means no history to preserve — these should start a cadence.
    expect(tagsForSync(tags(), undefined)).toEqual(tags());
    expect(tagsForSync(tags(), null)).toEqual(tags());
    expect(tagsForSync(tags(), [])).toEqual(tags());
  });

  it('matches the completion tag regardless of case or padding', () => {
    // GHL lowercases tags, but the value arrives from an API response we do not control.
    expect(tagsForSync(tags(), ['  Email-Cadence-Complete '])).not.toContain(AI_OUTREACH_TAG);
  });

  it('tolerates nulls in the existing tag list', () => {
    expect(tagsForSync(tags(), [null, undefined, CADENCE_COMPLETE_TAG])).not.toContain(
      AI_OUTREACH_TAG
    );
  });

  it('keeps every other tag untouched when it strips', () => {
    const out = tagsForSync(['a', AI_OUTREACH_TAG, 'b'], [CADENCE_COMPLETE_TAG]);
    expect(out).toEqual(['a', 'b']);
  });

  it('is a no-op when ai outreach was never going to be applied', () => {
    expect(tagsForSync(['probate'], [CADENCE_COMPLETE_TAG])).toEqual(['probate']);
  });
});
