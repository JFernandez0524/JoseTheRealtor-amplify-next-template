/**
 * UNIVERSAL PROPERTY LEAD FORECLOSURE CLASSIFIER
 *
 * Classifies foreclosure records into distinct categories:
 *   - MORTGAGE_FORECLOSURE
 *   - TAX_FORECLOSURE
 *   - OTHER_FORECLOSURE (e.g. Condo / HOA Assessment Liens, Mechanic Liens)
 *   - UNKNOWN
 *
 * Designed to be pure TypeScript with zero Node/AWS dependencies so it can execute
 * in the browser (instant upload preview & filtering), server routes, and Lambda functions.
 *
 * Rules:
 *   - Distinguishes tax foreclosure records from mortgage foreclosure records.
 *   - Municipality as plaintiff is an indicator, but not conclusive on its own without supporting
 *     evidence (marked UNKNOWN / flagged for manual review if ambiguous).
 *   - Captures evidence trail and classification confidence.
 */

export type ForeclosureCategory =
  | 'MORTGAGE_FORECLOSURE'
  | 'TAX_FORECLOSURE'
  | 'OTHER_FORECLOSURE'
  | 'UNKNOWN';

export interface ForeclosureClassificationInput {
  caseNumber?: string | null;
  plaintiff?: string | null;
  trustee?: string | null;
  documentType?: string | null;
  filingDescription?: string | null;
  loanAmount?: number | string | null;
}

export interface ForeclosureClassification {
  category: ForeclosureCategory;
  confidence: number; // 0.0 - 1.0
  evidence: string[];
  requiresManualReview: boolean;
  classificationMethod: 'DETERMINISTIC_RULES' | 'MANUAL_OVERRIDE';
}

// Explicit tax foreclosure keywords (in case number, doc type, or filing description)
const EXPLICIT_TAX_PATTERNS = [
  /\bTAX[_\s-]?FORE(CLOSURE)?\b/i,
  /\bTAX\s+LIEN\s+FORECLOSURE\b/i,
  /\bTAX\s+LIEN\b/i,
  /\bIN\s+REM(\s+TAX)?(\s+FORECLOSURE)?\b/i,
  /\bTAX\s+SALE(\s+CERT(IFICATE)?)?\b/i,
  /\bFORECLOSURE\s+OF\s+TAX\s+SALE\b/i,
  /\bMUNICIPAL\s+TAX\s+LIEN\b/i,
  /\bTAX\s+CERT(IFICATE)?\b/i,
];

// Private tax lien investment funds / buyers commonly appearing as plaintiffs
const TAX_LIEN_BUYER_PATTERNS = [
  /\bSBMUNI\b/i,
  /\bMUNI\b/i,
  /\bTAX\s+LIEN\b/i,
  /\bHONEY\s+BADGER\b/i,
  /\bTRYSTONE\s+CAPITAL\b/i,
  /\bKHH\s+INVEST\b/i,
  /\bRE\s+OWN\s+REAL\s+ESTATE\b/i,
  /\bCAPITAL\s+ASSETS\b/i,
  /\bLIEN\s+HOLDINGS\b/i,
  /\bTAX\s+ASSET(S)?\b/i,
  /\bMUNICIPAL\s+ACQUISITION\b/i,
];

// Condominium / Homeowners Association patterns (HOA lien foreclosures)
const HOA_PATTERNS = [
  /\bCONDO(MINIUM)?(\s+ASSO(CIATION)?)?\b/i,
  /\bTOWNHOUSE\s+(CONDO\s+)?ASSO(CIATION)?\b/i,
  /\bHOMEOWNERS(\s+ASSO(CIATION)?)?\b/i,
  /\bHOA\b/i,
  /\bCOMMUNITY\s+ASSO(CIATION)?\b/i,
  /\bVILLAGE\s+[A-Z0-9\s]+COMM(UNITY)?\s+ASSO(CIATION)?\b/i,
  /\bMASTER\s+ASSO(CIATION)?\b/i,
  /\bPROPERTY\s+OWNERS\s+ASSO(CIATION)?\b/i,
];

// Institutional mortgage lenders, loan servicers, and secondary market agencies
const MORTGAGE_LENDER_PATTERNS = [
  /\bMORTGAGE\b/i,
  /\bLOAN\s+SERVICING\b/i,
  /\bLOANDEPOT\b/i,
  /\bBANK\s+OF\s+AMERICA\b/i,
  /\bWELLS\s+FARGO\b/i,
  /\bCHASE\b/i,
  /\bJPMORGAN\b/i,
  /\bCITIBANK\b/i,
  /\bMIDFIRST\s+BANK\b/i,
  /\bLAKEVIEW\b/i,
  /\bPENNYMAC\b/i,
  /\bROCKET\s+MORTGAGE\b/i,
  /\bCARRINGTON\b/i,
  /\bCMG\b/i,
  /\bM\s*&\s*T\s+BANK\b/i,
  /\bCROSSCOUNTRY\b/i,
  /\bDEUTSCHE\s+BANK\b/i,
  /\bUS\s+BANK\b/i,
  /\bHSBC\b/i,
  /\bPNC\s+BANK\b/i,
  /\bTD\s+BANK\b/i,
  /\bARVEST\s+BANK\b/i,
  /\bCITIZENS\s+BANK\b/i,
  /\bBROKER\s+SOLUTIONS\b/i,
  /\bFANNIE\s+MAE\b/i,
  /\bFREDDIE\s+MAC\b/i,
  /\bNATIONSTAR\b/i,
  /\bMR\.?\s+COOPER\b/i,
  /\bNEWREZ\b/i,
  /\bFREEDOM\s+MORTGAGE\b/i,
  /\bFEDERAL\s+CREDIT\s+UNION\b/i,
  /\bCREDIT\s+UNION\b/i,
];

// Municipal government bodies (towns, cities, boroughs)
const MUNICIPAL_GOV_PATTERNS = [
  /\bCITY\s+OF\s+[A-Z]+/i,
  /\bTOWNSHIP\s+OF\s+[A-Z]+/i,
  /\bBOROUGH\s+OF\s+[A-Z]+/i,
  /\bTOWN\s+OF\s+[A-Z]+/i,
  /\bCOUNTY\s+OF\s+[A-Z]+/i,
  /\bMUNICIPALITY\s+OF\s+[A-Z]+/i,
];

function parseAmount(val: number | string | null | undefined): number | null {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  const n = parseFloat(String(val).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Classify a foreclosure lead into MORTGAGE_FORECLOSURE, TAX_FORECLOSURE, OTHER_FORECLOSURE, or UNKNOWN.
 */
export function classifyForeclosure(input: ForeclosureClassificationInput): ForeclosureClassification {
  const caseNumber = (input.caseNumber || '').trim();
  const plaintiff = (input.plaintiff || '').trim();
  const docType = (input.documentType || '').trim();
  const filingDesc = (input.filingDescription || '').trim();
  const amount = parseAmount(input.loanAmount);

  const evidence: string[] = [];

  // 1. Explicit Tax Foreclosure check in Case Number, Document Type, or Filing Description
  const combinedText = `${caseNumber} ${docType} ${filingDesc}`;
  for (const pat of EXPLICIT_TAX_PATTERNS) {
    if (pat.test(combinedText)) {
      evidence.push(`Explicit tax foreclosure keyword found: "${pat.source}" in filing / case details`);
      return {
        category: 'TAX_FORECLOSURE',
        confidence: 0.98,
        evidence,
        requiresManualReview: false,
        classificationMethod: 'DETERMINISTIC_RULES',
      };
    }
  }

  // 2. Private Tax Lien Buyer or Certificate Servicer as Plaintiff
  if (plaintiff) {
    for (const pat of TAX_LIEN_BUYER_PATTERNS) {
      if (pat.test(plaintiff)) {
        evidence.push(`Plaintiff matches known tax lien fund or tax certificate buyer: "${plaintiff}"`);
        if (amount !== null && amount < 15000) {
          evidence.push(`Lien amount ($${amount.toLocaleString()}) is consistent with municipal tax debt (< $15k)`);
        }
        return {
          category: 'TAX_FORECLOSURE',
          confidence: 0.92,
          evidence,
          requiresManualReview: false,
          classificationMethod: 'DETERMINISTIC_RULES',
        };
      }
    }
  }

  // 3. HOA / Condominium Association Lien Foreclosure (OTHER_FORECLOSURE)
  if (plaintiff) {
    for (const pat of HOA_PATTERNS) {
      if (pat.test(plaintiff)) {
        evidence.push(`Plaintiff is a condominium or homeowners association: "${plaintiff}" (HOA Assessment Lien Foreclosure)`);
        return {
          category: 'OTHER_FORECLOSURE',
          confidence: 0.95,
          evidence,
          requiresManualReview: false,
          classificationMethod: 'DETERMINISTIC_RULES',
        };
      }
    }
  }

  // 4. Municipality / City / Township as Plaintiff (Requires caution per rules)
  // "A municipality appearing as plaintiff may be an indicator of tax foreclosure, but it is not conclusive by itself.
  // When the evidence is insufficient or conflicting, classify the record as UNKNOWN and flag it for review."
  if (plaintiff) {
    const isMuni = MUNICIPAL_GOV_PATTERNS.some((pat) => pat.test(plaintiff));
    if (isMuni) {
      if (amount !== null && amount < 10000) {
        evidence.push(`Municipality plaintiff "${plaintiff}" with low lien amount ($${amount.toLocaleString()}) strongly indicates tax foreclosure`);
        return {
          category: 'TAX_FORECLOSURE',
          confidence: 0.85,
          evidence,
          requiresManualReview: false,
          classificationMethod: 'DETERMINISTIC_RULES',
        };
      } else {
        evidence.push(`Municipality is plaintiff ("${plaintiff}"), but lacking explicit tax foreclosure keywords or clear tax debt size`);
        return {
          category: 'UNKNOWN',
          confidence: 0.50,
          evidence,
          requiresManualReview: true,
          classificationMethod: 'DETERMINISTIC_RULES',
        };
      }
    }
  }

  // 5. Institutional Mortgage Lender or Servicer (MORTGAGE_FORECLOSURE)
  if (plaintiff) {
    for (const pat of MORTGAGE_LENDER_PATTERNS) {
      if (pat.test(plaintiff)) {
        evidence.push(`Plaintiff is an institutional mortgage lender or loan servicer: "${plaintiff}"`);
        return {
          category: 'MORTGAGE_FORECLOSURE',
          confidence: 0.95,
          evidence,
          requiresManualReview: false,
          classificationMethod: 'DETERMINISTIC_RULES',
        };
      }
    }
  }

  // 6. Typical Mortgage Foreclosure by docket and residential loan size
  // e.g. New Jersey Chancery Division lis pendens docket (F-XXXXX-XX) with residential loan amount (> $20k)
  const isChanceryDocket = /^F-\d+-\d+/i.test(caseNumber);
  if (isChanceryDocket && amount !== null && amount >= 20000) {
    evidence.push(`Chancery foreclosure docket "${caseNumber}" with standard residential loan amount ($${amount.toLocaleString()})`);
    return {
      category: 'MORTGAGE_FORECLOSURE',
      confidence: 0.88,
      evidence,
      requiresManualReview: false,
      classificationMethod: 'DETERMINISTIC_RULES',
    };
  }

  // 7. Fallback / Insufficient Evidence -> UNKNOWN
  evidence.push('Insufficient evidence to definitively distinguish mortgage vs tax foreclosure');
  return {
    category: 'UNKNOWN',
    confidence: 0.35,
    evidence,
    requiresManualReview: true,
    classificationMethod: 'DETERMINISTIC_RULES',
  };
}
