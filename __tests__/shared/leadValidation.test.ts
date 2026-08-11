import { describe, it, expect } from 'vitest';
import {
  sanitizeName,
  isValidName,
  formatPhoneE164,
  sanitizePhoneInput,
  NAME_MAX,
  isEntityName,
  isTaxForeclosureCase,
  normalizeAddress,
  addressesMatch,
} from '@/app/utils/leadValidation';

// All functions are pure — no AWS / network setup required.

describe('sanitizeName', () => {
  it('strips digits and special characters', () => {
    expect(sanitizeName("J0hn!@#")).toBe('Jhn');
    expect(sanitizeName("O'Brien")).toBe('OBrien');
    expect(sanitizeName('Mary-Jane')).toBe('MaryJane');
  });

  it('keeps letters and single spaces', () => {
    expect(sanitizeName('Mary Jane')).toBe('Mary Jane');
    expect(sanitizeName('Mary   Jane')).toBe('Mary Jane'); // collapse runs of spaces
  });

  it('caps length at NAME_MAX', () => {
    const long = 'a'.repeat(80);
    expect(sanitizeName(long)).toHaveLength(NAME_MAX);
  });

  it('handles non-string input', () => {
    expect(sanitizeName(undefined as any)).toBe('');
  });
});

describe('isValidName', () => {
  it('accepts letters and spaces', () => {
    expect(isValidName('John')).toBe(true);
    expect(isValidName('Mary Jane')).toBe(true);
  });

  it('rejects digits, punctuation, and symbols', () => {
    expect(isValidName('J0hn')).toBe(false);
    expect(isValidName("O'Brien")).toBe(false);
    expect(isValidName('Mary-Jane')).toBe(false);
    expect(isValidName('bob@x')).toBe(false);
  });

  it('rejects empty / whitespace-only', () => {
    expect(isValidName('')).toBe(false);
    expect(isValidName('   ')).toBe(false);
  });

  it('rejects names over the length cap', () => {
    expect(isValidName('a'.repeat(NAME_MAX + 1))).toBe(false);
  });
});

describe('formatPhoneE164', () => {
  it('normalizes a 10-digit US number', () => {
    expect(formatPhoneE164('2015551234')).toBe('+12015551234');
    expect(formatPhoneE164('(201) 555-1234')).toBe('+12015551234');
  });

  it('normalizes an 11-digit number with leading 1', () => {
    expect(formatPhoneE164('12015551234')).toBe('+12015551234');
    expect(formatPhoneE164('+1 201 555 1234')).toBe('+12015551234');
  });

  it('rejects invalid lengths and junk', () => {
    expect(formatPhoneE164('123')).toBeNull();
    expect(formatPhoneE164('abc')).toBeNull();
    expect(formatPhoneE164('5555555555555')).toBeNull();
    expect(formatPhoneE164('')).toBeNull();
    expect(formatPhoneE164(null)).toBeNull();
  });
});

describe('sanitizePhoneInput', () => {
  it('keeps digits and a single leading +', () => {
    expect(sanitizePhoneInput('+1 (201) 555-1234')).toBe('+12015551234');
    expect(sanitizePhoneInput('abc201def555')).toBe('201555');
  });

  it('drops a + that is not leading', () => {
    expect(sanitizePhoneInput('201+555')).toBe('201555');
  });
});

describe('isEntityName', () => {
  it('flags corporate/legal entities from the county file', () => {
    expect(isEntityName('Showboat Properties LLC')).toBe(true);
    expect(isEntityName('TLOA of NJ LLC')).toBe(true);
    expect(isEntityName('Delaware Valley Opportunity Fund 231')).toBe(true);
    expect(isEntityName('Emerson Redevelopers Urban Renewal')).toBe(true);
    expect(isEntityName('RRA CP Opportunity Trust 2')).toBe(true);
    expect(isEntityName('US Bank Trust National Association')).toBe(true);
    expect(isEntityName('Fagan and Fagan LLC')).toBe(true);
  });

  it('does not flag individual homeowners', () => {
    expect(isEntityName('Kelly Mooney')).toBe(false);
    expect(isEntityName('Anne Marie Grady')).toBe(false);
    expect(isEntityName('Devyaniben Patel')).toBe(false);
  });

  it('handles empty / null / undefined', () => {
    expect(isEntityName('')).toBe(false);
    expect(isEntityName(null)).toBe(false);
    expect(isEntityName(undefined)).toBe(false);
  });
});

describe('isTaxForeclosureCase', () => {
  it('detects the Tax_Fore marker on case numbers', () => {
    expect(isTaxForeclosureCase('F-07510-26 Tax_Fore')).toBe(true);
    expect(isTaxForeclosureCase('F-07246-26 Tax_Fore')).toBe(true);
    expect(isTaxForeclosureCase('F-07441-26  Tax_Fore')).toBe(true);
    expect(isTaxForeclosureCase('tax foreclosure')).toBe(true);
  });

  it('returns false for ordinary mortgage foreclosure cases', () => {
    expect(isTaxForeclosureCase('F-07450-26')).toBe(false);
    expect(isTaxForeclosureCase('')).toBe(false);
    expect(isTaxForeclosureCase(null)).toBe(false);
  });
});

describe('normalizeAddress', () => {
  it('strips punctuation, normalizes suffixes, directions, and units', () => {
    expect(normalizeAddress('123 North Main Street, Apt. 4B')).toBe('123 n main st apt 4b');
    expect(normalizeAddress('456 S. Broadway Blvd, Suite #100')).toBe('456 s broadway blvd ste 100');
  });

  it('handles null/undefined gracefully', () => {
    expect(normalizeAddress(null)).toBe('');
    expect(normalizeAddress(undefined)).toBe('');
  });
});

describe('addressesMatch', () => {
  it('matches full Zillow address against street-only lead address', () => {
    expect(addressesMatch('123 Main St, Newark, NJ 07102', '123 Main St')).toBe(true);
    expect(addressesMatch('123 North Main Street, Newark, NJ 07102', '123 N Main St')).toBe(true);
  });

  it('matches addresses with punctuation and unit format variations', () => {
    expect(addressesMatch('100 Ocean Ave, Apt 2B, Miami, FL', '100 Ocean Ave #2B')).toBe(true);
    expect(addressesMatch('456 W. 5th St., Suite 10', '456 West 5th Street Ste 10')).toBe(true);
  });

  it('detects genuine house number mismatches', () => {
    expect(addressesMatch('125 Main St, Newark, NJ 07102', '123 Main St')).toBe(false);
    expect(addressesMatch('100 Main St', '102 Main St')).toBe(false);
  });

  it('detects genuine street name mismatches', () => {
    expect(addressesMatch('123 Oak St, Newark, NJ 07102', '123 Main St')).toBe(false);
  });

  it('returns true when either address is missing', () => {
    expect(addressesMatch(null, '123 Main St')).toBe(true);
    expect(addressesMatch('123 Main St', undefined)).toBe(true);
  });
});

