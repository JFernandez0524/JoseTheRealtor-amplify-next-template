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
