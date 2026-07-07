/**
 * SKIP-TRACE BILLING
 *
 * BatchData bills skip trace **per matched record**, not per request. A NO_MATCH (BatchData found
 * nobody) is not billed to us, so the client must not be billed for it either. A match that returns
 * a record but no phone passing our quality filter (NO_QUALITY_CONTACTS) IS billed by BatchData — we
 * matched a person — so it is chargeable. FAILED/ERROR/INVALID_GEO never call BatchData successfully,
 * so they are free too.
 *
 * Used by `skiptraceLeads/handler.ts` to decide how many credits to deduct. Kept pure + tested so the
 * billing rule can be verified without a live (paid) skip-trace call.
 */

/** Result statuses BatchData charges us for (a record was matched and returned). */
export const BILLABLE_SKIP_STATUSES = new Set<string>(['SUCCESS', 'NO_QUALITY_CONTACTS']);

// ---- Credit pricing (single source of truth for both flows + the reports) ----
// Clients pay in credits; 1 credit = $0.10 (see billing/buy-credits). We charge per BatchData match:
// skip-trace 1 credit/match ($0.10); enrichment 3 credits/match ($0.30 retail, our cost ~$0.28).
export const DOLLARS_PER_CREDIT = 0.1;
export const SKIPTRACE_CREDITS_PER_MATCH = 1;
export const ENRICHMENT_CREDITS_PER_MATCH = 3;

/** Credits charged for a job = matched records × the per-match rate (never charged for no-match). */
export function creditsFor(matched: number, creditsPerMatch: number): number {
  return Math.max(0, matched) * creditsPerMatch;
}

/** Dollar value of a credit count. */
export function dollarsFor(credits: number): number {
  return Math.round(credits * DOLLARS_PER_CREDIT * 100) / 100;
}

/**
 * Count how many skip-trace results are billable (matched records). NO_MATCH / FAILED / ERROR /
 * INVALID_GEO are free.
 *
 * @param statuses - the per-lead result status strings from a skip-trace batch
 * @returns number of billable (chargeable) results
 */
export function billableSkipCount(statuses: Array<string | null | undefined>): number {
  return statuses.filter((s): s is string => !!s && BILLABLE_SKIP_STATUSES.has(s)).length;
}
