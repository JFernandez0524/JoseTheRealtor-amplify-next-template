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
 * Cleans court/sheriff/auction scraped name artifacts:
 * - Strips leading non-alphanumeric punctuation (dots, dashes, bullets, semicolons, asterisks)
 * - Strips legal aliases: A/K/A, F/K/A, N/K/A, AKA, Also Known As, etc. keeping the primary name
 * - Strips court noise: ET AL, ET UX, ET VIR (and leading commas like ", et al") unless preserveCourtJoiners is true
 * - Strips trailing punctuation / noise (e.g. "; .", ";", ",", ".")
 */
export function cleanCourtScrapedName(
  name: string | null | undefined,
  options?: { preserveCourtJoiners?: boolean }
): string {
  if (!name || typeof name !== 'string') return '';
  let s = name.trim();

  // Strip leading non-alphanumeric characters (dots, dashes, bullets, asterisks, semicolons, quotes)
  s = s.replace(/^[\s.,;:*_\-/#\\|~`!@$%^&()+=<>[\]{}•"']+/g, '');

  // Strip legal aliases: a/k/a, f/k/a, n/k/a, aka, fka, nka, also known as, formerly known as, etc.
  // The primary debtor/owner is before the first alias clause
  s = s.replace(
    /\b(?:A[\/.]?K[\/.]?A|F[\/.]?K[\/.]?A|N[\/.]?K[\/.]?A|ALSO\s+KNOWN\s+AS|FORMERLY\s+KNOWN\s+AS|NOW\s+KNOWN\s+AS)\b.*$/i,
    ''
  );

  // Strip ET AL / ET UX / ET VIR clauses along with optional leading comma (e.g. ", et al")
  // unless preserveCourtJoiners is true (for multiple-individual classification)
  if (!options?.preserveCourtJoiners) {
    s = s.replace(/,?\s*\b(?:ET\s*AL(?:S)?|ET\s*UX|ET\s*VIR)\b/gi, '');
  }

  // Strip trailing punctuation / noise (e.g. "; .", ";", ",", ".")
  s = s.replace(/[\s.,;:*_\-/#\\|~`!@$%^&()+=<>[\]{}•"']+$/g, '');

  // Collapse internal whitespace
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Standardize capitalization across a full personal name string
 */
export function formatPersonalName(val: string | null | undefined): string {
  if (!val || typeof val !== 'string') return '';
  const trimmed = val
    .trim()
    .replace(/^[\s.,;:*_\-/#\\|~`!@$%^&()+=<>[\]{}•"']+/g, '');
  const s = trimmed.replace(/<[^>]*>?/gm, '').replace(/\0/g, '').trim().slice(0, 100);
  if (!s) return '';
  return s
    .split(/\s+/)
    .map((w) => {
      // Preserve single-letter middle initials like "A." or "E."
      if (/^[A-Za-z]\.$/.test(w)) return w.toUpperCase();
      const upper = w.toUpperCase().replace(/\./g, '');
      if (SUFFIXES.has(upper)) return upper;
      return capitalize(w);
    })
    .filter(Boolean)
    .join(' ');
}

/**
 * Universal parser for combined owner/defendant strings into first + last name.
 * Handles "LAST, FIRST", "FIRST MIDDLE LAST", multiple people joined by "&", "+", or "AND",
 * parentheticals, legal alias chains, court scraper noise, and deed abbreviations.
 */
export function parseOwnershipName(ownership: string | null | undefined): { firstName: string; lastName: string } {
  if (!ownership || typeof ownership !== 'string') return { firstName: '', lastName: '' };

  // 1. Clean court/auction scraper artifacts (legal aliases, leading dots/bullets, trailing punctuation)
  let cleaned = cleanCourtScrapedName(ownership);

  // 2. Strip parentheticals like (DECEASED), (DECEASED HUSBAND), (DEC), (WIFE), (HUSBAND), (), etc.
  cleaned = cleaned.replace(/\([^)]*\)/g, ' ');

  // 3. Normalize joiners (+ or AND -> &) and strip real estate deed noise
  cleaned = cleaned
    .replace(/\s*\+\s*/g, ' & ')
    .replace(/\bAND\b/gi, '&')
    .replace(/\bET\s*UX\b/gi, '')
    .replace(/\bET\s*VIR\b/gi, '')
    .replace(/\bET\s*AL(S)?\b/gi, '')
    .replace(/&\s*(WF|WIFE|HW|HUSBAND)\b/gi, '')
    .replace(/\b(WF|WIFE|HW|HUSBAND)\b/gi, '')
    .replace(/\b(ESTATE|TRUST|TRUSTEE|EXEC|EXECUTOR|C\/O|%)\b/gi, '')
    .replace(/^[\s.,;:*_\-/#\\|~`!@$%^&()+=<>[\]{}•"']+/g, '')
    .replace(/[\s.,;:*_\-/#\\|~`!@$%^&()+=<>[\]{}•"']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return { firstName: '', lastName: '' };

  // Format 1: "LAST, FIRST & SECOND" or "LAST, FIRST"
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const lastPart = parts[0];
      const firstPart = parts.slice(1).join(' ').trim();
      return { firstName: formatPersonalName(firstPart || ''), lastName: formatPersonalName(lastPart || '') };
    }
  }

  // Format 2: Multiple people joined by &
  if (cleaned.includes('&')) {
    const people = cleaned.split('&').map((p) => p.trim()).filter(Boolean);
    const firstNames: string[] = [];
    const lastNames: string[] = [];

    for (let i = 0; i < people.length; i++) {
      const person = people[i];
      if (person.includes(',')) {
        const parts = person.split(',').map((s) => s.trim());
        lastNames.push(formatPersonalName(parts[0]));
        firstNames.push(formatPersonalName(parts.slice(1).join(' ')));
      } else {
        const words = person.split(/\s+/).filter((w) => w.length > 0);
        if (words.length === 1) {
          if (i < people.length - 1) {
            firstNames.push(formatPersonalName(words[0]));
          } else {
            lastNames.push(formatPersonalName(words[0]));
          }
        } else {
          const suffixes = ['JR', 'SR', 'II', 'III', 'IV', 'V'];
          const lastWordRaw = words[words.length - 1].replace(/\./g, '');
          const lastWord = lastWordRaw.toUpperCase();

          const isMiddleInitial = lastWordRaw.length === 1 && i < people.length - 1;

          if (isMiddleInitial) {
            firstNames.push(words.map((w) => formatPersonalName(w)).join(' '));
          } else {
            const lastNameIndex = suffixes.includes(lastWord) ? words.length - 2 : words.length - 1;
            if (lastNameIndex <= 0) {
              firstNames.push(words.map((w) => formatPersonalName(w)).join(' '));
            } else {
              firstNames.push(words.slice(0, lastNameIndex).map((w) => formatPersonalName(w)).join(' '));
              lastNames.push(formatPersonalName(words[lastNameIndex]));
            }
          }
        }
      }
    }

    let finalFirst = firstNames.filter(Boolean).join(' & ');
    let finalLast = lastNames.filter(Boolean).join(' & ');

    if (!finalFirst && finalLast) {
      finalFirst = finalLast;
      finalLast = '';
    }

    return {
      firstName: finalFirst,
      lastName: finalLast,
    };
  }

  // Format 3: Single person "FIRST [MIDDLE...] LAST [SUFFIX]"
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return { firstName: '', lastName: '' };
  if (words.length === 1) return { firstName: '', lastName: formatPersonalName(words[0]) };

  const lastWord = words[words.length - 1].toUpperCase().replace(/\./g, '');
  let lastNameIndex = words.length - 1;
  if (SUFFIXES.has(lastWord)) lastNameIndex = words.length - 2;
  if (lastNameIndex <= 0) return { firstName: '', lastName: formatPersonalName(words[0]) };

  const firstName = words.slice(0, lastNameIndex).map((w) => formatPersonalName(w)).join(' ');
  const lastName = formatPersonalName(words[lastNameIndex]);
  return { firstName, lastName };
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

  // Normalize excessive internal whitespace and strip scraper bullets/artifacts/aliases
  let cleanName = cleanCourtScrapedName(rawName, { preserveCourtJoiners: true });

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
    const parsedNames = parseOwnershipName(cleanName);
    return {
      category: 'MULTIPLE_INDIVIDUALS',
      rawName,
      normalizedName: cleanCourtScrapedName(cleanName),
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
  // If no corporate, institutional, trust, or multiple indicators matched, parse as individual
  const parsedIndividual = parseOwnershipName(cleanName);
  if (parsedIndividual.firstName || parsedIndividual.lastName) {
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
