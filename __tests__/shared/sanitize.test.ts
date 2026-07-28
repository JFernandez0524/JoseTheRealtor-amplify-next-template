import { describe, it, expect } from 'vitest';
import { sanitizeId, sanitizeEmail, sanitizePhone, rankMobilePhones, rankLandlinePhones } from '../../amplify/functions/shared/sanitize';

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

describe('rankMobilePhones', () => {
  const mobile = (number: string, score: number | string, extra: any = {}) =>
    ({ type: 'Mobile', score, dnc: false, number, ...extra });

  it('keeps only qualifying mobiles (Mobile, score>=90, not DNC, has number)', () => {
    const input = [
      mobile('111', 95),
      { type: 'Landline', score: 99, dnc: false, number: '222' }, // not mobile
      mobile('333', 80), // score too low
      mobile('444', 99, { dnc: true }), // DNC
      { type: 'Mobile', score: 99, dnc: false, number: '' }, // no number
    ];
    expect(rankMobilePhones(input)).toEqual(['111']);
  });

  it('orders qualifying mobiles best-first by score', () => {
    const input = [mobile('low', 90), mobile('high', 99), mobile('mid', 95)];
    expect(rankMobilePhones(input)).toEqual(['high', 'mid', 'low']);
  });

  it('is stable on equal scores (preserves input order)', () => {
    const input = [mobile('a', 95), mobile('b', 95), mobile('c', 95)];
    expect(rankMobilePhones(input)).toEqual(['a', 'b', 'c']);
  });

  it('tolerates string scores, missing/NaN score, and non-array input', () => {
    expect(rankMobilePhones([mobile('x', '96'), mobile('y', '90')])).toEqual(['x', 'y']);
    expect(rankMobilePhones([mobile('z', undefined as any)])).toEqual([]); // NaN score -> 0 -> filtered
    expect(rankMobilePhones(null as any)).toEqual([]);
    expect(rankMobilePhones([])).toEqual([]);
  });
});

// Landlines are stored in `landlinePhones`, never in `phones`, because everything that texts reads
// `phones`. The disjointness test below is the guard: if these two ever overlap, a landline can
// reach the SMS path and messages silently fail.
describe('rankLandlinePhones', () => {
  it('keeps non-DNC landlines ordered best-score-first', () => {
    expect(
      rankLandlinePhones([
        { type: 'Land Line', score: 60, number: '5550000060' },
        { type: 'Land Line', score: 95, number: '5550000095' },
        { type: 'Land Line', score: 80, number: '5550000080' },
      ])
    ).toEqual(['5550000095', '5550000080', '5550000060']);
  });

  it('excludes every DNC landline', () => {
    expect(
      rankLandlinePhones([
        { type: 'Land Line', score: 99, number: '5551111111', dnc: true },
        { type: 'Land Line', score: 10, number: '5552222222', dnc: false },
      ])
    ).toEqual(['5552222222']);
  });

  it('excludes mobiles', () => {
    expect(
      rankLandlinePhones([
        { type: 'Mobile', score: 99, number: '5553333333' },
        { type: 'Land Line', score: 50, number: '5554444444' },
      ])
    ).toEqual(['5554444444']);
  });

  it('applies no score floor — the 90+ threshold is mobile-specific', () => {
    // Most landlines score below the mobile deliverability bar; discarding them would defeat
    // the point of surfacing them at all.
    expect(rankLandlinePhones([{ type: 'Land Line', score: 12, number: '5555555555' }])).toEqual([
      '5555555555',
    ]);
  });

  it('excludes entries with no number', () => {
    expect(rankLandlinePhones([{ type: 'Land Line', score: 99 }])).toEqual([]);
  });

  it('returns [] for null, undefined and non-arrays', () => {
    expect(rankLandlinePhones(null as any)).toEqual([]);
    expect(rankLandlinePhones(undefined as any)).toEqual([]);
    expect(rankLandlinePhones('nope' as any)).toEqual([]);
    expect(rankLandlinePhones([])).toEqual([]);
  });

  it('preserves input order on equal scores', () => {
    expect(
      rankLandlinePhones([
        { type: 'Land Line', score: 50, number: 'first' },
        { type: 'Land Line', score: 50, number: 'second' },
      ])
    ).toEqual(['first', 'second']);
  });

  it('does not mutate its input', () => {
    const input = [
      { type: 'Land Line', score: 10, number: 'a' },
      { type: 'Land Line', score: 90, number: 'b' },
    ];
    const snapshot = JSON.stringify(input);
    rankLandlinePhones(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('mobile / landline separation', () => {
  const MIXED = [
    { type: 'Mobile', score: 95, number: '5550001111' },
    { type: 'Land Line', score: 95, number: '5550002222' },
    { type: 'Mobile', score: 40, number: '5550003333' },
    { type: 'Land Line', score: 20, number: '5550004444', dnc: true },
    { type: 'Land Line', score: 30, number: '5550005555' },
  ];

  it('returns disjoint sets — no number can be both a phone and a landline', () => {
    const mobiles = rankMobilePhones(MIXED);
    const landlines = rankLandlinePhones(MIXED);
    expect(mobiles.filter((n) => landlines.includes(n))).toEqual([]);
  });

  it('routes each number to exactly the right bucket', () => {
    expect(rankMobilePhones(MIXED)).toEqual(['5550001111']); // 40-score mobile fails the 90 floor
    expect(rankLandlinePhones(MIXED)).toEqual(['5550002222', '5550005555']); // DNC one excluded
  });

  it('never lets a DNC number into either bucket', () => {
    const dncOnly = [
      { type: 'Mobile', score: 99, number: 'm', dnc: true },
      { type: 'Land Line', score: 99, number: 'l', dnc: true },
    ];
    expect(rankMobilePhones(dncOnly)).toEqual([]);
    expect(rankLandlinePhones(dncOnly)).toEqual([]);
  });
});
