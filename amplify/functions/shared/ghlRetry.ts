/**
 * GHL RETRY POLICY
 *
 * Pure decision helpers for retrying GoHighLevel API requests. Kept side-effect free and separate
 * from `ghlClient.ts` so they can be unit-tested without constructing an axios instance
 * (`__tests__/shared/ghlRetry.test.ts`).
 *
 * WHY THIS EXISTS: a bulk sync fans out many concurrent Lambdas, each making several sequential GHL
 * calls. That reliably trips GHL's per-location burst limit and returns 429s. Without retry those
 * surface to the user as failed leads that succeed on a manual retry — see the 2026-07-28 incident
 * (76 × `429 Too Many Requests` across 79 failed syncs).
 *
 * USED BY: `createGhlClient` in `amplify/functions/shared/ghlClient.ts` (response interceptor).
 */

/** Max retry attempts after the initial request. */
export const GHL_MAX_RETRIES = 3;

/** Base for exponential backoff, in ms. */
export const GHL_RETRY_BASE_MS = 500;

/**
 * Ceiling for any single sleep. `manualGhlSync` runs with `timeoutSeconds: 30` and each request
 * carries a 10s axios timeout, so retry sleep must stay well clear of the Lambda budget — a
 * timeout is a worse outcome than surfacing the 429.
 */
export const GHL_RETRY_MAX_DELAY_MS = 5000;

/**
 * Whether a failed GHL request is worth retrying.
 *
 * Only transient server-side conditions qualify. A 4xx other than 429 means the request itself is
 * wrong (bad payload, revoked token, missing contact) and retrying just burns the Lambda's budget
 * before failing anyway.
 */
export function isRetryableGhlStatus(status: number | null | undefined): boolean {
  if (status == null) return false;
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/**
 * Parse a `Retry-After` header into milliseconds. Supports both documented forms: delta-seconds
 * ("2") and an HTTP-date ("Wed, 21 Oct 2026 07:28:00 GMT"). Returns null when absent or
 * unparseable so the caller falls back to backoff.
 */
function parseRetryAfterMs(header: string | null | undefined, now: number): number | null {
  if (!header) return null;

  const trimmed = String(header).trim();
  if (trimmed === '') return null;

  // delta-seconds
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;

  // HTTP-date
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    // A past date means "retry now", not a negative sleep.
    return Math.max(0, dateMs - now);
  }

  return null;
}

/**
 * How long to wait before retry `attempt` (0-indexed: 0 is the first retry).
 *
 * Prefers the server's `Retry-After` when present. Otherwise exponential backoff with **full
 * jitter** — concurrent Lambdas that were all rate-limited in the same burst would otherwise retry
 * in lockstep and collide again. Always clamped to `GHL_RETRY_MAX_DELAY_MS`.
 */
export function getGhlRetryDelayMs(
  attempt: number,
  retryAfterHeader?: string | null,
  now: number = Date.now()
): number {
  const fromHeader = parseRetryAfterMs(retryAfterHeader, now);
  if (fromHeader !== null) return Math.min(fromHeader, GHL_RETRY_MAX_DELAY_MS);

  const safeAttempt = Math.max(0, attempt);
  const ceiling = Math.min(GHL_RETRY_BASE_MS * 2 ** safeAttempt, GHL_RETRY_MAX_DELAY_MS);
  // Full jitter: uniformly random in [ceiling/2, ceiling]. Keeps a useful minimum wait while still
  // spreading concurrent retries apart.
  const floor = ceiling / 2;
  return Math.round(floor + Math.random() * (ceiling - floor));
}
