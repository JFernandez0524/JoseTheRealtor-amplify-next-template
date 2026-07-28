// app/utils/leadState.ts
//
// Pure helpers for patching the dashboard's in-memory lead list after a mutation, so an edit can
// render from the response already in hand instead of re-downloading every lead. Tested in
// `__tests__/shared/leadState.test.ts`.
import type { Lead } from '@/app/utils/aws/data/lead.client';

/**
 * Merge freshly-updated leads into an existing list, matching on `id`.
 *
 * Order is preserved: the dashboard list is a filtered and sorted view, so a replaced row must stay
 * exactly where it was or the table visibly reshuffles under the user's cursor.
 *
 * Updates whose `id` is not already in `existing` are **ignored** rather than appended — appending
 * would drop a row at the end of a sorted list, in a position its sort key doesn't justify. A newly
 * created lead should arrive through a real fetch, not through a patch.
 *
 * Neither input array is mutated; a new array is always returned so React re-renders on the new
 * reference. When `updated` contains the same id twice, the last entry wins.
 */
export function mergeLeadsById(existing: Lead[], updated: Lead[]): Lead[] {
  if (!updated?.length) return [...(existing ?? [])];
  if (!existing?.length) return [];

  const byId = new Map<string, Lead>();
  for (const lead of updated) {
    if (lead?.id) byId.set(lead.id, lead);
  }
  if (byId.size === 0) return [...existing];

  return existing.map((lead) => byId.get(lead.id) ?? lead);
}
