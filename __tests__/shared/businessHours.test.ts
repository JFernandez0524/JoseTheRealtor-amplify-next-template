import { describe, it, expect, vi, afterEach } from 'vitest';
import { isWithinBusinessHours, getNextBusinessHourMessage } from '../../amplify/functions/shared/businessHours';

// All times are set as UTC and cross-checked against America/New_York offset.
// EST = UTC-5, EDT = UTC-4.
// Using winter dates so EST (-5) applies consistently.

// Helper: returns a Date whose Eastern time equals the given hour on a given weekday.
// We use 2025-01-06 (Monday) as the Monday anchor in EST (UTC-5).
// Day offsets: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
function estDate(dayOffset: number, hour: number): Date {
  // 2025-01-06 00:00 EST = 2025-01-06 05:00 UTC
  const mondayMidnightUTC = new Date('2025-01-06T05:00:00Z');
  const ms = mondayMidnightUTC.getTime() + dayOffset * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000;
  return new Date(ms);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('isWithinBusinessHours', () => {
  it('returns true on Monday at 9 AM EST', () => {
    vi.useFakeTimers({ now: estDate(0, 9) });
    expect(isWithinBusinessHours()).toBe(true);
  });

  it('returns true on Friday at 6 PM EST (hour=18)', () => {
    vi.useFakeTimers({ now: estDate(4, 18) });
    expect(isWithinBusinessHours()).toBe(true);
  });

  it('returns false on Monday at 8 AM EST (before open)', () => {
    vi.useFakeTimers({ now: estDate(0, 8) });
    expect(isWithinBusinessHours()).toBe(false);
  });

  it('returns false on Monday at 7 PM EST (hour=19, after close)', () => {
    vi.useFakeTimers({ now: estDate(0, 19) });
    expect(isWithinBusinessHours()).toBe(false);
  });

  it('returns true on Saturday at 10 AM EST', () => {
    vi.useFakeTimers({ now: estDate(5, 10) });
    expect(isWithinBusinessHours()).toBe(true);
  });

  it('returns false on Saturday at 12 PM EST (noon, after close)', () => {
    vi.useFakeTimers({ now: estDate(5, 12) });
    expect(isWithinBusinessHours()).toBe(false);
  });

  it('returns false on Saturday at 8 AM EST (before open)', () => {
    vi.useFakeTimers({ now: estDate(5, 8) });
    expect(isWithinBusinessHours()).toBe(false);
  });

  it('returns false on Sunday at any hour', () => {
    for (const h of [0, 9, 12, 18]) {
      vi.useFakeTimers({ now: estDate(6, h) });
      expect(isWithinBusinessHours()).toBe(false);
    }
  });
});

describe('getNextBusinessHourMessage', () => {
  it('returns Sunday message when called on Sunday', () => {
    vi.useFakeTimers({ now: estDate(6, 14) });
    const msg = getNextBusinessHourMessage();
    expect(msg).toContain('Sunday');
    expect(msg).toContain('Monday');
  });

  it('returns Saturday after-hours message when called Saturday afternoon', () => {
    vi.useFakeTimers({ now: estDate(5, 14) });
    const msg = getNextBusinessHourMessage();
    expect(msg).toContain('Saturday after hours');
    expect(msg).toContain('Monday');
  });

  it('returns before-hours message on Monday morning', () => {
    vi.useFakeTimers({ now: estDate(0, 7) });
    const msg = getNextBusinessHourMessage();
    expect(msg).toContain('Before business hours');
  });

  it('returns after-hours message on Tuesday evening', () => {
    vi.useFakeTimers({ now: estDate(1, 21) });
    const msg = getNextBusinessHourMessage();
    expect(msg).toContain('After business hours');
    expect(msg).toContain('tomorrow');
  });

  it('returns Friday after-hours → Saturday message on Friday evening', () => {
    vi.useFakeTimers({ now: estDate(4, 20) });
    const msg = getNextBusinessHourMessage();
    expect(msg).toContain('Friday after hours');
    expect(msg).toContain('Saturday');
  });

  it('returns within-hours message during business hours', () => {
    vi.useFakeTimers({ now: estDate(2, 11) });
    const msg = getNextBusinessHourMessage();
    expect(msg).toContain('Within business hours');
  });
});
