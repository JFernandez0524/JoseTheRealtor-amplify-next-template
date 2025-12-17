// amplify/functions/uploadCsvHandler/src/utils/sanitize.ts

/**
 * Sanitizes input strings to prevent XSS and malformed data.
 * 1. Trims whitespace
 * 2. Removes HTML/Script tags
 * 3. Limits length
 */
export function sanitizeString(val: any, maxLength: number = 255): string {
  if (typeof val !== 'string') return '';

  return val
    .trim()
    .replace(/<[^>]*>?/gm, '') // Remove HTML tags
    .substring(0, maxLength); // Prevent buffer/payload overloads
}

/**
 * Normalizes names to Title Case (e.g. "SCOTT" -> "Scott")
 */
export function formatName(val: any): string {
  const sanitized = sanitizeString(val, 50);
  if (!sanitized) return '';
  return sanitized.charAt(0).toUpperCase() + sanitized.slice(1).toLowerCase();
}
