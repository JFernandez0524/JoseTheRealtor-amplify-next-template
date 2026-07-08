import { describe, it, expect } from 'vitest';
import { isUsableAddress } from '../../app/utils/leadValidation';

// isUsableAddress decides whether a Google Address Validation result is good enough to geocode,
// fetch a Zestimate for, and mark VALID. The CSV upload Lambda uses it to flag unconfirmed
// addresses INVALID and skip their Zestimate. Keeping it pure means we can verify the rules here
// without a live Google call.

describe('isUsableAddress', () => {
  it('returns true for a confirmed, complete match', () => {
    expect(isUsableAddress({ success: true, isPartialMatch: false })).toBe(true);
  });

  it('returns true when isPartialMatch is omitted (treated as complete)', () => {
    expect(isUsableAddress({ success: true })).toBe(true);
  });

  it('returns false for a partial/incomplete match', () => {
    expect(isUsableAddress({ success: true, isPartialMatch: true })).toBe(false);
  });

  it('returns false when validation explicitly did not succeed', () => {
    expect(isUsableAddress({ success: false })).toBe(false);
  });

  it('returns false for null (the Google call threw)', () => {
    expect(isUsableAddress(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isUsableAddress(undefined)).toBe(false);
  });
});
