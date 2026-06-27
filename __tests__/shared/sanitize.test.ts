import { describe, it, expect } from 'vitest';
import { sanitizeId, sanitizeEmail, sanitizePhone } from '../../amplify/functions/shared/sanitize';

describe('sanitizeId', () => {
  it('removes special characters, keeps alphanumeric, underscores, and hyphens', () => {
    expect(sanitizeId('abc-123_XYZ')).toBe('abc-123_XYZ');
    expect(sanitizeId('hello world!')).toBe('helloworld');
    expect(sanitizeId('foo@bar.com')).toBe('foobarcom');
    expect(sanitizeId('test/path?query=1')).toBe('testpathquery1');
  });

  it('returns empty string for empty or falsy input', () => {
    expect(sanitizeId('')).toBe('');
    expect(sanitizeId(null as any)).toBe('');
    expect(sanitizeId(undefined as any)).toBe('');
  });

  it('truncates to 255 characters', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeId(long)).toHaveLength(255);
  });

  it('preserves hyphens and underscores used in DynamoDB keys', () => {
    expect(sanitizeId('user-id_abc123')).toBe('user-id_abc123');
  });
});

describe('sanitizeEmail', () => {
  it('lowercases and trims the email', () => {
    expect(sanitizeEmail('  User@Example.COM  ')).toBe('user@example.com');
  });

  it('removes characters not allowed in email addresses', () => {
    expect(sanitizeEmail('user<script>@bad.com')).toBe('userscript@bad.com');
    expect(sanitizeEmail('hello world@test.com')).toBe('helloworld@test.com');
  });

  it('preserves valid email characters: @ . + _ -', () => {
    expect(sanitizeEmail('first.last+tag@sub-domain.com')).toBe('first.last+tag@sub-domain.com');
  });

  it('returns empty string for empty or falsy input', () => {
    expect(sanitizeEmail('')).toBe('');
    expect(sanitizeEmail(null as any)).toBe('');
    expect(sanitizeEmail(undefined as any)).toBe('');
  });
});

describe('sanitizePhone', () => {
  it('strips all non-digit and non-plus characters', () => {
    expect(sanitizePhone('(555) 867-5309')).toBe('5558675309');
    expect(sanitizePhone('+1 800 555-1234')).toBe('+18005551234');
    expect(sanitizePhone('555.867.5309')).toBe('5558675309');
  });

  it('preserves leading + for international format', () => {
    expect(sanitizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('returns empty string for empty or falsy input', () => {
    expect(sanitizePhone('')).toBe('');
    expect(sanitizePhone(null as any)).toBe('');
    expect(sanitizePhone(undefined as any)).toBe('');
  });

  it('returns digits only if no + present', () => {
    expect(sanitizePhone('abc123def')).toBe('123');
  });
});
