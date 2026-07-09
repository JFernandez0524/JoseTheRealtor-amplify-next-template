/**
 * FORECLOSURE STAGE CLASSIFICATION
 *
 * Categorizes a BatchData `foreclosureStatus` string (the latest recorded foreclosure document type,
 * e.g. "Notice of Default", "Lis Pendens", "Notice of Sale", "Rescission Recording") into a stage the
 * dashboard can filter on. Powers the enrich → qualify → skip-trace funnel: users target motivated leads
 * (facing auction / active foreclosure) and skip the dead ones (rescinded/released) before paying for skip
 * trace.
 *
 * Pure + unit-tested so the keyword rules can be verified and extended as new real statuses appear.
 */

export type ForeclosureStage = 'AUCTION' | 'ACTIVE' | 'DEAD' | 'UNKNOWN';

// Checked in priority order: a "dead" recording (rescission/release) overrides an earlier active one,
// then auction (most urgent), then other active stages.
const DEAD = ['rescis', 'release', 'reinstat', 'cancel', 'withdraw', 'satisf', 'redempt', 'dismiss', 'expired'];
const AUCTION = ['notice of sale', 'trustee sale', 'trustees sale', 'sheriff sale', 'auction', 'notice of foreclosure sale', 'notice of trustee'];
const ACTIVE = ['notice of default', 'lis pendens', 'lis-pendens', 'nod', 'default', 'pre-foreclosure', 'preforeclosure', 'notice of foreclosure'];

/**
 * Classify a raw foreclosure status string into a stage.
 * @param status - lead.foreclosureStatus (BatchData `foreclosure.status`)
 */
export function classifyForeclosureStage(status?: string | null): ForeclosureStage {
  if (!status || typeof status !== 'string') return 'UNKNOWN';
  const s = status.toLowerCase();
  if (DEAD.some((k) => s.includes(k))) return 'DEAD';
  if (AUCTION.some((k) => s.includes(k))) return 'AUCTION';
  if (ACTIVE.some((k) => s.includes(k))) return 'ACTIVE';
  return 'UNKNOWN';
}

/** True for stages worth pursuing — an active foreclosure or one facing auction (i.e. not dead/unknown). */
export function isActiveForeclosure(status?: string | null): boolean {
  const stage = classifyForeclosureStage(status);
  return stage === 'ACTIVE' || stage === 'AUCTION';
}

// A BatchData foreclosure record this many days older than the lead's fresh filing is treated as
// stale — it describes a PRIOR foreclosure, not the current one, so it must not mark the lead DEAD.
// Fresh county filings are days/weeks old; stale BatchData records are typically 1–3 years old.
export const FORECLOSURE_STALE_DAYS = 180;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse a date-ish value to epoch ms, or null if absent/unparseable. */
function toMs(value?: string | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Minimal shape needed to judge foreclosure recency — a subset of PropertyLead. */
export interface ForeclosureRecencyInput {
  foreclosureStatus?: string | null;
  countyFilingDate?: string | null; // authoritative county recording date (never from BatchData)
  createdAt?: string | null; // upload timestamp — fallback anchor for legacy leads
  foreclosureRecordingDate?: string | null;
  foreclosureDefaultDate?: string | null;
  foreclosureAuctionDate?: string | null;
  foreclosureData?: unknown; // BatchData foreclosure blob (may carry filingDate)
}

export interface ForeclosureStageResult {
  stage: ForeclosureStage; // effective stage to filter/act on (stale-DEAD promoted to ACTIVE)
  baseStage: ForeclosureStage; // raw keyword classification of foreclosureStatus
  stale: boolean; // BatchData record predates the fresh filing → its DEAD verdict is not trusted
  filingMs: number | null; // resolved fresh-filing anchor
  batchDataMs: number | null; // newest BatchData foreclosure event date
}

/**
 * Recency-aware foreclosure stage. A fresh county filing is authoritative: if the keyword classifier
 * says DEAD but that verdict rests on a BatchData record materially older than the lead's fresh filing
 * (countyFilingDate, or createdAt for legacy leads), the record is a prior/rescinded foreclosure and
 * the lead has since re-entered foreclosure — so we surface it as ACTIVE and flag `stale`.
 *
 * Pure + tested. Used by the dashboard funnel filter and the lead-detail foreclosure badge.
 */
export function classifyForeclosureStageWithRecency(
  lead: ForeclosureRecencyInput | null | undefined,
): ForeclosureStageResult {
  const baseStage = classifyForeclosureStage(lead?.foreclosureStatus);
  const filingMs = toMs(lead?.countyFilingDate) ?? toMs(lead?.createdAt);

  // Newest foreclosure event date BatchData has for this property.
  const fcData = lead?.foreclosureData;
  const bdFilingDate =
    fcData && typeof fcData === 'object' ? (fcData as any).filingDate : null;
  const batchDataMs = [
    toMs(lead?.foreclosureRecordingDate),
    toMs(lead?.foreclosureDefaultDate),
    toMs(lead?.foreclosureAuctionDate),
    toMs(bdFilingDate),
  ].reduce<number | null>((max, ms) => (ms != null && (max == null || ms > max) ? ms : max), null);

  const stale =
    baseStage === 'DEAD' &&
    filingMs != null &&
    batchDataMs != null &&
    filingMs - batchDataMs > FORECLOSURE_STALE_DAYS * MS_PER_DAY;

  return {
    stage: stale ? 'ACTIVE' : baseStage,
    baseStage,
    stale,
    filingMs,
    batchDataMs,
  };
}
