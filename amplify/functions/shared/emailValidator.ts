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

async function validateEmail(email: string, apiKey: string): Promise<boolean> {
  if (!EMAIL_REGEX.test(email)) return false;
  try {
    const { data } = await axios.get<DebounceResponse>('https://api.debounce.io/v1/', {
      params: { api: apiKey, email },
      timeout: 8000,
    });
    return data?.debounce?.send_transactional === '1';
  } catch (err: any) {
    console.warn(`⚠️ [EMAIL_VALIDATOR] API error for ${email}, keeping email (fail open):`, err.message);
    return true;
  }
}

export async function filterValidEmails(emails: string[], apiKey: string): Promise<string[]> {
  if (!emails.length) return [];
  const results = await Promise.all(
    emails.map(async (email) => ({ email, valid: await validateEmail(email, apiKey) }))
  );
  const valid = results.filter((r) => r.valid).map((r) => r.email);
  const removed = emails.length - valid.length;
  if (removed > 0) {
    console.log(`📧 [EMAIL_VALIDATOR] Removed ${removed} invalid email(s) of ${emails.length}`);
  }
  return valid;
}
