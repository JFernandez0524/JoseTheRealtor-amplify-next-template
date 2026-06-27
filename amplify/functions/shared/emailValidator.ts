/**
 * EMAIL VALIDATOR
 *
 * Validates email addresses via the Debounce.io API before outreach to protect
 * sender reputation and reduce bounce rates.
 *
 * BEHAVIOR:
 * - Rejects addresses that fail basic regex
 * - Calls Debounce.io; treats send_transactional === "1" as safe
 * - Fails open on API errors so transient outages don't silently drop contacts
 *
 * USED BY:
 * - amplify/functions/dailyEmailAgent — filters contact email lists before sending
 */
import axios from 'axios';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
