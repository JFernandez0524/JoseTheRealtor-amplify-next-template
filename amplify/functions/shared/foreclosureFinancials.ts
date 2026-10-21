/**
 * FORECLOSURE & SHERIFF SALE / LIS PENDENS FINANCIALS HELPER
 *
 * Centralizes extraction of:
 * - Foreclosure sub-type: 'SHERIFF_SALE' (Auction) vs 'LIS_PENDENS' (County Recording)
 * - Sheriff sale date & Lis Pendens recording/filing date
 * - Upset / judgment amounts (Sheriff Sale) and recorded loan / lien amounts (Lis Pendens)
 * - Zestimate / valuation, estimated equity spread ($ and %), and equity tier classification
 * - Universal property county resolution across all lead types
 *
 * Used by:
 * - Frontend dashboard table, filters, and lead details (LeadTable, LeadDashboardClient, EnrichmentDetails)
 * - Backend GHL sync (manualGhlSync) and AI outreach context
 */

export type EquitySpreadTier = 'HIGH_EQUITY' | 'MODERATE_EQUITY' | 'UNDERWATER' | 'UNKNOWN';
export type ForeclosureSubType = 'SHERIFF_SALE' | 'LIS_PENDENS' | null;
export type BaselineDebtLabel = 'Upset' | 'Loan' | 'Tax Lien' | 'HOA / Condo Lien';

export interface ForeclosureFinancials {
  /** Sub-type for PREFORECLOSURE leads: 'SHERIFF_SALE' (auction) vs 'LIS_PENDENS' (county recording) */
  foreclosureSubType: ForeclosureSubType;
  /** True when the lead is a Sheriff Sale / Auction lead */
  isSheriffSale: boolean;
  /** Scheduled sheriff sale or auction date (YYYY-MM-DD or raw date string) */
  saleDate: string | null;
  /** County Lis Pendens recording / filing date */
  recordingDate: string | null;
  /** Approx. upset amount from sheriff sale scraper CSV */
  approxUpset: number | null;
  /** Estimated upset / judgment / recorded loan or lien amount */
  estimatedUpset: number | null;
  /** Authoritative debt amount used as baseline for equity spread (estimatedUpset ?? approxUpset) */
  baselineUpset: number | null;
  /** Human-readable label for the baseline debt ('Upset', 'Loan', 'Tax Lien', 'HOA / Condo Lien') */
  baselineLabel: BaselineDebtLabel;
  /** Zestimate or estimated market value */
  zestimateVal: number | null;
  /** Estimated dollar equity spread (zestimateVal - baselineUpset) */
  equitySpread: number | null;
  /** Estimated equity percentage (0-100, or negative when underwater). Falls back to BatchData equityPercent when debt is absent. */
  equitySpreadPct: number | null;
  /** Visual & workflow tier classification */
  equityTier: EquitySpreadTier;
  /** Resolved property county across flat field, standardizedAddress, and sourceRawData */
  resolvedCounty: string | null;
}

function parseJsonSafe(v: unknown): Record<string, any> {
  if (!v) return {};
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof v === 'object' ? (v as Record<string, any>) : {};
}

function parseMoney(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[$,\s]/g, '').trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Formats a date string into YYYY-MM-DD for GHL DATE custom fields, or returns null if invalid.
 */
export function toIsoDateOnly(v?: string | null): string | null {
  if (!v) return null;
  const trimmed = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

/**
 * Resolves the property county for ANY lead type (Probate, Pre-Foreclosure, FSBO, etc.)
 * checking flat ownerCounty, Google standardizedAddress, CSV sourceRawData, and BatchData enrichment.
 */
export function resolvePropertyCounty(lead: any): string | null {
  if (!lead) return null;
  const std = parseJsonSafe(lead.standardizedAddress);
  const sourceRaw = parseJsonSafe(lead.sourceRawData);
  const rawEnrich = parseJsonSafe(lead.rawEnrichmentData);

  const rawCounty =
    lead.ownerCounty ||
    std.county ||
    sourceRaw.county ||
    sourceRaw.County ||
    sourceRaw.COUNTY ||
    sourceRaw['SITUS-COUNTY'] ||
    sourceRaw['SITUS COUNTY'] ||
    sourceRaw['Situs County'] ||
    sourceRaw.property_county ||
    sourceRaw['Property County'] ||
    rawEnrich.address?.county ||
    null;

  if (!rawCounty || typeof rawCounty !== 'string') return null;
  const cleaned = rawCounty.trim();
  if (!cleaned) return null;

  return cleaned
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Computes foreclosure / sheriff sale / lis pendens dates, debt amounts, sub-type, and estimated equity spread.
 */
export function computeForeclosureFinancials(lead: any): ForeclosureFinancials {
  if (!lead) {
    return {
      foreclosureSubType: null,
      isSheriffSale: false,
      saleDate: null,
      recordingDate: null,
      approxUpset: null,
      estimatedUpset: null,
      baselineUpset: null,
      baselineLabel: 'Loan',
      zestimateVal: null,
      equitySpread: null,
      equitySpreadPct: null,
      equityTier: 'UNKNOWN',
      resolvedCounty: null,
    };
  }

  const raw = parseJsonSafe(lead.rawEnrichmentData);
  const fc = { ...parseJsonSafe(raw.foreclosure), ...parseJsonSafe(lead.foreclosureData) };
  const openLien = { ...parseJsonSafe(raw.openLien), ...parseJsonSafe(lead.openLienData) };
  const sourceRaw = parseJsonSafe(lead.sourceRawData);
  const val = parseJsonSafe(raw.valuation);

  const saleDateRaw =
    lead.foreclosureAuctionDate ||
    fc.auctionDate ||
    sourceRaw.sales_date ||
    sourceRaw.sale_date ||
    sourceRaw['Sale Date'] ||
    sourceRaw['Auction Date'] ||
    sourceRaw['AUCTION DATE'] ||
    null;

  const saleDate = saleDateRaw ? String(saleDateRaw).trim() : null;

  const recordingDateRaw =
    lead.countyFilingDate ||
    lead.foreclosureRecordingDate ||
    fc.recordingDate ||
    fc.filingDate ||
    sourceRaw['RECORDING-DATE'] ||
    sourceRaw['RECORDING DATE'] ||
    sourceRaw['Recording Date'] ||
    sourceRaw.recording_date ||
    null;

  const recordingDate = recordingDateRaw ? String(recordingDateRaw).trim() : null;

  const approxUpset = parseMoney(sourceRaw.approx_upset);
  const estimatedUpset =
    parseMoney(lead.foreclosureAmount) ??
    parseMoney(sourceRaw.estimated_upset) ??
    parseMoney(sourceRaw['LOAN-AMOUNT']) ??
    parseMoney(sourceRaw['LOAN AMOUNT']) ??
    parseMoney(sourceRaw['Loan Amount']) ??
    parseMoney(sourceRaw['MORTGAGEAM']) ??
    parseMoney(sourceRaw['Mortgage Amount']) ??
    parseMoney(sourceRaw['Open Loan Balance']) ??
    parseMoney(sourceRaw['Amount']) ??
    parseMoney(sourceRaw.loan_amount) ??
    parseMoney(sourceRaw.loanAmount) ??
    parseMoney(lead.foreclosureUnpaidBalance) ??
    parseMoney(lead.mortgageBalance) ??
    parseMoney(openLien.totalOpenLienBalance) ??
    parseMoney(fc.unpaidBalance) ??
    null;

  const statusStr = String(lead.foreclosureStatus || fc.status || '').toLowerCase();
  const hasAuctionKeyword =
    statusStr.includes('sheriff sale') ||
    statusStr.includes('notice of sale') ||
    statusStr.includes('trustee sale') ||
    statusStr.includes('auction');

  const isSheriffSale = Boolean(
    saleDate ||
    approxUpset != null ||
    sourceRaw.estimated_upset != null ||
    sourceRaw.sheriff_number != null ||
    hasAuctionKeyword
  );

  const isPreforeclosure =
    String(lead.type || '').toUpperCase().replace(/[_\s-]+/g, '') === 'PREFORECLOSURE';

  const foreclosureSubType: ForeclosureSubType = isPreforeclosure
    ? isSheriffSale
      ? 'SHERIFF_SALE'
      : 'LIS_PENDENS'
    : isSheriffSale
      ? 'SHERIFF_SALE'
      : null;

  const caseNumStr = String(
    lead.foreclosureCaseNumber ||
    sourceRaw['CASE NUMBER'] ||
    sourceRaw.court_case_number ||
    fc.caseNumber ||
    ''
  );
  const isTax =
    lead.isTaxForeclosure === true ||
    lead.foreclosureCategory === 'TAX_FORECLOSURE' ||
    /tax[_\s-]*fore/i.test(caseNumStr);
  const isHoaOrCondoLien =
    !isTax &&
    (lead.foreclosureCategory === 'OTHER_FORECLOSURE' || /\bcondo\b|\bhoa\b/i.test(caseNumStr));

  let baselineLabel: BaselineDebtLabel = 'Loan';
  if (isSheriffSale) {
    baselineLabel = 'Upset';
  } else if (isTax) {
    baselineLabel = 'Tax Lien';
  } else if (isHoaOrCondoLien) {
    baselineLabel = 'HOA / Condo Lien';
  }

  const baselineUpset = estimatedUpset ?? approxUpset;
  const zestimateVal =
    parseMoney(lead.zestimate) ??
    parseMoney(lead.estimatedValue) ??
    parseMoney(val.estimatedValue) ??
    null;

  const calculatedSpread =
    zestimateVal != null && zestimateVal > 0 && baselineUpset != null && baselineUpset > 0
      ? Math.round(zestimateVal - baselineUpset)
      : null;

  const equitySpread =
    calculatedSpread ??
    parseMoney(lead.estimatedEquity) ??
    parseMoney(val.equityCurrentEstimatedBalance) ??
    null;

  let equitySpreadPct: number | null = null;
  if (equitySpread != null && zestimateVal != null && zestimateVal > 0) {
    equitySpreadPct = Math.round((equitySpread / zestimateVal) * 100);
  } else if (lead.equityPercent != null && Number.isFinite(Number(lead.equityPercent))) {
    equitySpreadPct = Math.round(Number(lead.equityPercent));
  } else if (val.equityPercent != null && Number.isFinite(Number(val.equityPercent))) {
    equitySpreadPct = Math.round(Number(val.equityPercent));
  }

  let equityTier: EquitySpreadTier = 'UNKNOWN';
  if (equitySpread != null) {
    if (equitySpread <= 0) {
      equityTier = 'UNDERWATER';
    } else if (equitySpread >= 100000 || (equitySpreadPct != null && equitySpreadPct >= 30)) {
      equityTier = 'HIGH_EQUITY';
    } else {
      equityTier = 'MODERATE_EQUITY';
    }
  } else if (equitySpreadPct != null) {
    if (equitySpreadPct <= 0) {
      equityTier = 'UNDERWATER';
    } else if (equitySpreadPct >= 30) {
      equityTier = 'HIGH_EQUITY';
    } else {
      equityTier = 'MODERATE_EQUITY';
    }
  }

  return {
    foreclosureSubType,
    isSheriffSale,
    saleDate,
    recordingDate,
    approxUpset,
    estimatedUpset,
    baselineUpset,
    baselineLabel,
    zestimateVal,
    equitySpread,
    equitySpreadPct,
    equityTier,
    resolvedCounty: resolvePropertyCounty(lead),
  };
}
