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

/**
 * Decide whether a Google Address Validation result is "usable" — i.e. worth geocoding, pricing a
 * Zestimate for, and marking VALID. An address is usable only when the validation call returned a
 * result AND Google did not flag it as a partial/incomplete match
 * (`verdict.addressComplete === false`, surfaced as `isPartialMatch` by validateAddressWithGoogle).
 *
 * Kept as a pure, env-free predicate (no google.server import — that throws at load without the API
 * key) so the CSV upload Lambda and any client code share one definition of "valid address", and so
 * it can be unit-tested. `null`/`undefined` (e.g. the Google call threw) → not usable.
 *
 * Used by: amplify/functions/uploadCsvHandler/handler.ts (per-row property + admin address gate).
 */
export function isUsableAddress(
  v: { success?: boolean; isPartialMatch?: boolean } | null | undefined
): boolean {
  return !!v && v.success !== false && v.isPartialMatch !== true;
}

// Word-boundary patterns that mark a borrower/defendant name as a corporate/legal entity rather than
// an individual homeowner. County foreclosure files mix in LLCs, trusts, funds, banks, and
// redevelopment entities the user doesn't want to work; we flag them so they can be filtered out.
const ENTITY_PATTERNS: RegExp[] = [
  /\bl\.?l\.?c\.?\b/i,          // LLC / L.L.C.
  /\bl\.?l\.?p\.?\b/i,          // LLP
  /\bl\.?p\.?\b/i,              // LP
  /\binc\.?\b/i,                // Inc
  /\bcorp(oration)?\b/i,        // Corp / Corporation
  /\bco\.?\b/i,                 // Co.
  /\bcompany\b/i,
  /\btrust\b/i,
  /\btrustee\b/i,
  /\bfund\b/i,
  /\bbank\b/i,
  /\bn\.?a\.?\b/i,              // N.A. (national association)
  /\bassociation\b/i,
  /\bassociates\b/i,
  /\bpartners(hip)?\b/i,
  /\bproperties\b/i,
  /\bholdings?\b/i,
  /\bventures?\b/i,
  /\bgroup\b/i,
  /\brealty\b/i,
  /\bcapital\b/i,
  /\binvestments?\b/i,
  /\bservicing\b/i,
  /\bmortgage\b/i,
  /\burban renewal\b/i,
];

/**
 * True when a borrower/defendant name looks like a corporate or legal entity (LLC, trust, fund, bank,
 * etc.) rather than an individual. Used by the pre-foreclosure importer to tag `isEntityOwner` so the
 * dashboard can hide entity-owned properties by default.
 */
export function isEntityName(name: string | null | undefined): boolean {
  if (!name || typeof name !== 'string') return false;
  return ENTITY_PATTERNS.some((re) => re.test(name));
}

/**
 * True when a foreclosure case/docket number is flagged as a tax foreclosure (e.g. "F-07510-26
 * Tax_Fore"). Tax foreclosures usually mean little/no mortgage — free-and-clear, high-equity leads —
 * so the importer labels them and the dashboard can prioritize/filter them.
 */
export function isTaxForeclosureCase(caseNumber: string | null | undefined): boolean {
  if (!caseNumber || typeof caseNumber !== 'string') return false;
  return /tax[_\s-]?fore/i.test(caseNumber);
}

/**
 * Normalizes an address string for comparison (strips punctuation, standardizes street suffixes & directions).
 */
export function normalizeAddress(addr: string | undefined | null): string {
  if (!addr || typeof addr !== 'string') return '';
  return addr
    .toLowerCase()
    .replace(/[.,#\-]/g, ' ') // Strip punctuation (commas, periods, hashes, hyphens)
    .replace(/\b(city|town|borough|township|village)\s+of\s+/gi, '')
    // Normalize street suffixes
    .replace(/\bstreet\b/gi, 'st')
    .replace(/\bavenue\b/gi, 'ave')
    .replace(/\bboulevard\b/gi, 'blvd')
    .replace(/\bdrive\b/gi, 'dr')
    .replace(/\broad\b/gi, 'rd')
    .replace(/\blane\b/gi, 'ln')
    .replace(/\bcourt\b/gi, 'ct')
    .replace(/\bcircle\b/gi, 'cir')
    .replace(/\bplace\b/gi, 'pl')
    .replace(/\bterrace\b/gi, 'ter')
    .replace(/\bparkway\b/gi, 'pkwy')
    // Normalize directions
    .replace(/\bnorth\b/gi, 'n')
    .replace(/\bsouth\b/gi, 's')
    .replace(/\beast\b/gi, 'e')
    .replace(/\bwest\b/gi, 'w')
    // Normalize units
    .replace(/\bapartment\b/gi, 'apt')
    .replace(/\bsuite\b/gi, 'ste')
    .replace(/\bunit\b/gi, 'unit')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts leading numeric house number (e.g. "123", "123a", "464-466" -> "464").
 */
function extractHouseNumber(addr: string): string | null {
  const match = addr.match(/^(\d+[a-z]?)/i);
  return match ? match[1] : null;
}

/**
 * Compares Zillow/Bridge API address against the lead's owner address.
 * Robust against full address formats (street, city, state, zip vs street-only),
 * punctuation differences, and minor directional or unit variations.
 *
 * Returns true if the addresses match or if either is missing.
 * Returns false ONLY when there is a genuine house number or street mismatch.
 */
export function addressesMatch(
  zillowAddr: string | undefined | null,
  ownerAddr: string | undefined | null
): boolean {
  if (!zillowAddr || !ownerAddr) return true; // Missing data is not flagged as a mismatch

  const normZillowFull = normalizeAddress(zillowAddr);
  const normOwner = normalizeAddress(ownerAddr);

  if (!normZillowFull || !normOwner) return true;

  // 1. Exact normalized match
  if (normZillowFull === normOwner) return true;

  // 2. Extract street portion of zillowAddr (before first comma if present)
  const zillowStreetRaw = zillowAddr.split(',')[0];
  const normZillowStreet = normalizeAddress(zillowStreetRaw);

  if (normZillowStreet === normOwner) return true;

  // 3. House number check
  const zillowNum = extractHouseNumber(normZillowStreet) || extractHouseNumber(normZillowFull);
  const ownerNum = extractHouseNumber(normOwner);

  if (zillowNum && ownerNum && zillowNum.toLowerCase() !== ownerNum.toLowerCase()) {
    return false; // House numbers explicitly differ -> TRUE MISMATCH
  }

  // 4. Check prefix matching
  if (normZillowFull.startsWith(normOwner) || normOwner.startsWith(normZillowStreet)) {
    return true;
  }

  // 5. Token match: check if all owner street tokens are present in zillow address
  const ownerTokens = normOwner.split(' ').filter((t) => t.length > 0);
  const zillowTokens = normZillowFull.split(' ').filter((t) => t.length > 0);

  if (ownerTokens.length > 0) {
    const allOwnerTokensInZillow = ownerTokens.every((t) => zillowTokens.includes(t));
    if (allOwnerTokensInZillow) return true;
  }

  return false;
}

