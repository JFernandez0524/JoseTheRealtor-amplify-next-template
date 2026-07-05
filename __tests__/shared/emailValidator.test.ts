import { describe, it, expect } from 'vitest';
import { isValidEmailSyntax, debounceQualityRank } from '../../amplify/functions/shared/emailValidator';

// Pure helpers — no network. filterValidEmails itself hits Debounce and is exercised e2e.

describe('isValidEmailSyntax', () => {
  it('accepts well-formed addresses', () => {
    expect(isValidEmailSyntax('a@b.co')).toBe(true);
  });
  it('rejects malformed / empty / non-strings', () => {
    expect(isValidEmailSyntax('a@b')).toBe(false);
    expect(isValidEmailSyntax('no-at-sign')).toBe(false);
    expect(isValidEmailSyntax('')).toBe(false);
    expect(isValidEmailSyntax(null)).toBe(false);
    expect(isValidEmailSyntax(undefined)).toBe(false);
  });
});

describe('debounceQualityRank', () => {
  it('ranks Deliverable / Safe to Send highest', () => {
    expect(debounceQualityRank('Deliverable')).toBe(3);
    expect(debounceQualityRank('Safe to Send')).toBe(3);
  });
  it('ranks accept-all below deliverable but above role', () => {
    expect(debounceQualityRank('Accept-All')).toBe(2);
    expect(debounceQualityRank('Role')).toBe(1);
    expect(debounceQualityRank('Deliverable')).toBeGreaterThan(debounceQualityRank('Accept-All'));
    expect(debounceQualityRank('Accept-All')).toBeGreaterThan(debounceQualityRank('Role'));
  });
  it('is case-insensitive and defaults unknown/empty to 0', () => {
    expect(debounceQualityRank('deliverable')).toBe(3);
    expect(debounceQualityRank('Unknown')).toBe(0);
    expect(debounceQualityRank('')).toBe(0);
    expect(debounceQualityRank(undefined)).toBe(0);
  });
});
