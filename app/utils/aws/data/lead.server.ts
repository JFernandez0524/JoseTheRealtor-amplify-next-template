import { cookiesClient } from '../auth/amplifyServerUtils.server';
import { type Schema } from '../../../../amplify/data/resource';

// --- Reusable Types ---

// Define the full union of all valid Skip Trace Statuses
export type SkipTraceStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'NO_MATCH'
  | 'NOT_FOUND' // <-- ADDED to resolve Lambda error
  | 'NOT_AUTHORIZED' // <-- ADDED to resolve Lambda error
  | 'INVALID_DATA'; // <-- ADDED to resolve Lambda error

// 💥 1. Extend the PropertyLead type to include the new GHL status fields
export type DBLead = Schema['PropertyLead']['type'] & {
  ghlSyncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  ghlContactId?: string;
  ghlSyncDate?: string; // ISO Date string of last sync attempt
};

// Define the base type with server-managed fields omitted
type BaseLeadInput = Omit<
  Schema['PropertyLead']['type'],
  | 'id'
  | 'contacts'
  | 'enrichments'
  | 'activities'
  | 'createdAt'
  | 'updatedAt'
  | 'owner'
>;

// 💥 FIX: Redefine CreateLeadInput to ensure required fields are explicitly present (non-nullable)
export type CreateLeadInput = BaseLeadInput &
  Required<{
    type: string;
    ownerAddress: string;
    ownerCity: string;
    ownerState: string;
    ownerZip: string;
  }>;

// 💥 2. Update UpdateLeadInput to accept the new GHL status fields
// We manually set skipTraceStatus here to allow all the custom statuses.
export type UpdateLeadInput = Partial<BaseLeadInput> & {
  // Use BaseLeadInput here for clarity
  id: string;
  // 💥 FIX: Combine the SkipTraceStatus union with | null
  skipTraceStatus?: SkipTraceStatus | null; // <-- CRITICAL FIX

  ghlSyncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | null; // Also allowing null for safety
  ghlContactId?: string | null;
  ghlSyncDate?: string | null;
};

// --- CRUD Functions ---

/**
 * LIST all leads for the current user
 */
export async function listLeads(): Promise<DBLead[]> {
  try {
    // 1. Fetch leads explicitly using User Pool auth
    const { data: leads, errors } =
      await cookiesClient.models.PropertyLead.list({
        authMode: 'userPool',
        limit: 1000,
      });

    if (errors) {
      console.error('❌ listLeads errors:', errors);
      throw new Error('Failed to fetch leads');
    } // 2. Sort by newest first (Handling potential nulls for TypeScript)

    return (leads as DBLead[]).sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA; // Descending order (Newest first)
    });
  } catch (error: any) {
    console.error('❌ listLeads error:', error.message);
    return []; // Return empty array so the UI doesn't crash
  }
}

/**
 * CREATE a new Lead
 */
export async function createLead(leadData: CreateLeadInput): Promise<DBLead> {
  try {
    const { data: newLead, errors } =
      await cookiesClient.models.PropertyLead.create(leadData); // FIX APPLIED via type definition above
    if (errors) {
      throw new Error(errors.map((e: any) => e.message).join(', '));
    }
    return newLead as DBLead;
  } catch (error: any) {
    console.error('❌ createLead error:', error.message);
    throw error;
  }
}

/**
 * GET a single Lead by ID
 * 💥 3. Updated return type and casting
 */
export async function getLead(id: string): Promise<DBLead | null> {
  try {
    const { data: lead, errors } = await cookiesClient.models.PropertyLead.get({
      id,
    });
    if (errors) {
      throw new Error(errors.map((e: any) => e.message).join(', '));
    }
    return lead as DBLead;
  } catch (error: any) {
    console.error('❌ getLead error:', error.message);
    return null;
  }
}

/**
 * UPDATE an existing Lead
 * 💥 4. Updated return type and casting
 */
export async function updateLead(leadData: UpdateLeadInput): Promise<DBLead> {
  try {
    const { data: updatedLead, errors } =
      await cookiesClient.models.PropertyLead.update(leadData);
    if (errors) {
      throw new Error(errors.map((e: any) => e.message).join(', '));
    }
    return updatedLead as DBLead;
  } catch (error: any) {
    console.error(`❌ updateLead error (ID: ${leadData.id}):`, error.message);
    throw error;
  }
}

/**
 * DELETE a Lead
 */
export async function deleteLead(id: string) {
  try {
    const { data: deletedLead, errors } =
      await cookiesClient.models.PropertyLead.delete({ id });
    if (errors) {
      throw new Error(errors.map((e: any) => e.message).join(', '));
    }
    return deletedLead;
  } catch (error: any) {
    console.error(`❌ deleteLead error (ID: ${id}):`, error.message);
    throw error;
  }
}

/**
 * 💥 5. NEW: Dedicated function to update GHL sync status 💥
 * This function is used by the GHL sync service to record the outcome.
 */
export async function updateLeadGhlStatus(
  leadId: string,
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED',
  ghlContactId?: string
) {
  const updateData: UpdateLeadInput = {
    id: leadId,
    ghlSyncStatus: status,
    ghlSyncDate: new Date().toISOString(),
  };

  if (ghlContactId) {
    updateData.ghlContactId = ghlContactId;
  }

  try {
    // Use the existing centralized updateLead function
    await updateLead(updateData);
    console.log(`[DB] Sync status updated for ${leadId}: ${status}`);
  } catch (error) {
    // Log, but do not throw, as the API call was already the point of failure
    console.error(`[DB] Failed to update sync status for ${leadId}:`, error);
  }
}
