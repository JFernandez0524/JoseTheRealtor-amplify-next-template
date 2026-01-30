/**
 * CLIENT-SIDE LEAD OPERATIONS
 *
 * This file contains all lead-related operations for React components (browser/client-side).
 * Uses Amplify Data client for authenticated user operations.
 *
 * ⚠️ IMPORTANT: This file is for CLIENT-SIDE only (React components)
 * For server-side operations (API routes, Lambda), use lead.server.ts instead
 *
 * ARCHITECTURE:
 * - All functions use the Amplify client from frontEndClient.ts
 * - Functions handle errors and return typed data
 * - Logging included for debugging
 * - Consistent error handling across all operations
 *
 * USAGE EXAMPLES:
 *
 * 1. Fetch all leads:
 *    ```typescript
 *    import { fetchLeads } from '@/app/utils/aws/data/lead.client';
 *    const leads = await fetchLeads();
 *    ```
 *
 * 2. Update a lead:
 *    ```typescript
 *    import { updateLead } from '@/app/utils/aws/data/lead.client';
 *    await updateLead(leadId, { manualStatus: 'ACTIVE' });
 *    ```
 *
 * 3. Real-time updates:
 *    ```typescript
 *    import { observeLeads } from '@/app/utils/aws/data/lead.client';
 *    const subscription = observeLeads((leads) => {
 *      setLeads(leads);
 *    });
 *    // Later: subscription.unsubscribe();
 *    ```
 *
 * 4. Bulk operations:
 *    ```typescript
 *    import { skipTraceLeads, syncToGHL } from '@/app/utils/aws/data/lead.client';
 *    await skipTraceLeads(['lead1', 'lead2']);
 *    await syncToGHL(['lead1', 'lead2']);
 *    ```
 *
 * WHY THIS FILE EXISTS:
 * - Centralizes all client-side lead operations
 * - Provides consistent error handling
 * - Makes components cleaner (no direct client.models calls)
 * - Easier to test and maintain
 * - Type-safe operations
 *
 * RELATED FILES:
 * - lead.server.ts - Server-side lead operations
 * - frontEndClient.ts - Amplify client configuration
 * - amplifyFrontEndUser.ts - Authentication utilities
 */

import { client } from '@/app/utils/aws/data/frontEndClient';
import { type Schema } from '@/amplify/data/resource';

export type Lead = Schema['PropertyLead']['type'] & {
  ghlSyncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  ghlContactId?: string | null;
  ghlSyncDate?: string | null;
};

/**
 * Fetch all leads for the current user (with automatic pagination)
 */
export async function fetchLeads(): Promise<Lead[]> {
  try {
    const allLeads: Lead[] = [];
    let nextToken: string | null | undefined;

    do {
      const result = await client.models.PropertyLead.list();
      allLeads.push(...(result.data || []));
      nextToken = result.nextToken;
    } while (nextToken);

    console.log('🔄 Fetched leads:', allLeads.length);
    return allLeads as Lead[];
  } catch (err) {
    console.error('Failed to fetch leads:', err);
    throw err;
  }
}

/**
 * Fetch a single lead by ID
 */
export async function fetchLead(id: string): Promise<Lead | null> {
  try {
    const { data } = await client.models.PropertyLead.get({ id });
    return data as Lead | null;
  } catch (err) {
    console.error('Failed to fetch lead:', err);
    throw err;
  }
}

/**
 * Update a lead
 */
export async function updateLead(
  id: string,
  updates: Partial<Lead>
): Promise<Lead> {
  try {
    const { data, errors } = await client.models.PropertyLead.update({
      id,
      ...updates,
    });
    if (errors) {
      throw new Error(errors.map((e: any) => e.message).join(', '));
    }
    return data as Lead;
  } catch (err) {
    console.error('Failed to update lead:', err);
    throw err;
  }
}

/**
 * Delete a lead
 */
export async function deleteLead(id: string): Promise<void> {
  try {
    const { errors } = await client.models.PropertyLead.delete({ id });
    if (errors) {
      throw new Error(errors.map((e: any) => e.message).join(', '));
    }
  } catch (err) {
    console.error('Failed to delete lead:', err);
    throw err;
  }
}

/**
 * Bulk delete leads
 */
export async function bulkDeleteLeads(ids: string[]): Promise<void> {
  try {
    await Promise.all(
      ids.map((id) => client.models.PropertyLead.delete({ id }))
    );
    console.log(`✅ Deleted ${ids.length} leads`);
  } catch (err) {
    console.error('Failed to bulk delete leads:', err);
    throw err;
  }
}

/**
 * Bulk update lead status
 */
export async function bulkUpdateStatus(
  ids: string[],
  status: 'ACTIVE' | 'SOLD' | 'PENDING' | 'OFF_MARKET' | 'SKIP' | 'DIRECT_MAIL'
): Promise<void> {
  try {
    await Promise.all(
      ids.map((id) =>
        client.models.PropertyLead.update({
          id,
          manualStatus: status,
        })
      )
    );
    console.log(`✅ Updated ${ids.length} leads to ${status}`);
  } catch (err) {
    console.error('Failed to bulk update status:', err);
    throw err;
  }
}

/**
 * Skip trace leads
 * 
 * Initiates bulk skip trace operation for multiple leads.
 * Returns detailed results including success/failure counts.
 * 
 * @param leadIds - Array of lead IDs to skip trace
 * @returns Array of results with status for each lead
 * 
 * RESULT FORMAT:
 * [
 *   { leadId: string, status: 'SUCCESS' | 'FAILED' | 'NO_MATCH', ... },
 *   ...
 * ]
 * 
 * NOTES:
 * - Response may be JSON string or object (auto-parsed)
 * - Lambda updates lead records in DynamoDB
 * - Credits deducted for successful traces
 * - UI should refresh after operation completes
 */
export async function skipTraceLeads(leadIds: string[]): Promise<any> {
  try {
    // Check if user is authenticated
    const { getFrontEndAuthSession } = await import('../auth/amplifyFrontEndUser');
    const session = await getFrontEndAuthSession();
    
    if (!session) {
      throw new Error('You must be signed in to skip trace leads. Please refresh the page and sign in again.');
    }
    
    const { data, errors } = await client.mutations.skipTraceLeads({ leadIds });
    if (errors) {
      console.error('Skip trace errors:', errors);
      throw new Error(errors[0].message);
    }
    
    // Parse JSON response if it's a string
    const results = typeof data === 'string' ? JSON.parse(data) : data;
    console.log('Skip trace results:', results);
    return results;
  } catch (err: any) {
    console.error('Failed to skip trace leads:', err);
    // Provide more helpful error message for auth issues
    if (err.message?.includes('No current user') || err.message?.includes('not authenticated')) {
      throw new Error('Your session has expired. Please refresh the page and sign in again.');
    }
    throw err;
  }
}

/**
 * Sync leads to GoHighLevel
 * 
 * Syncs multiple leads to GHL CRM in parallel.
 * Uses Promise.allSettled to handle partial failures gracefully.
 * 
 * @param leadIds - Array of lead IDs to sync
 * @returns Object with successful and failed counts
 * 
 * RETURN FORMAT:
 * {
 *   successful: number,  // Count of successfully synced leads
 *   failed: number       // Count of failed syncs
 * }
 * 
 * NOTES:
 * - Each lead synced independently (partial failures allowed)
 * - Lambda creates/updates contacts in GHL
 * - Includes property details, Zestimate, and cash offer
 * - UI should refresh after operation completes
 */
export async function syncToGHL(leadIds: string[]): Promise<{ successful: number; failed: number }> {
  try {
    const results = await Promise.allSettled(
      leadIds.map((id) => client.mutations.manualGhlSync({ leadId: id }))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`✅ GHL Sync complete: ${successful} successful, ${failed} failed`);
    return { successful, failed };
  } catch (err) {
    console.error('Failed to sync to GHL:', err);
    throw err;
  }
}

/**
 * Observe leads in real-time
 * Returns a subscription that auto-updates when data changes
 */
export function observeLeads(callback: (leads: Lead[]) => void) {
  return client.models.PropertyLead.observeQuery().subscribe({
    next: ({ items }) => {
      callback(items as Lead[]);
    },
  });
}
