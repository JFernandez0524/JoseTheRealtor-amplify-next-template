/**
 * PAGINATION UTILITIES
 * 
 * Handles automatic pagination for Amplify GraphQL queries that return large datasets.
 * Amplify limits results to 100 items per request by default - this utility fetches all pages.
 * 
 * PROBLEM SOLVED:
 * - Amplify list() only returns first 100 items
 * - Manual pagination is repetitive and error-prone
 * - This utility automatically fetches all pages
 * 
 * USAGE:
 * - Use when you need ALL records, not just the first page
 * - Commonly used for admin dashboards showing all leads
 * - Works with any Amplify model that supports pagination
 * 
 * EXAMPLES:
 * ```typescript
 * import { fetchAllLeads } from '@/app/utils/aws/data/pagination';
 * 
 * // Fetch all leads across all pages
 * const { data: allLeads, errors } = await fetchAllLeads(
 *   (params) => cookiesClient.models.PropertyLead.list(params)
 * );
 * 
 * console.log(`Total leads: ${allLeads.length}`); // Could be 500, 1000, etc.
 * ```
 * 
 * HOW IT WORKS:
 * 1. Makes first request without nextToken
 * 2. If response has nextToken, makes another request with it
 * 3. Repeats until no more nextToken (all pages fetched)
 * 4. Returns combined array of all items
 * 
 * RELATED FILES:
 * - app/(protected)/admin/page.tsx - Uses this to fetch all leads for admin view
 */

import { type Schema } from '@/amplify/data/resource';

type PropertyLead = Schema['PropertyLead']['type'];

/**
 * Fetches all PropertyLeads with automatic pagination
 * 
 * Pass in the list function from your Amplify client and this will
 * automatically handle pagination to fetch all records.
 * 
 * @param listFn - The list function from Amplify client (cookiesClient or client)
 * @returns Object with data array and optional errors
 * 
 * @example
 * // Server-side (admin page)
 * const { data, errors } = await fetchAllLeads(
 *   (params) => cookiesClient.models.PropertyLead.list(params)
 * );
 * 
 * // Client-side (if needed)
 * const { data, errors } = await fetchAllLeads(
 *   (params) => client.models.PropertyLead.list(params)
 * );
 */
export async function fetchAllLeads(
  listFn: (params?: { nextToken?: string | null }) => Promise<{
    data: PropertyLead[];
    errors?: any[];
    nextToken?: string | null;
  }>
): Promise<{ data: PropertyLead[]; errors?: any[] }> {
  const allLeads: PropertyLead[] = [];
  let nextToken: string | null | undefined = null;
  let errors = null;

  do {
    const result = await listFn(nextToken ? { nextToken } : {});
    
    if (result.errors) {
      errors = result.errors;
      break;
    }
    
    allLeads.push(...(result.data || []));
    nextToken = result.nextToken;
  } while (nextToken);

  return { data: allLeads, errors: errors || undefined };
}
