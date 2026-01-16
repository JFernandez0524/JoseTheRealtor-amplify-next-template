import { type Schema } from '@/amplify/data/resource';

type PropertyLead = Schema['PropertyLead']['type'];

/**
 * Fetches all PropertyLeads with automatic pagination
 * @param listFn - The list function from Amplify client (cookiesClient or client)
 * @returns Array of all PropertyLeads
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
