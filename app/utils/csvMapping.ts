
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
import {
  classifyOwnership,
  cleanCourtScrapedName,
  formatPersonalName,
  parseOwnershipName,
  type OwnershipClassification,
} from '../../amplify/functions/shared/ownershipClassifier';

// Re-export universal shared name utilities for backwards compatibility
export { cleanCourtScrapedName, parseOwnershipName, formatPersonalName };
export const formatName = formatPersonalName;

export type LeadType =
  | 'PROBATE'
  | 'PREFORECLOSURE'
  | 'FSBO'
  | 'TAX_DELINQUENT'
  | 'DRIVING_FOR_DOLLARS'
  | 'VACANT'
  | 'OTHER';

export interface CanonicalField {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[]; // header variants that auto-map to this field (normalized before comparison)
}

// Owner name is offered as BOTH a combined column and a split pair — files vary. The user maps
// whichever their file has; required-ness is enforced as "full OR (first AND last)" in missingRequired.
const OWNER_NAME_FIELDS: CanonicalField[] = [
  {
    key: 'ownerFullName',
    label: 'Owner / Borrower Full Name',
    aliases: [
      'ownerFullName', 'owner name', 'ownername', 'borrower name',
      'borrower or defendant name', 'borrower', 'defendant', 'ownership', 'owner',
      'owner 1 full name', 'owner 1 name', 'owner1 full name', 'owner1 name',
      'owner 1 - full name', 'owner1fullname', 'owner1name',
      'firstname lastname', 'first name last name', 'defendant name',
    ],
  },
  {
    key: 'ownerFirstName',
    label: 'Owner First Name',
    aliases: [
      'ownerFirstName', 'owner first name', 'first name', 'firstname',
      'owner 1 first name', 'owner 1 first', 'owner1 first name', 'owner1 first',
      'owner1firstname', 'owner1first',
    ],
  },
  {
    key: 'ownerLastName',
    label: 'Owner Last Name',
    aliases: [
      'ownerLastName', 'owner last name', 'last name', 'lastname',
      'owner 1 last name', 'owner 1 last', 'owner1 last name', 'owner1 last',
      'owner1lastname', 'owner1last',
    ],
  },
];

const PROPERTY_ADDRESS_FIELDS: CanonicalField[] = [
  {
    key: 'ownerAddress',
    label: 'Property Address',
    required: true,
    aliases: [
      'ownerAddress', 'property address', 'situs address', 'situs', 'address',
      'property street address', 'street address', 'prop address',
    ],
  },
  {
    key: 'ownerCity',
    label: 'Property City',
    required: true,
    aliases: [
      'ownerCity', 'property city', 'situs city', 'municipality', 'municipali', 'city', 'prop city',
    ],
  },
  {
    key: 'ownerCounty',
    label: 'Property County',
    required: false,
    aliases: [
      'ownerCounty', 'property county', 'situs county', 'county', 'prop county',
    ],
  },
  {
    key: 'ownerState',
    label: 'Property State',
    required: true,
    aliases: [
      'ownerState', 'property state', 'situs state', 'state', 'prop state',
    ],
  },
  {
    key: 'ownerZip',
    label: 'Property ZIP',
    required: true,
    aliases: [
      'ownerZip', 'property zip', 'situs zip', 'situs zif', 'postal code',
      'postalcode', 'zip', 'zipcode', 'zip code', 'prop zip',
    ],
  },
];

const PARCEL_ID_FIELD: CanonicalField = {
  key: 'parcelId',
  label: 'Parcel ID / APN / Block & Lot',
  aliases: [
    'parcelId', 'parcel id', 'parcel-id-no', 'parcel id no', 'parcel',
    'apn', 'block text lot text', 'blocktext-lottext', 'block lot', 'pin',
  ],
};

const PHONE_FIELD: CanonicalField = {
  key: 'phone',
  label: 'Phone',
  aliases: [
    'phone', 'phone number', 'telephone', 'cell', 'mobile',
    'phone 1', 'phone1', 'owner 1 phone', 'owner1phone',
  ],
};

const ESTIMATED_VALUE_FIELD: CanonicalField = {
  key: 'estimatedValue',
  label: 'Estimated Value',
  aliases: [
    'estimatedValue', 'estimated value', 'est value', 'est. value',
    'estimated equity', 'value', 'assessed value', 'prop value',
  ],
};

const PREFORECLOSURE_FIELDS: CanonicalField[] = [
  ...OWNER_NAME_FIELDS,
  ...PROPERTY_ADDRESS_FIELDS,
  {
    key: 'recordingDate',
    label: 'Recording / Filing Date',
    aliases: [
      'recordingDate', 'recording date', 'filing date', 'file date',
      'nod date', 'date', 'pre foreclosure recording date', 'preforeclosure recording date',
    ],
  },
  {
    key: 'caseNumber',
    label: 'Case / Docket Number',
    aliases: [
      'caseNumber', 'case number', 'docket', 'docket_', 'case',
      'file number', 'document number', 'doc number',
    ],
  },
  {
    key: 'lender',
    label: 'Lender / Plaintiff',
    aliases: [
      'lender', 'plaintiff', 'lender or plaintiff name', 'lender or plaintiff', 'lender name',
    ],
  },
  { key: 'trustee', label: 'Trustee / Attorney', aliases: ['trustee', 'attorney', 'trustee or deputy name', 'deputy'] },
  {
    key: 'loanAmount',
    label: 'Loan / Mortgage Amount',
    aliases: [
      'loanAmount', 'loan amount', 'mortgage amount', 'mortgageam', 'amount',
      'open loan balance', 'loan balance',
    ],
  },
  PARCEL_ID_FIELD,
  PHONE_FIELD,
  ESTIMATED_VALUE_FIELD,
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

/** Standard fields for non-probate lead types (FSBO, Tax Delinquent, Driving for Dollars, Vacant, Other). */
const STANDARD_PROPERTY_FIELDS: CanonicalField[] = [
  ...OWNER_NAME_FIELDS,
  ...PROPERTY_ADDRESS_FIELDS,
  PHONE_FIELD,
  ESTIMATED_VALUE_FIELD,
];

/** Canonical fields to map for a given lead type (drives both the UI and validation). */
export function canonicalFields(leadType: LeadType): CanonicalField[] {
  if (leadType === 'PROBATE') return PROBATE_FIELDS;
  if (leadType === 'PREFORECLOSURE') return PREFORECLOSURE_FIELDS;
  return STANDARD_PROPERTY_FIELDS;
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

/**
 * Normalize a CsvUploadJob.columnMapping value read back from DynamoDB into a mapping, or undefined.
 * The upload form writes the mapping through an AWSJSON field as a JSON string (see asJson in
 * app/utils/batchdata/enrichment.ts), but depending on how AppSync persisted it the raw item value
 * may be either that string or an already-parsed object — accept both. Called by uploadCsvHandler.
 */
export function parseColumnMapping(raw: unknown): Record<string, string> | undefined {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, string>;
  }
  return undefined;
}

// ---- Name parsing (delegated to universal ownershipClassifier library) ----

export interface ResolvedOwnerName {
  firstName: string;
  lastName: string;
  isEntity: boolean;
}

export interface ResolvedOwnerWithClassification extends ResolvedOwnerName {
  classification: OwnershipClassification;
}

/**
 * Resolve an owner/borrower (or admin) name with full classification metadata.
 */
export function resolveOwnerNameWithClassification(input: {
  full?: string | null;
  first?: string | null;
  last?: string | null;
}): ResolvedOwnerWithClassification {
  const first = cleanCourtScrapedName(input.first || '');
  const last = cleanCourtScrapedName(input.last || '');
  const full = cleanCourtScrapedName(input.full || '');
  const effectiveFull = full || `${first} ${last}`.trim();

  const classification = classifyOwnership(effectiveFull);
  const isEntity = [
    'LLC',
    'CORPORATION',
    'INSTITUTIONAL',
    'TRUST',
    'ESTATE',
    'OTHER_ENTITY',
  ].includes(classification.category) || isEntityName(effectiveFull);

  if (isEntity) {
    return {
      firstName: '',
      lastName: effectiveFull.slice(0, 100),
      isEntity: true,
      classification,
    };
  }

  if (first || last) {
    return {
      firstName: formatName(first),
      lastName: formatName(last),
      isEntity: false,
      classification,
    };
  }

  const parsed = parseOwnershipName(full);
  return {
    firstName: parsed.firstName || classification.suggestedFirstName,
    lastName: parsed.lastName || classification.suggestedLastName,
    isEntity: false,
    classification,
  };
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
}): ResolvedOwnerName {
  const res = resolveOwnerNameWithClassification(input);
  return {
    firstName: res.firstName,
    lastName: res.lastName,
    isEntity: res.isEntity,
  };
}

/**
 * Check if a CSV row is empty or contains only delimiters/whitespace.
 */
export function isEmptyCsvRow(row: Record<string, any> | string[] | null | undefined): boolean {
  if (!row) return true;
  if (Array.isArray(row)) {
    return row.every((c) => !c || !String(c).trim());
  }
  return Object.values(row).every((val) => val == null || !String(val).trim());
}

const COMMON_HEADER_TOKENS = new Set([
  'docket', 'docket_', 'date', 'mortgageam', 'amount', 'firstnamelastname', 'firstname', 'lastname',
  'lender', 'attorney', 'trustee', 'address', 'municipali', 'municipality', 'city', 'county', 'state',
  'postalcode', 'zip', 'blocktextlottext', 'parcel', 'case', 'plaintiff', 'defendant', 'casenumber',
  'recordingdate', 'loanamount', 'situsaddress', 'situscity', 'situscounty', 'situsstate', 'situszip',
]);

/**
 * Check if a parsed row is an alternate/sub-header row (e.g. database column abbreviations).
 */
export function isSubHeaderRow(row: Record<string, any>): boolean {
  if (!row || typeof row !== 'object') return false;
  const values = Object.values(row).map((v) => norm(String(v)));
  const matched = values.filter((v) => v && COMMON_HEADER_TOKENS.has(v)).length;
  // If 3 or more cells match common database column abbreviations, it is a sub-header row.
  return matched >= 3;
}

/**
 * Filter an array of parsed CSV rows, pruning empty rows and secondary header rows.
 */
export function cleanCsvRows<T extends Record<string, any>>(rows: T[]): T[] {
  return rows.filter((row) => !isEmptyCsvRow(row) && !isSubHeaderRow(row));
}

/**
 * Escape a string or value for standard RFC-4180 CSV serialization.
 */
export function escapeCsvCell(val: any): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serialize an array of row objects back to a clean CSV string with the given headers.
 */
export function serializeRowsToCsv(headers: string[], rows: Record<string, any>[]): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const rowLines = rows.map((row) =>
    headers.map((h) => escapeCsvCell(row[h])).join(',')
  );
  return [headerLine, ...rowLines].join('\n');
}


