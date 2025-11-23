import { cookiesClient } from '../auth/amplifyServerUtils.server'; // Adjust path if needed
import { type Schema } from '@/amplify/data/resource'; // Adjust path if needed

// --- Reusable Types ---

// This type represents the data needed to CREATE a new lead
// It omits fields that are auto-generated or are relationships
type CreateLeadInput = Omit<
  Schema['Lead']['type'],
  | 'id'
  | 'contacts'
  | 'enrichments'
  | 'activities'
  | 'createdAt'
  | 'updatedAt'
  | 'owner'
>;

// This type represents the data needed to UPDATE a lead
// It requires the 'id' and makes all other fields optional
type UpdateLeadInput = Partial<CreateLeadInput> & {
  id: string;
};

// --- CRUD Functions ---

/**
 * ========================================================================
 * CREATE a new Lead
 * ========================================================================
 */
export async function createLead(leadData: CreateLeadInput) {
  try {
    // 'cookiesClient' automatically sets the 'owner' field
    const { data: newLead, errors } =
      await cookiesClient.models.Lead.create(leadData);
    if (errors) {
      const errorMessage = errors.map((e: any) => e.message).join(', ');
      console.error('❌ createLeadInDatabase database error:', errorMessage);
      throw new Error(errorMessage);
    }
    return newLead;
  } catch (error: any) {
    console.error('❌ createLead error:', error.message);
    throw error;
  }
}

/**
 * ========================================================================
 * READ a single Lead by its ID
 * ========================================================================
 */
export async function getLeadById(id: string) {
  try {
    // The 'owner' rule in your schema automatically protects this.
    // If the user doesn't own this lead, 'data' will be null.
    const { data: lead, errors } = await cookiesClient.models.Lead.get({ id });
    if (errors) {
      throw new Error(errors.map((e: any) => e.message).join(', '));
    }
    if (!lead) {
      throw new Error('Lead not found');
    }
    // 2. 👇 --- THIS IS THE FIX --- 👇
    // Get the related children by explicitly querying their models
    // where the 'leadId' matches our lead's 'id'.
    const { data: contacts, errors: contactsErrors } = await lead.contacts();

    const { data: enrichments, errors: enrichmentsErrors } =
      await lead.enrichments();

    const { data: activities, errors: activitiesErrors } =
      await lead.activities();
    // 👆 --- END OF FIX --- 👆

    if (contactsErrors || enrichmentsErrors || activitiesErrors) {
      throw new Error('Failed to fetch related lead data.');
    }

    // 3. Return the complete object
    return {
      ...lead,
      contacts,
      enrichments,
      activities,
    };
  } catch (error: any) {
    console.error(`❌ getLeadById error (ID: ${id}):`, error.message);
    throw error;
  }
}

/**
 * ========================================================================
 * READ all Leads (for the authenticated user)
 * ========================================================================
 */
export async function listLeads() {
  try {
    // 'owner' rule automatically filters. We sort by newest first.
    const { data: leads, errors } = await cookiesClient.models.Lead.list({
      filter: {
        createdAt: { lt: new Date().toISOString() },
      },
    });
    if (errors) {
      throw new Error(errors.map((e: any) => e.message).join(', '));
    }
    console.log(leads);
    return leads;
  } catch (error: any) {
    console.error('❌ listLeads error:', error.message);
    throw error;
  }
}

/**
 * ========================================================================
 * READ Leads filtered by status (as you requested)
 * ========================================================================
 */
export async function listLeadsByStatus(
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
) {
  try {
    // 'owner' rule is combined with our filter
    const { data: leads, errors } = await cookiesClient.models.Lead.list({
      filter: {
        skipTraceStatus: { eq: status },
      },
    });
    if (errors) {
      throw new Error(errors.map((e: any) => e.message).join(', '));
    }
    console.log(leads);
  } catch (error: any) {
    console.error(
      `❌ listLeadsByStatus error (Status: ${status}):`,
      error.message
    );
    throw error;
  }
}

/**
 * ========================================================================
 * UPDATE an existing Lead
 * ========================================================================
 */
export async function updateLead(leadData: UpdateLeadInput) {
  try {
    // 'owner' rule prevents updating other users' leads
    const { data: updatedLead, errors } =
      await cookiesClient.models.Lead.update(leadData);
    if (errors) {
      throw new Error(errors.map((e: any) => e.message).join(', '));
    }
    console.log(updateLead);
  } catch (error: any) {
    console.error(`❌ updateLead error (ID: ${leadData.id}):`, error.message);
    throw error;
  }
}

/**
 * ========================================================================
 * DELETE a Lead
 * ========================================================================
 */
export async function deleteLead(id: string) {
  try {
    // 'owner' rule prevents deleting other users' leads
    const { data: deletedLead, errors } =
      await cookiesClient.models.Lead.delete({ id });
    if (errors) {
      throw new Error(errors.map((e: any) => e.message).join(', '));
    }
    return deletedLead;
  } catch (error: any) {
    console.error(`❌ deleteLead error (ID: ${id}):`, error.message);
    throw error;
  }
}
