import { describe, it, expect } from 'vitest';
import {
  isRetryableStatus,
  getRetryDelayMs,
  RETRY_BASE_MS,
  RETRY_MAX_DELAY_MS,
} from '../../amplify/functions/shared/apiRetry';

// Retry policy behind the GHL client interceptor. Getting `isRetryableStatus` wrong is costly in
// both directions: too narrow and a bulk sync fails on transient 429s (the 2026-07-28 incident);
// too wide and every bad payload burns the Lambda's 30s budget retrying a request that can't work.

describe('isRetryableStatus', () => {
  it('retries rate limiting', () => {
    expect(isRetryableStatus(429)).toBe(true);
  });

  it('retries transient server errors', () => {
    for (const status of [500, 502, 503, 504]) {
      expect(isRetryableStatus(status)).toBe(true);
    }
  });

  it('does NOT retry client errors — the request itself is wrong', () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(isRetryableStatus(status)).toBe(false);
    }
  });

  it('does NOT retry success codes', () => {
    expect(isRetryableStatus(200)).toBe(false);
    expect(isRetryableStatus(201)).toBe(false);
  });

  it('does NOT retry when there is no status (request never dispatched)', () => {
    expect(isRetryableStatus(null)).toBe(false);
    expect(isRetryableStatus(undefined)).toBe(false);
  });
});

describe('getRetryDelayMs', () => {
  it('honours a numeric Retry-After, converting seconds to ms', () => {
    expect(getRetryDelayMs(0, '2')).toBe(2000);
  });

  it('honours an HTTP-date Retry-After relative to now', () => {
    const now = Date.parse('2026-07-28T10:00:00.000Z');
    const soon = new Date(now + 3000).toUTCString();
    // toUTCString drops sub-second precision, so allow a small window.
    const delay = getRetryDelayMs(0, soon, now);
    expect(delay).toBeGreaterThanOrEqual(2000);
    expect(delay).toBeLessThanOrEqual(3000);
  });

  it('treats a past Retry-After date as retry-now, never a negative sleep', () => {
    const now = Date.parse('2026-07-28T10:00:00.000Z');
    const past = new Date(now - 60_000).toUTCString();
    expect(getRetryDelayMs(0, past, now)).toBe(0);
  });

  it('clamps an absurd Retry-After to the cap so a retry cannot outlive the Lambda', () => {
    // GHL occasionally returns a long cool-off; sleeping it would blow the 30s function timeout.
    expect(getRetryDelayMs(0, '600')).toBe(RETRY_MAX_DELAY_MS);
  });

  it('falls back to backoff when Retry-After is absent or unparseable', () => {
    for (const header of [null, undefined, '', '   ', 'soon', 'NaN']) {
      const delay = getRetryDelayMs(0, header as any);
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(RETRY_BASE_MS);
    }
  });

  it('grows the backoff ceiling with each attempt', () => {
    // Compare ceilings rather than single samples — the delay is jittered.
    const maxOver = (attempt: number) =>
      Math.max(...Array.from({ length: 200 }, () => getRetryDelayMs(attempt)));

    expect(maxOver(1)).toBeGreaterThan(maxOver(0));
    expect(maxOver(2)).toBeGreaterThan(maxOver(1));
  });

  it('never exceeds the cap however high the attempt count goes', () => {
    for (const attempt of [3, 5, 10, 50]) {
      expect(getRetryDelayMs(attempt)).toBeLessThanOrEqual(RETRY_MAX_DELAY_MS);
    }
  });

  it('treats a negative attempt as attempt 0 rather than producing a tiny delay', () => {
    const delay = getRetryDelayMs(-3);
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(RETRY_BASE_MS);
  });

  it('jitters so concurrent Lambdas do not retry in lockstep', () => {
    // Without jitter, every Lambda rate-limited in the same burst retries at the same instant and
    // collides again — the failure mode this whole change exists to prevent.
    const samples = new Set(Array.from({ length: 100 }, () => getRetryDelayMs(2)));
    expect(samples.size).toBeGreaterThan(1);
  });

  it('keeps jittered delays within [ceiling/2, ceiling]', () => {
    const ceiling = Math.min(RETRY_BASE_MS * 2 ** 2, RETRY_MAX_DELAY_MS);
    for (let i = 0; i < 200; i++) {
      const delay = getRetryDelayMs(2);
      expect(delay).toBeGreaterThanOrEqual(Math.floor(ceiling / 2));
      expect(delay).toBeLessThanOrEqual(ceiling);
    }
  });
});
