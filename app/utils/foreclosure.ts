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
