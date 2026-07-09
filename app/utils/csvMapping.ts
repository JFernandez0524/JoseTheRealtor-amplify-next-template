/**
 * CSV COLUMN MAPPING (shared client + Lambda)
 *
 * Lets any CSV layout be imported: the upload UI reads the file's header row, auto-detects a mapping
 * from each source column to a canonical field, the user confirms/adjusts it, and it is stored on the
 * CsvUploadJob (`columnMapping`). The uploadCsvHandler Lambda then resolves each canonical field
 * through that mapping (falling back to the legacy header aliases here when a job has no mapping).
 *
 * This module is the single source of truth for canonical fields, their header aliases, name parsing,
 * and entity detection — imported by both the browser (ManualLeadForm) and the Lambda. It is pure
 * (no AWS / Next imports) so it can be unit-tested.
 */
import { isEntityName } from './leadValidation';

export type LeadType = 'PREFORECLOSURE' | 'PROBATE';

export interface CanonicalField {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[]; // header variants that auto-map to this field (normalized before comparison)
}

// Owner name is offered as BOTH a combined column and a split pair — files vary. The user maps
// whichever their file has; required-ness is enforced as "full OR (first AND last)" in missingRequired.
const OWNER_NAME_FIELDS: CanonicalField[] = [
  { key: 'ownerFullName', label: 'Owner / Borrower Full Name', aliases: ['ownerFullName', 'owner name', 'ownername', 'borrower name', 'borrower or defendant name', 'borrower', 'defendant', 'ownership', 'owner'] },
  { key: 'ownerFirstName', label: 'Owner First Name', aliases: ['ownerFirstName', 'owner first name', 'first name', 'firstname'] },
  { key: 'ownerLastName', label: 'Owner Last Name', aliases: ['ownerLastName', 'owner last name', 'last name', 'lastname'] },
];

const PROPERTY_ADDRESS_FIELDS: CanonicalField[] = [
  { key: 'ownerAddress', label: 'Property Address', required: true, aliases: ['ownerAddress', 'property address', 'situs address', 'situs', 'address'] },
  { key: 'ownerCity', label: 'Property City', required: true, aliases: ['ownerCity', 'property city', 'situs city', 'municipality', 'municipali', 'city'] },
  { key: 'ownerState', label: 'Property State', required: true, aliases: ['ownerState', 'property state', 'situs state', 'state'] },
  { key: 'ownerZip', label: 'Property ZIP', required: true, aliases: ['ownerZip', 'property zip', 'situs zip', 'situs zif', 'postal code', 'postalcode', 'zip', 'zipcode'] },
];

const PHONE_FIELD: CanonicalField = { key: 'phone', label: 'Phone', aliases: ['phone', 'phone number', 'telephone', 'cell'] };

const PREFORECLOSURE_FIELDS: CanonicalField[] = [
  ...OWNER_NAME_FIELDS,
  ...PROPERTY_ADDRESS_FIELDS,
  { key: 'recordingDate', label: 'Recording / Filing Date', aliases: ['recordingDate', 'recording date', 'filing date', 'file date', 'nod date', 'date'] },
  { key: 'caseNumber', label: 'Case / Docket Number', aliases: ['caseNumber', 'case number', 'docket', 'docket_', 'case', 'file number'] },
  { key: 'lender', label: 'Lender / Plaintiff', aliases: ['lender', 'plaintiff', 'lender or plaintiff name', 'lender or plaintiff'] },
  { key: 'trustee', label: 'Trustee / Attorney', aliases: ['trustee', 'attorney', 'trustee or deputy name', 'deputy'] },
  { key: 'loanAmount', label: 'Loan / Mortgage Amount', aliases: ['loanAmount', 'loan amount', 'mortgage amount', 'mortgageam', 'amount'] },
  PHONE_FIELD,
  { key: 'estimatedValue', label: 'Estimated Value', aliases: ['estimatedValue', 'estimated value', 'est value', 'value'] },
];

const PROBATE_FIELDS: CanonicalField[] = [
  ...OWNER_NAME_FIELDS,
  ...PROPERTY_ADDRESS_FIELDS,
  { key: 'adminFullName', label: 'Administrator Full Name', aliases: ['adminFullName', 'admin name', 'administrator', 'administrator name', 'executor', 'executor name'] },
  { key: 'adminFirstName', label: 'Administrator First Name', aliases: ['adminFirstName', 'admin first name'] },
  { key: 'adminLastName', label: 'Administrator Last Name', aliases: ['adminLastName', 'admin last name'] },
  // Admin (executor) address is required for probate: dedup + skip-trace key off it.
  { key: 'adminAddress', label: 'Mailing / Admin Address', required: true, aliases: ['adminAddress', 'mailing address', 'admin address'] },
  { key: 'adminCity', label: 'Mailing / Admin City', required: true, aliases: ['adminCity', 'mailing city', 'admin city'] },
  { key: 'adminState', label: 'Mailing / Admin State', required: true, aliases: ['adminState', 'mailing state', 'admin state'] },
  { key: 'adminZip', label: 'Mailing / Admin ZIP', required: true, aliases: ['adminZip', 'mailing zip', 'admin zip'] },
  PHONE_FIELD,
];

/** Canonical fields to map for a given lead type (drives both the UI and validation). */
export function canonicalFields(leadType: LeadType): CanonicalField[] {
  return leadType === 'PROBATE' ? PROBATE_FIELDS : PREFORECLOSURE_FIELDS;
}

/** Normalize a header/alias for comparison: lowercase, drop everything but a–z0–9. */
const norm = (s: string): string => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Best-effort auto-mapping from a file's source headers to canonical field keys. Exact
 * (normalized) alias matches only — deterministic, no fuzzy guessing that could mis-map. Each source
 * header is used at most once; earlier fields win. Anything not matched is left for the user to map.
 */
export function autoDetectMapping(headers: string[], fields: CanonicalField[]): Record<string, string> {
  const normHeaders = headers.map((h) => ({ raw: h, n: norm(h) }));
  const used = new Set<string>();
  const mapping: Record<string, string> = {};
  for (const field of fields) {
    const aliasNorms = new Set(field.aliases.map(norm));
    const match = normHeaders.find((h) => !used.has(h.raw) && h.n.length > 0 && aliasNorms.has(h.n));
    if (match) {
      mapping[field.key] = match.raw;
      used.add(match.raw);
    }
  }
  return mapping;
}

/**
 * Which required fields are still unmapped. Owner name is special: it is satisfied by the combined
 * `ownerFullName` OR by both `ownerFirstName` and `ownerLastName` — returned as the token `ownerName`
 * when neither is provided. Other required fields (address/city/state/zip) are reported by key.
 */
export function missingRequired(mapping: Record<string, string>, fields: CanonicalField[]): string[] {
  const missing: string[] = [];
  for (const f of fields) {
    if (f.required && !mapping[f.key]) missing.push(f.key);
  }
  const hasOwnerName = !!mapping.ownerFullName || (!!mapping.ownerFirstName && !!mapping.ownerLastName);
  if (!hasOwnerName) missing.push('ownerName');
  // Probate (detected by the admin-name field being in the set): the executor is who we contact,
  // so require the admin name too, via the same either/or rule.
  if (fields.some((f) => f.key === 'adminFullName')) {
    const hasAdminName = !!mapping.adminFullName || (!!mapping.adminFirstName && !!mapping.adminLastName);
    if (!hasAdminName) missing.push('adminName');
  }
  return missing;
}

// ---- Name parsing (moved here so client + Lambda share one implementation) ----

/** Capitalize a single name token: first letter upper, rest lower; strips tags/control chars, caps 50. */
export function formatName(val: string | null | undefined): string {
  if (!val || typeof val !== 'string') return '';
  const s = val.replace(/<[^>]*>?/gm, '').replace(/\0/g, '').trim().slice(0, 50);
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Parse a combined owner/ownership string into first + last name. Handles "LAST, FIRST", "FIRST
 * MIDDLE LAST", multiple people joined by "&", and common suffixes. (Moved verbatim from the Lambda.)
 */
export function parseOwnershipName(ownership: string): { firstName: string; lastName: string } {
  if (!ownership) return { firstName: '', lastName: '' };

  const cleaned = ownership
    .replace(/\b(ESTATE|TRUST|TRUSTEE|EXEC|EXECUTOR|ETAL|ET AL|C\/O|%)\b/gi, '')
    .trim();

  if (!cleaned) return { firstName: '', lastName: '' };

  if (cleaned.includes('&')) {
    const people = cleaned.split('&').map((p) => p.trim());
    const firstNames: string[] = [];
    const lastNames: string[] = [];

    for (const person of people) {
      if (person.includes(',')) {
        const parts = person.split(',').map((s) => s.trim());
        lastNames.push(formatName(parts[0]));
        firstNames.push(formatName(parts.slice(1).join(' ')));
      } else {
        const words = person.split(/\s+/).filter((w) => w.length > 0);
        if (words.length === 1) {
          lastNames.push(formatName(words[0]));
        } else {
          const suffixes = ['JR', 'SR', 'II', 'III', 'IV', 'V'];
          const lastWord = words[words.length - 1].toUpperCase().replace(/\./g, '');
          const lastNameIndex = suffixes.includes(lastWord) ? words.length - 2 : words.length - 1;
          firstNames.push(words.slice(0, lastNameIndex).map((w) => formatName(w)).join(' '));
          lastNames.push(formatName(words[lastNameIndex]));
        }
      }
    }

    return {
      firstName: firstNames.filter((f) => f).join(' & '),
      lastName: lastNames.filter((l) => l).join(' & '),
    };
  }

  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map((s) => s.trim());
    const lastPart = parts[0];
    const firstPart = parts.slice(1).join(' ').trim();
    return { firstName: formatName(firstPart || ''), lastName: formatName(lastPart || '') };
  }

  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return { firstName: '', lastName: '' };
  if (words.length === 1) return { firstName: '', lastName: formatName(words[0]) };

  const lastWord = words[words.length - 1].toUpperCase().replace(/\./g, '');
  const suffixes = ['JR', 'SR', 'II', 'III', 'IV', 'V', 'ESQ', 'MD', 'PHD', 'DDS'];
  let lastNameIndex = words.length - 1;
  if (suffixes.includes(lastWord)) lastNameIndex = words.length - 2;
  if (lastNameIndex <= 0) return { firstName: '', lastName: formatName(words[0]) };

  const firstName = words.slice(0, lastNameIndex).map((w) => formatName(w)).join(' ');
  const lastName = formatName(words[lastNameIndex]);
  return { firstName, lastName };
}

/**
 * Resolve an owner/borrower (or admin) name from whichever columns the file provided — a combined
 * full-name column OR a split first/last pair — into first + last, flagging corporate/legal entities.
 * Entities keep their legal name intact (not split, not re-cased). One helper the Lambda uses for both
 * owner and admin names, so combined-vs-split handling lives in exactly one place.
 */
export function resolveOwnerName(input: {
  full?: string | null;
  first?: string | null;
  last?: string | null;
}): { firstName: string; lastName: string; isEntity: boolean } {
  const first = (input.first || '').trim();
  const last = (input.last || '').trim();
  const full = (input.full || '').trim();
  const effectiveFull = full || `${first} ${last}`.trim();

  if (effectiveFull && isEntityName(effectiveFull)) {
    return { firstName: '', lastName: effectiveFull.slice(0, 100), isEntity: true };
  }
  if (first || last) {
    return { firstName: formatName(first), lastName: formatName(last), isEntity: false };
  }
  const parsed = parseOwnershipName(full);
  return { firstName: parsed.firstName, lastName: parsed.lastName, isEntity: false };
}
