import { describe, it, expect } from 'vitest';
import { isValidEmailSyntax } from '../../amplify/functions/shared/emailValidator';
import { bounceRateExceeded } from '../../amplify/functions/shared/emailStats';

// Both functions are pure — no AWS/network setup required.

describe('isValidEmailSyntax', () => {
  it('accepts well-formed addresses (trimmed)', () => {
    expect(isValidEmailSyntax('jane@example.com')).toBe(true);
    expect(isValidEmailSyntax('  jane@example.com  ')).toBe(true);
    expect(isValidEmailSyntax('a.b+tag@sub.domain.co')).toBe(true);
  });

  it('rejects malformed / empty / non-string', () => {
    expect(isValidEmailSyntax('foo')).toBe(false);
    expect(isValidEmailSyntax('a@b')).toBe(false); // no dot in domain
    expect(isValidEmailSyntax('a b@c.com')).toBe(false); // space
    expect(isValidEmailSyntax('')).toBe(false);
    expect(isValidEmailSyntax(null)).toBe(false);
    expect(isValidEmailSyntax(undefined)).toBe(false);
  });
});

describe('bounceRateExceeded', () => {
  it('returns false until the minimum sample is reached', () => {
    // 10/10 = 100% but below the default 20-send sample
    expect(bounceRateExceeded(10, 10)).toBe(false);
    expect(bounceRateExceeded(19, 19)).toBe(false);
  });

  it('returns false when the rate is under the threshold', () => {
    expect(bounceRateExceeded(100, 4)).toBe(false); // 4% < 5%
  });

  it('returns true at/above the threshold once sampled', () => {
    expect(bounceRateExceeded(100, 5)).toBe(true); // 5%
    expect(bounceRateExceeded(20, 1)).toBe(true); // 5% at min sample
    expect(bounceRateExceeded(40, 10)).toBe(true); // 25%
  });

  it('honors custom minSample and threshold', () => {
    expect(bounceRateExceeded(5, 1, 5, 0.1)).toBe(true); // 20% >= 10% with sample 5
    expect(bounceRateExceeded(5, 1, 10, 0.1)).toBe(false); // sample below 10
  });
});
