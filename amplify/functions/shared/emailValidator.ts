/**
 * EMAIL VALIDATOR
 *
 * Validates email addresses via the Debounce.io API at INGEST to protect sender
 * reputation and reduce bounce rates.
 *
 * BEHAVIOR:
 * - Rejects addresses that fail basic regex (`isValidEmailSyntax`)
 * - Calls Debounce.io; treats send_transactional === "1" as safe
 * - Retries transient failures (429/5xx) with backoff, under a wall-clock budget shared across the
 *   batch — see the retry-budget note above `validateEmail`
 * - Fails open once retries or the budget are exhausted, so outages don't silently drop contacts
 *
 * USED BY:
 * - amplify/functions/skiptraceLeads — validates found emails before storing
 * - amplify/functions/manualGhlSync — validates emails before sync
 * - amplify/functions/dailyEmailAgent — uses `isValidEmailSyntax` as a cheap
 *   send-time guard (no API call); deliverability is already vetted at ingest
 */
import axios from 'axios';
import { getRetryDelayMs, isRetryableStatus } from './apiRetry';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Cheap, free syntax check (no network). Used as a last-line guard before sending.
 */
export function isValidEmailSyntax(email: string | null | undefined): boolean {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
}

interface DebounceResponse {
  debounce: {
    send_transactional: string; // "1" = safe, "0" = not safe
    result: string;
    reason: string;
  };
  success: string;
}

/**
 * Rank a Debounce `result` string by deliverability confidence (higher = better).
 * Lets us pick the *best* address, not just a valid one — Deliverable beats Accept-All
 * (catch-all domain, unverifiable) beats Role (info@, sales@) beats anything else.
 */
export function debounceQualityRank(result: string | undefined): number {
  const r = (result || '').toLowerCase();
  if (r.includes('deliverable') || r.includes('safe to send')) return 3;
  if (r.includes('accept')) return 2; // accept-all / catch-all
  if (r.includes('role')) return 1;
  return 0; // unknown / fail-open
}

/**
 * Retry budget. Debounce rate-limits hard under concurrent load — a single sync run logged 142
 * `429`s — and every one of those previously failed open, so addresses reached the outreach queue
 * unvalidated. Retrying fixes that, but the budget matters more than the retry: `manualGhlSync`
 * runs with `timeoutSeconds: 30` and makes several sequential GHL calls *after* validation, so an
 * unbounded retry chain would turn a soft validation miss into a hard Lambda timeout — strictly
 * worse. Hence a small per-request timeout, few retries, and a wall-clock deadline shared across
 * every address in the batch.
 */
const DEBOUNCE_TIMEOUT_MS = 5000;
const DEBOUNCE_MAX_RETRIES = 2;
const DEBOUNCE_TOTAL_BUDGET_MS = 10000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function validateEmail(
  email: string,
  apiKey: string,
  deadline: number
): Promise<{ valid: boolean; rank: number }> {
  if (!EMAIL_REGEX.test(email)) return { valid: false, rank: -1 };

  for (let attempt = 0; attempt <= DEBOUNCE_MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.get<DebounceResponse>('https://api.debounce.io/v1/', {
        params: { api: apiKey, email },
        timeout: DEBOUNCE_TIMEOUT_MS,
      });
      return {
        valid: data?.debounce?.send_transactional === '1',
        rank: debounceQualityRank(data?.debounce?.result),
      };
    } catch (err: any) {
      const { status, isAuthOrClientError } = classifyDebounceError(err);
      const canRetry =
        attempt < DEBOUNCE_MAX_RETRIES && !isAuthOrClientError && isRetryableStatus(status);

      if (!canRetry) {
        console.warn(
          `⚠️ [EMAIL_VALIDATOR] API error for ${email}, keeping email (fail open):`,
          err.message
        );
        return { valid: true, rank: 0 };
      }

      const delay = getRetryDelayMs(
        attempt,
        (err.response?.headers?.['retry-after'] as string | undefined) ?? null
      );

      // Respect the shared deadline: if sleeping would push us past it, fail open now rather than
      // burn the caller's remaining Lambda budget on a retry we can't afford.
      if (Date.now() + delay >= deadline) {
        console.warn(
          `⏱️ [EMAIL_VALIDATOR] Validation budget exhausted for ${email} (last status ${status}) — ` +
            'keeping email unvalidated (fail open).'
        );
        return { valid: true, rank: 0 };
      }

      console.warn(
        `⏳ [EMAIL_VALIDATOR] ${status} for ${email} — retry ${attempt + 1}/${DEBOUNCE_MAX_RETRIES} in ${delay}ms`
      );
      await sleep(delay);
    }
  }

  // Unreachable in practice: the loop returns on both success and give-up.
  return { valid: true, rank: 0 };
}

/** Split a Debounce failure into "retry might help" vs "the request itself is wrong". */
function classifyDebounceError(err: any): { status: number | null; isAuthOrClientError: boolean } {
  const status: number | null = err?.response?.status ?? null;
  // 401/403 mean a bad API key — retrying just wastes the budget on every address in the batch.
  const isAuthOrClientError = status === 401 || status === 403;
  return { status, isAuthOrClientError };
}

/**
 * Filter to Debounce-safe emails and return them **best-first** so callers can use
 * `emails[0]` as the single best address. Ties preserve the input order (stable).
 */
export async function filterValidEmails(emails: string[], apiKey: string): Promise<string[]> {
  if (!emails.length) return [];
  // One deadline shared by every address, so a slow retry chain can't multiply across the batch.
  const deadline = Date.now() + DEBOUNCE_TOTAL_BUDGET_MS;
  const results = await Promise.all(
    emails.map(async (email, index) => ({
      email,
      index,
      ...(await validateEmail(email, apiKey, deadline)),
    }))
  );
  const valid = results
    .filter((r) => r.valid)
    .sort((a, b) => b.rank - a.rank || a.index - b.index) // best rank first; stable on ties
    .map((r) => r.email);
  const removed = emails.length - valid.length;
  if (removed > 0) {
    console.log(`📧 [EMAIL_VALIDATOR] Removed ${removed} invalid email(s) of ${emails.length}`);
  }
  return valid;
}
