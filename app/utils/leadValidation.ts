/**
 * LEAD INPUT VALIDATION
 *
 * Shared by the manual lead form (client) and /api/v1/create-manual-lead (server)
 * so the two paths can never drift. Mirrors the normalization rules already used
 * by the CSV import Lambda (amplify/functions/uploadCsvHandler/handler.ts):
 *   - Names: letters + spaces only, capped at 50 chars
 *   - Phone: US numbers normalized to E.164 (+1XXXXXXXXXX), everything else rejected
 */

export const NAME_MAX = 50;

// Letters (A–Z, a–z) and spaces only. No digits, punctuation, or symbols.
export const NAME_PATTERN = /^[A-Za-z ]+$/;

/**
 * Strip everything except letters and spaces, collapse internal whitespace,
 * and cap at NAME_MAX. Intended for live input filtering — it does NOT trim
 * trailing spaces so the user can still type a space between names.
 */
export function sanitizeName(raw: string): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[^A-Za-z ]/g, '') // drop anything that isn't a letter or space
    .replace(/ {2,}/g, ' ')     // collapse runs of spaces
    .slice(0, NAME_MAX);
}

/**
 * Validate a name for submission: non-empty after trimming, letters/spaces only,
 * and within the length cap.
 */
export function isValidName(raw: string): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.length <= NAME_MAX && NAME_PATTERN.test(trimmed);
}

/**
 * Normalize a US phone number to E.164 (+1XXXXXXXXXX).
 * Returns null for anything that isn't a valid 10-digit (or 11-digit, leading 1)
 * US number. Empty / null input also returns null (phone is optional).
 */
export function formatPhoneE164(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/**
 * Live input filter for the phone field: keep digits and a single leading '+'.
 */
export function sanitizePhoneInput(raw: string): string {
  if (typeof raw !== 'string') return '';
  const hasLeadingPlus = raw.trim().startsWith('+');
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  return hasLeadingPlus ? `+${digits}` : digits;
}
