import { cookiesClient } from '../auth/amplifyServerUtils.server';
import { type Schema } from '@/amplify/data/resource';

// --- Reusable Types ---
export type CreateLeadInput = Omit<
  Schema['PropertyLead']['type'],
  'id' | 'contacts' | 'enrichments' | 'activities' | 'createdAt' | 'updatedAt'
>;

export type UpdateLeadInput = Partial<CreateLeadInput> & {
  id: string;
};

// --- CRUD Functions ---

/**
 * LIST all leads for the current user
 */
export async function listLeads() {
  try {
    // 1. Fetch leads explicitly using User Pool auth
    // We removed the filter to ensure you see ALL your data
    const { data: leads, errors } =
      await cookiesClient.models.PropertyLead.list({
        authMode: 'userPool',
        limit: 1000,
      });

    if (errors) {
      console.error('❌ listLeads errors:', errors);
      throw new Error('Failed to fetch leads');
    }

    // 2. Sort by newest first (Handling potential nulls for TypeScript)
    return leads.sort((a, b) => {
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
export async function createLead(leadData: CreateLeadInput) {
  try {
    const { data: newLead, errors } =
      await cookiesClient.models.PropertyLead.create(leadData);
    if (errors) {
      throw new Error(errors.map((e: any) => e.message).join(', '));
    }
    return newLead;
  } catch (error: any) {
    console.error('❌ createLead error:', error.message);
    throw error;
  }
}

/**
 * GET a single Lead by ID
 */
export async function getLead(id: string) {
  try {
    const { data: lead, errors } = await cookiesClient.models.PropertyLead.get({
      id,
    });
    if (errors) {
      throw new Error(errors.map((e: any) => e.message).join(', '));
    }
    return lead;
  } catch (error: any) {
    console.error('❌ getLead error:', error.message);
    return null;
  }
}

/**
 * UPDATE an existing Lead
 */
export async function updateLead(leadData: UpdateLeadInput) {
  try {
    const { data: updatedLead, errors } =
      await cookiesClient.models.PropertyLead.update(leadData);
    if (errors) {
      throw new Error(errors.map((e: any) => e.message).join(', '));
    }
    return updatedLead;
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
