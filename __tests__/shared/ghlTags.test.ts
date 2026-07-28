import { describe, it, expect } from 'vitest';
import {
  parseGhlTags,
  hasTag,
  isInManualMode,
  MANUAL_MODE_TAG,
  AI_OUTREACH_TAG,
} from '../../amplify/functions/shared/ghlTags';

// GHL returns tags as an array from the contacts API but as a comma-separated string in workflow
// webhook payloads. isInManualMode gates whether the AI pauses for a human takeover, so a false
// negative means the AI talks over the agent mid-negotiation.

/** Exactly as it arrives in a "Helper: Sync Custom Fields to App" webhook payload. */
const WEBHOOK_TAGS =
  'probate,absentee,app:synced,data:skiptraced,ai outreach,multi-phone-lead,sentiment:neutral';

describe('parseGhlTags', () => {
  it('splits the comma-separated string from a webhook payload', () => {
    expect(parseGhlTags(WEBHOOK_TAGS)).toEqual([
      'probate',
      'absentee',
      'app:synced',
      'data:skiptraced',
      'ai outreach',
      'multi-phone-lead',
      'sentiment:neutral',
    ]);
  });

  it('accepts the array shape from the contacts API', () => {
    expect(parseGhlTags(['probate', 'ai outreach'])).toEqual(['probate', 'ai outreach']);
  });

  it('trims whitespace around entries', () => {
    expect(parseGhlTags(' probate , ai outreach ')).toEqual(['probate', 'ai outreach']);
  });

  it('lowercases so comparisons are case-insensitive', () => {
    expect(parseGhlTags(['Conversation:Manual', 'AI Outreach'])).toEqual([
      'conversation:manual',
      'ai outreach',
    ]);
  });

  it('drops empty entries from trailing or doubled commas', () => {
    expect(parseGhlTags('probate,,absentee,')).toEqual(['probate', 'absentee']);
  });

  it('returns [] for missing or unusable input without throwing', () => {
    for (const input of [null, undefined, '', '   ', 42, {}, true]) {
      expect(() => parseGhlTags(input)).not.toThrow();
      expect(parseGhlTags(input)).toEqual([]);
    }
  });

  it('ignores non-string entries inside an array', () => {
    expect(parseGhlTags(['probate', null, 7, undefined, 'absentee'])).toEqual([
      'probate',
      'absentee',
    ]);
  });
});

describe('hasTag', () => {
  it('finds a tag in either shape', () => {
    expect(hasTag(WEBHOOK_TAGS, AI_OUTREACH_TAG)).toBe(true);
    expect(hasTag(['probate', 'ai outreach'], AI_OUTREACH_TAG)).toBe(true);
  });

  it('is case-insensitive on both sides', () => {
    expect(hasTag(['Conversation:Manual'], MANUAL_MODE_TAG)).toBe(true);
    expect(hasTag(['conversation:manual'], 'CONVERSATION:MANUAL')).toBe(true);
  });

  it('requires a whole-tag match, not a substring', () => {
    // 'sentiment:neutral' must not satisfy a query for 'neutral'.
    expect(hasTag(WEBHOOK_TAGS, 'neutral')).toBe(false);
    expect(hasTag(['ai outreach disabled'], AI_OUTREACH_TAG)).toBe(false);
  });

  it('is false for missing tag data', () => {
    expect(hasTag(null, MANUAL_MODE_TAG)).toBe(false);
    expect(hasTag([], MANUAL_MODE_TAG)).toBe(false);
  });
});

describe('isInManualMode', () => {
  it('is false for the live James Earl payload — the AI was still armed', () => {
    expect(isInManualMode(WEBHOOK_TAGS)).toBe(false);
  });

  it('is true once the tag is present, in either shape', () => {
    expect(isInManualMode(`${WEBHOOK_TAGS},${MANUAL_MODE_TAG}`)).toBe(true);
    expect(isInManualMode(['probate', MANUAL_MODE_TAG])).toBe(true);
  });

  it('survives GHL casing and spacing variations', () => {
    expect(isInManualMode('probate, Conversation:Manual ')).toBe(true);
  });

  it('is false for missing tag data rather than throwing', () => {
    expect(isInManualMode(null)).toBe(false);
    expect(isInManualMode(undefined)).toBe(false);
  });
});
