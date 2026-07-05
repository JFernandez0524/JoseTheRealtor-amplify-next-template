/**
 * EMAIL VALIDATOR
 *
 * Validates email addresses via the Debounce.io API at INGEST to protect sender
 * reputation and reduce bounce rates.
 *
 * BEHAVIOR:
 * - Rejects addresses that fail basic regex (`isValidEmailSyntax`)
 * - Calls Debounce.io; treats send_transactional === "1" as safe
 * - Fails open on API errors so transient outages don't silently drop contacts
 *
 * USED BY:
 * - amplify/functions/skiptraceLeads — validates found emails before storing
 * - amplify/functions/manualGhlSync — validates emails before sync
 * - amplify/functions/dailyEmailAgent — uses `isValidEmailSyntax` as a cheap
 *   send-time guard (no API call); deliverability is already vetted at ingest
 */
import axios from 'axios';

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

async function validateEmail(email: string, apiKey: string): Promise<{ valid: boolean; rank: number }> {
  if (!EMAIL_REGEX.test(email)) return { valid: false, rank: -1 };
  try {
    const { data } = await axios.get<DebounceResponse>('https://api.debounce.io/v1/', {
      params: { api: apiKey, email },
      timeout: 8000,
    });
    return {
      valid: data?.debounce?.send_transactional === '1',
      rank: debounceQualityRank(data?.debounce?.result),
    };
  } catch (err: any) {
    console.warn(`⚠️ [EMAIL_VALIDATOR] API error for ${email}, keeping email (fail open):`, err.message);
    return { valid: true, rank: 0 };
  }
}

/**
 * Filter to Debounce-safe emails and return them **best-first** so callers can use
 * `emails[0]` as the single best address. Ties preserve the input order (stable).
 */
export async function filterValidEmails(emails: string[], apiKey: string): Promise<string[]> {
  if (!emails.length) return [];
  const results = await Promise.all(
    emails.map(async (email, index) => ({ email, index, ...(await validateEmail(email, apiKey)) }))
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
