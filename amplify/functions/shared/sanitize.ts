/**
 * INPUT SANITIZATION UTILITIES
 */

export function sanitizeId(input: string): string {
  if (!input) return '';
  
  // Remove special characters, keep alphanumeric, underscore, hyphen
  const sanitized = input.replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Limit length to prevent DynamoDB key size issues
  return sanitized.substring(0, 255);
}

export function sanitizeEmail(email: string): string {
  if (!email) return '';
  
  // Basic email sanitization
  const sanitized = email.toLowerCase().trim();
  
  // Remove special chars except @ . + -
  return sanitized.replace(/[^a-z0-9@.+_-]/g, '');
}

export function sanitizePhone(phone: string): string {
  if (!phone) return '';

  // Keep only digits and +
  return phone.replace(/[^0-9+]/g, '');
}

export interface SkipTracePhone {
  type?: string;
  score?: string | number;
  dnc?: boolean;
  number?: string;
}

/**
 * Select and rank callable mobile numbers from a skip-trace (BatchData) result.
 *
 * Keeps only mobiles that score >= 90 and are not on the DNC list (same filter the
 * skip-trace handler used inline), then orders them **best-first by score** so the
 * caller's `phones[0]` is the highest-quality number — which becomes the GHL primary
 * phone contact the dialer/SMS uses. Ties preserve input order (stable).
 *
 * @param phoneNumbers raw `person.phoneNumbers` from the skip-trace response
 * @returns qualifying phone number strings, highest score first
 */
export function rankMobilePhones(phoneNumbers: SkipTracePhone[]): string[] {
  if (!Array.isArray(phoneNumbers)) return [];
  return phoneNumbers
    .map((p, index) => ({ p, index, score: parseFloat(String(p?.score)) || 0 }))
    .filter(({ p, score }) => p?.type === 'Mobile' && score >= 90 && !p?.dnc && !!p?.number)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ p }) => p.number as string);
}

/**
 * Select and rank callable **landline** numbers from a skip-trace result.
 *
 * A deliberate sibling of `rankMobilePhones` rather than a widening of it: the two return disjoint
 * sets, and callers store them in separate fields (`phones` vs `landlinePhones`) because a landline
 * can be called and mailed but cannot receive SMS. Keeping them apart means the SMS and AI-outreach
 * paths are structurally unable to pick up a landline, instead of relying on a check.
 *
 * Sampling the leads BatchData matched but that yielded no usable mobile, landlines outnumbered
 * mobiles roughly 3:1 and ~7 in 10 of those leads had a non-DNC landline — numbers already paid for
 * and previously discarded.
 *
 * **DNC is filtered unconditionally.** There is deliberately no `score >= 90` floor: that threshold
 * was tuned for mobile deliverability and would discard most landlines if applied unexamined.
 *
 * @param phoneNumbers raw `person.phoneNumbers` from the skip-trace response
 * @returns qualifying landline number strings, highest score first
 */
export function rankLandlinePhones(phoneNumbers: SkipTracePhone[]): string[] {
  if (!Array.isArray(phoneNumbers)) return [];
  return phoneNumbers
    .map((p, index) => ({ p, index, score: parseFloat(String(p?.score)) || 0 }))
    .filter(({ p }) => p?.type === 'Land Line' && !p?.dnc && !!p?.number)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ p }) => p.number as string);
}
