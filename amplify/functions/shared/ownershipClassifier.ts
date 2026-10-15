/**
 * UNIVERSAL PROPERTY LEAD OWNERSHIP CLASSIFIER
 *
 * Classifies property ownership records into deterministic categories:
 *   - INDIVIDUAL
 *   - MULTIPLE_INDIVIDUALS
 *   - ESTATE
 *   - TRUST
 *   - LLC
 *   - CORPORATION
 *   - INSTITUTIONAL
 *   - OTHER_ENTITY
 *   - UNKNOWN
 *
 * Designed to be pure TypeScript with zero Node/AWS dependencies so it can execute
 * in the browser (instant upload preview & filtering), server routes, and Lambda functions.
 *
 * Protects against common token collision traps:
 *   - "Ryan Banks" (individual whose surname is Banks, not a financial institution)
 *   - "Lincoln Williams" (individual whose name contains 'inc')
 *   - "Stephen Tolpa" (individual whose name contains 'lp')
 *   - Religious / Non-profit entities (classified under OTHER_ENTITY)
 */

export type OwnershipCategory =
  | 'INDIVIDUAL'
  | 'MULTIPLE_INDIVIDUALS'
  | 'ESTATE'
  | 'TRUST'
  | 'LLC'
  | 'CORPORATION'
  | 'INSTITUTIONAL'
  | 'OTHER_ENTITY'
  | 'UNKNOWN';

export type OwnershipVerificationStatus = 'PENDING' | 'VERIFIED' | 'FLAGGED';

export interface OwnershipClassification {
  category: OwnershipCategory;
  rawName: string;
  normalizedName: string;
  sourceFieldUsed?: string;
  classificationMethod: 'DETERMINISTIC_RULES' | 'MANUAL_OVERRIDE';
  confidence: number; // 0.0 - 1.0
  verificationStatus: OwnershipVerificationStatus;
  evidence: string[];
  requiresManualReview: boolean;
  suggestedFirstName: string;
  suggestedLastName: string;
}

// Common personal name suffixes
const SUFFIXES = new Set(['JR', 'SR', 'II', 'III', 'IV', 'V', 'ESQ', 'MD', 'PHD', 'DDS', 'DVM']);

// Clean and capitalize a name token
function capitalize(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Standardize capitalization across a full personal name string
 */
export function formatPersonalName(val: string): string {
  if (!val) return '';
  return val
    .trim()
    .split(/\s+/)
    .map((w) => {
      const upper = w.toUpperCase().replace(/\./g, '');
      if (SUFFIXES.has(upper)) return upper;
      return capitalize(w);
    })
    .join(' ');
}

// Strict word-boundary patterns for legal and organizational entities
const LLC_PATTERNS = [
  /\bL\.?L\.?C\.?\b/i,
  /\bLIMITED\s+LIABILITY\s+(CO|COMPANY)\b/i,
  /\bL\.?L\.?P\.?\b/i,
  /\bLIMITED\s+LIABILITY\s+PARTNERSHIP\b/i,
];

const CORP_PATTERNS = [
  /\bINC\.?(?=\s|$|,)/i,
  /\bINCORPORATED\b/i,
  /\bCORP\.?(?=\s|$|,)/i,
  /\bCORPORATION\b/i,
  /\bP\.?C\.?\b/i, // Professional Corporation
  /\bP\.?A\.?\b/i, // Professional Association
];

const ESTATE_PATTERNS = [
  /\bESTATE\s+OF\b/i,
  /\bESTATE\b/i,
  /\bEST\.\s+OF\b/i,
  /\bDEC(')?D\b/i,
  /\bDECEASED\b/i,
  /\bHEIR(S)?(\s+OF)?\b/i,
  /\bDEVISEE(S)?\b/i,
  /\bEXECUT(OR|RIX)\b/i,
  /\bADMINISTRAT(OR|RIX)\b/i,
];

const TRUST_PATTERNS = [
  /\bLIVING\s+TRUST\b/i,
  /\bREVOCABLE\s+TRUST\b/i,
  /\bIRREVOCABLE\s+TRUST\b/i,
  /\bFAMILY\s+TRUST\b/i,
  /\bREALTY\s+TRUST\b/i,
  /\bLAND\s+TRUST\b/i,
  /\bNOMINEE\s+TRUST\b/i,
  /\bDECLARATION\s+OF\s+TRUST\b/i,
  /\bTRUST\b/i,
  /\bTRUSTEE(S)?\b/i,
];

const INSTITUTIONAL_PATTERNS = [
  /\bSECRETARY\s+OF\s+(HOUSING|VETERANS|HUD|VA)\b/i,
  /\bHOUSING\s+AND\s+URBAN\s+DEVELOPMENT\b/i,
  /\bHUD\b/i,
  /\bFANNIE\s+MAE\b/i,
  /\bFREDDIE\s+MAC\b/i,
  /\bFEDERAL\s+NATIONAL\s+MORTGAGE\b/i,
  /\bFEDERAL\s+HOME\s+LOAN\b/i,
  /\bHOUSING\s+AUTHORITY\b/i,
  /\bREDEVELOPMENT\s+AGENCY\b/i,
  /\bREDEVELOPMENT\s+AUTHORITY\b/i,
  /\bUNITED\s+STATES\s+OF\s+AMERICA\b/i,
  /\bSTATE\s+OF\s+[A-Z]{2,}\b/i,
  /\bCITY\s+OF\s+[A-Z]{2,}\b/i,
  /\bTOWNSHIP\s+OF\s+[A-Z]{2,}\b/i,
  /\bBOROUGH\s+OF\s+[A-Z]{2,}\b/i,
  /\bCOUNTY\s+OF\s+[A-Z]{2,}\b/i,
  /\bDEPARTMENT\s+OF\s+VETERANS\s+AFFAIRS\b/i,
  // Bank as titled owner/defendant (strict: requires 'Bank of', 'National Bank', etc. to avoid Ryan Banks collision)
  /\bBANK\s+OF\s+[A-Z]+/i,
  /\b[A-Z]+\s+NATIONAL\s+BANK\b/i,
  /\b[A-Z]+\s+SAVINGS\s+BANK\b/i,
  /\b[A-Z]+\s+STATE\s+BANK\b/i,
  /\b[A-Z]+\s+CREDIT\s+UNION\b/i,
  /\bFEDERAL\s+CREDIT\s+UNION\b/i,
  /\bWELLS\s+FARGO\b/i,
  /\bCITIBANK\b/i,
  /\bDEUTSCHE\s+BANK\b/i,
  /\bUS\s+BANK(\s+TRUST)?\b/i,
  /\bMIDFIRST\s+BANK\b/i,
  /\bTD\s+BANK\b/i,
];

const OTHER_ENTITY_PATTERNS = [
  /\bCHURCH\b/i,
  /\bMINISTR(Y|IES)\b/i,
  /\bPARISH\b/i,
  /\bTEMPLE\b/i,
  /\bSYNAGOGUE\b/i,
  /\bMOSQUE\b/i,
  /\bCONGREGATION\b/i,
  /\bDIOCESE\b/i,
  /\bHOLDINGS\b/i,
  /\bVENTURES\b/i,
  /\bPROPERTIES\b/i,
  /\bENTERPRISES\b/i,
  /\bCAPITAL\b/i,
  /\bINVESTMENTS?\b/i,
  /\bREDEVELOPMENT\b/i,
  /\bREALTY\b/i,
  /\bHOMES\s+LLC\b/i,
  /\bASSOCIATES\b/i,
  /\bASSOCIATION\b/i,
  /\bPARTNERS(HIP)?\b/i,
  /\bFOUNDATION\b/i,
  /\bCO\.(?=\s|$|,)/i,
  /\bCOMPANY\b/i,
  /\bFUND\b/i,
];

/**
 * Classify a property owner, borrower, or defendant name into a verified or pending category.
 */
export function classifyOwnership(
  rawNameInput: string | null | undefined,
  options?: { sourceField?: string }
): OwnershipClassification {
  const rawName = (rawNameInput || '').trim();
  const sourceFieldUsed = options?.sourceField;

  // 1. Guard against empty / blank names
  if (!rawName) {
    return {
      category: 'UNKNOWN',
      rawName: '',
      normalizedName: '',
      sourceFieldUsed,
      classificationMethod: 'DETERMINISTIC_RULES',
      confidence: 0.0,
      verificationStatus: 'FLAGGED',
      evidence: ['Name is empty or missing'],
      requiresManualReview: true,
      suggestedFirstName: '',
      suggestedLastName: '',
    };
  }

  // Normalize excessive internal whitespace
  let cleanName = rawName.replace(/\s+/g, ' ').trim();

  // Strip obvious noise prefixes/suffixes while capturing clues
  const evidence: string[] = [];
  const hasParenthetical = /\([^)]*\)/.test(cleanName);
  let parentheticalText = '';
  if (hasParenthetical) {
    const match = cleanName.match(/\(([^)]*)\)/);
    parentheticalText = match ? match[1].toUpperCase() : '';
  }

  // --- 2. ESTATE DETECTION ---
  for (const pat of ESTATE_PATTERNS) {
    if (pat.test(cleanName) || pat.test(parentheticalText)) {
      evidence.push(`Matched estate indicator: ${pat.source}`);
      return {
        category: 'ESTATE',
        rawName,
        normalizedName: cleanName,
        sourceFieldUsed,
        classificationMethod: 'DETERMINISTIC_RULES',
        confidence: 0.95,
        verificationStatus: 'PENDING',
        evidence,
        requiresManualReview: false,
        suggestedFirstName: '',
        suggestedLastName: formatPersonalName(cleanName),
      };
    }
  }

  // --- 3. TRUST DETECTION ---
  for (const pat of TRUST_PATTERNS) {
    if (pat.test(cleanName)) {
      evidence.push(`Matched trust indicator: ${pat.source}`);
      return {
        category: 'TRUST',
        rawName,
        normalizedName: cleanName,
        sourceFieldUsed,
        classificationMethod: 'DETERMINISTIC_RULES',
        confidence: 0.95,
        verificationStatus: 'PENDING',
        evidence,
        requiresManualReview: false,
        suggestedFirstName: '',
        suggestedLastName: cleanName,
      };
    }
  }

  // --- 4. LLC DETECTION ---
  for (const pat of LLC_PATTERNS) {
    if (pat.test(cleanName)) {
      evidence.push(`Matched LLC designation: ${pat.source}`);
      return {
        category: 'LLC',
        rawName,
        normalizedName: cleanName,
        sourceFieldUsed,
        classificationMethod: 'DETERMINISTIC_RULES',
        confidence: 0.98,
        verificationStatus: 'PENDING',
        evidence,
        requiresManualReview: false,
        suggestedFirstName: '',
        suggestedLastName: cleanName,
      };
    }
  }

  // --- 5. CORPORATION DETECTION ---
  for (const pat of CORP_PATTERNS) {
    if (pat.test(cleanName)) {
      evidence.push(`Matched corporate designation: ${pat.source}`);
      return {
        category: 'CORPORATION',
        rawName,
        normalizedName: cleanName,
        sourceFieldUsed,
        classificationMethod: 'DETERMINISTIC_RULES',
        confidence: 0.96,
        verificationStatus: 'PENDING',
        evidence,
        requiresManualReview: false,
        suggestedFirstName: '',
        suggestedLastName: cleanName,
      };
    }
  }

  // --- 6. INSTITUTIONAL DETECTION (Banks / Govt / Authorities) ---
  for (const pat of INSTITUTIONAL_PATTERNS) {
    if (pat.test(cleanName)) {
      evidence.push(`Matched institutional entity: ${pat.source}`);
      return {
        category: 'INSTITUTIONAL',
        rawName,
        normalizedName: cleanName,
        sourceFieldUsed,
        classificationMethod: 'DETERMINISTIC_RULES',
        confidence: 0.92,
        verificationStatus: 'PENDING',
        evidence,
        requiresManualReview: true, // Institutional defendants often require review
        suggestedFirstName: '',
        suggestedLastName: cleanName,
      };
    }
  }

  // --- 7. OTHER ENTITY (Churches, Non-profits, Investment Funds, Holdings) ---
  for (const pat of OTHER_ENTITY_PATTERNS) {
    if (pat.test(cleanName)) {
      evidence.push(`Matched organizational / entity keyword: ${pat.source}`);
      return {
        category: 'OTHER_ENTITY',
        rawName,
        normalizedName: cleanName,
        sourceFieldUsed,
        classificationMethod: 'DETERMINISTIC_RULES',
        confidence: 0.90,
        verificationStatus: 'PENDING',
        evidence,
        requiresManualReview: false,
        suggestedFirstName: '',
        suggestedLastName: cleanName,
      };
    }
  }

  // --- 8. MULTIPLE INDIVIDUALS DETECTION ---
  // Look for joined names: "John & Mary Smith", "John Smith and Jane Doe", "Smith, John & Mary", "ET UX", "ET VIR", "ET AL"
  const multiJoinerPattern = /(\s+&\s+|\s+AND\s+|\s*\+\s*|\bET\s*UX\b|\bET\s*VIR\b|\bET\s*AL\b)/i;
  if (multiJoinerPattern.test(cleanName)) {
    evidence.push('Matched multiple individuals joiner (&, and, +, et ux, et vir, et al)');
    
    // Parse combined first and last names
    const parsedNames = parseMultipleIndividualNames(cleanName);
    return {
      category: 'MULTIPLE_INDIVIDUALS',
      rawName,
      normalizedName: cleanName,
      sourceFieldUsed,
      classificationMethod: 'DETERMINISTIC_RULES',
      confidence: 0.92,
      verificationStatus: 'PENDING',
      evidence,
      requiresManualReview: false,
      suggestedFirstName: parsedNames.firstName,
      suggestedLastName: parsedNames.lastName,
    };
  }

  // --- 9. INDIVIDUAL DETECTION ---
  // If no corporate, institutional, trust, or multiple indicators matched, parse as single individual
  const parsedIndividual = parseSingleIndividualName(cleanName);
  if (parsedIndividual.isValid) {
    evidence.push('Standard personal name format (First + Last, or Last, First)');
    return {
      category: 'INDIVIDUAL',
      rawName,
      normalizedName: `${parsedIndividual.firstName} ${parsedIndividual.lastName}`.trim(),
      sourceFieldUsed,
      classificationMethod: 'DETERMINISTIC_RULES',
      confidence: 0.95,
      verificationStatus: 'PENDING',
      evidence,
      requiresManualReview: false,
      suggestedFirstName: parsedIndividual.firstName,
      suggestedLastName: parsedIndividual.lastName,
    };
  }

  // --- 10. UNKNOWN / AMBIGUOUS ---
  evidence.push('Unrecognized name structure or ambiguous tokens');
  return {
    category: 'UNKNOWN',
    rawName,
    normalizedName: cleanName,
    sourceFieldUsed,
    classificationMethod: 'DETERMINISTIC_RULES',
    confidence: 0.30,
    verificationStatus: 'FLAGGED',
    evidence,
    requiresManualReview: true,
    suggestedFirstName: '',
    suggestedLastName: cleanName,
  };
}

/**
 * Helper to parse a single individual's name (supports "First Last", "Last, First", suffixes, middle initials)
 */
function parseSingleIndividualName(nameStr: string): { firstName: string; lastName: string; isValid: boolean } {
  // Strip parentheticals like (DECEASED), (WIFE), etc.
  let cleaned = nameStr.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return { firstName: '', lastName: '', isValid: false };

  // Format 1: "LAST, FIRST MIDDLE"
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map((p) => p.trim());
    if (parts.length >= 2) {
      const lastName = formatPersonalName(parts[0]);
      const firstName = formatPersonalName(parts.slice(1).join(' '));
      return { firstName, lastName, isValid: Boolean(lastName && firstName) };
    }
  }

  // Format 2: "FIRST MIDDLE LAST [SUFFIX]"
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: '', lastName: '', isValid: false };
  if (words.length === 1) {
    // Single word name (unusual, but can be a last name)
    return { firstName: '', lastName: formatPersonalName(words[0]), isValid: true };
  }

  const lastWordUpper = words[words.length - 1].toUpperCase().replace(/\./g, '');
  let lastNameIdx = words.length - 1;

  if (SUFFIXES.has(lastWordUpper) && words.length > 2) {
    lastNameIdx = words.length - 2;
  }

  const firstName = words.slice(0, lastNameIdx).map(formatPersonalName).join(' ');
  const lastName = formatPersonalName(words[lastNameIdx]);

  return { firstName, lastName, isValid: Boolean(firstName && lastName) };
}

/**
 * Helper to parse multiple individuals (e.g. "John & Mary Smith", "John Smith and Jane Doe", "Smith, John & Mary")
 */
function parseMultipleIndividualNames(nameStr: string): { firstName: string; lastName: string } {
  // Strip deed noise
  let cleaned = nameStr
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(ET\s*UX|ET\s*VIR|ET\s*AL(S)?|WIFE|HUSBAND|HW|WF)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If "Smith, John & Mary"
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map((p) => p.trim());
    const lastName = formatPersonalName(parts[0]);
    const firstNames = formatPersonalName(parts.slice(1).join(' '));
    return { firstName: firstNames, lastName };
  }

  // If "John & Mary Smith"
  const normalizedJoiner = cleaned.replace(/\s+AND\s+/gi, ' & ').replace(/\s*\+\s*/g, ' & ');
  const parts = normalizedJoiner.split(' & ').map((p) => p.trim()).filter(Boolean);

  if (parts.length === 2) {
    const firstPersonWords = parts[0].split(/\s+/).filter(Boolean);
    const secondPersonWords = parts[1].split(/\s+/).filter(Boolean);

    // If first person has only 1 word (e.g. "John" in "John & Mary Smith")
    if (firstPersonWords.length === 1 && secondPersonWords.length >= 2) {
      const sharedLastName = formatPersonalName(secondPersonWords[secondPersonWords.length - 1]);
      const firstNames = `${formatPersonalName(firstPersonWords[0])} & ${secondPersonWords.slice(0, -1).map(formatPersonalName).join(' ')}`;
      return { firstName: firstNames, lastName: sharedLastName };
    }
  }

  return {
    firstName: formatPersonalName(parts[0] || ''),
    lastName: formatPersonalName(parts.slice(1).join(' & ')),
  };
}
