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

import { getCurrentUser } from 'aws-amplify/auth';
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
    const { userId } = await getCurrentUser();
    const allLeads: Lead[] = [];
    let nextToken: string | null | undefined;

    do {
      const result = await client.models.PropertyLead.list({
        filter: { owner: { eq: userId } },
        nextToken: nextToken ?? undefined,
      });
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
  await Promise.all(ids.map((id) => deleteLead(id)));
}

/**
 * Bulk update lead status
 */
export async function bulkUpdateStatus(
  ids: string[],
  status: 'off_market' | 'active' | 'sold' | 'pending' | 'fsbo' | 'auction' | 'skip' | 'door_knock'
): Promise<void> {
  try {
    await Promise.all(
      ids.map((id) =>
        client.models.PropertyLead.update({
          id,
          listingStatus: status,
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
    // Force refresh session to get fresh tokens
    const { fetchAuthSession } = await import('aws-amplify/auth');
    const session = await fetchAuthSession({ forceRefresh: true });
    
    if (!session.tokens) {
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
export async function syncToGHL(leadIds: string[], onProgress?: (current: number, total: number, message: string) => void): Promise<{ successful: number; failed: number; skipped: number; failedIds: string[]; skippedIds: string[]; isAsync?: boolean }> {
  try {
    // Each sync invocation makes several sequential GHL calls, so concurrency here multiplies into
    // GHL's per-location burst limit. On 2026-07-28 a run at BATCH_SIZE 10 / 250ms produced 76
    // `429 Too Many Requests` across 79 failed leads. The Lambda's GHL client now retries with
    // backoff (amplify/functions/shared/ghlRetry.ts); these values keep us off the limit to begin
    // with so that retry is the exception rather than the norm.
    const BATCH_SIZE = 5;
    const DELAY_MS = 1000;
    /** Extra passes over whatever is still failing, so the user doesn't hand-click "Retry Sync". */
    const RETRY_ROUNDS = 3;

    let successful = 0;
    let skipped = 0;
    const skippedIds: string[] = [];
    let pending = [...leadIds];
    let failedIds: string[] = [];

    /** Run one full pass over `ids`, returning the ones that failed. Tallies land in the closure. */
    const runPass = async (ids: string[], passLabel: string): Promise<string[]> => {
      const stillFailing: string[] = [];

      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(ids.length / BATCH_SIZE);

        console.log(`📦 ${passLabel}: batch ${batchNum}/${totalBatches} (${batch.length} leads)`);

        if (onProgress) {
          onProgress(
            leadIds.length - (ids.length - i),
            leadIds.length,
            `${passLabel}: batch ${batchNum}/${totalBatches}...`
          );
        }

        const results = await Promise.allSettled(
          batch.map((id) => client.mutations.manualGhlSync({ leadId: id }))
        );

        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const response = result.value as any;

            // Extract the actual Lambda response from GraphQL wrapper
            const lambdaResult = response?.data;

            // Parse if it's a JSON string
            let syncData = lambdaResult;
            if (typeof lambdaResult === 'string') {
              try {
                syncData = JSON.parse(lambdaResult);
              } catch {
                syncData = { status: lambdaResult };
              }
            }

            const status = syncData?.status;
            console.log(`🔍 Lead ${batch[index]} - Status: ${status}, Message: ${syncData?.message || 'N/A'}`);

            if (status === 'SUCCESS') {
              successful++;
              console.log(`✅ Lead ${batch[index]} synced successfully`);
            } else if (status === 'SKIPPED') {
              // Terminal: the lead is missing data the sync requires, so retrying can't help.
              skipped++;
              skippedIds.push(batch[index]);
              console.log(`⏭️ Lead ${batch[index]} skipped: ${syncData?.message}`);
            } else {
              stillFailing.push(batch[index]);
              console.log(`❌ Lead ${batch[index]} failed - Status: ${status}, Message: ${syncData?.message}`);
            }
          } else {
            stillFailing.push(batch[index]);
            console.log(`❌ Lead ${batch[index]} Lambda execution failed: ${result.reason}`);
          }
        });

        // Short pause between batches to stay under GHL's burst limit
        if (i + BATCH_SIZE < ids.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }

      return stillFailing;
    };

    console.log(`🔄 Syncing ${leadIds.length} leads in batches of ${BATCH_SIZE}...`);
    failedIds = await runPass(pending, 'Syncing');

    // Automatically re-run whatever is still failing. Most failures at this scale are transient
    // rate limiting, which clears on its own — so back off between rounds rather than hammering.
    for (let round = 1; round <= RETRY_ROUNDS && failedIds.length > 0; round++) {
      const backoffMs = 2000 * 2 ** (round - 1); // 2s, 4s, 8s
      const label = `Retrying ${failedIds.length} lead${failedIds.length === 1 ? '' : 's'} (round ${round} of ${RETRY_ROUNDS})`;

      console.log(`⏳ ${label} after ${backoffMs}ms...`);
      if (onProgress) {
        onProgress(leadIds.length - failedIds.length, leadIds.length, `${label}...`);
      }
      await new Promise(resolve => setTimeout(resolve, backoffMs));

      pending = failedIds;
      failedIds = await runPass(pending, label);
    }

    const failed = failedIds.length;

    if (onProgress) {
      onProgress(leadIds.length, leadIds.length, `Complete! ${successful} successful, ${skipped} skipped, ${failed} failed`);
    }

    console.log(`✅ GHL Sync complete: ${successful} successful, ${skipped} skipped, ${failed} failed`);
    return { successful, skipped, failed, failedIds, skippedIds };
  } catch (err) {
    console.error('Failed to sync to GHL:', err);
    throw err;
  }
}

/**
 * Observe leads in real-time
 * Returns a subscription that auto-updates when data changes
 */
export function observeLeads(callback: (leads: Lead[], isSynced: boolean) => void) {
  return client.models.PropertyLead.observeQuery().subscribe({
    next: ({ items, isSynced }) => {
      callback(items as Lead[], isSynced);
    },
  });
}
