import { cookiesClient, AuthGetCurrentUserServer } from '../auth/amplifyServerUtils.server';
import { type Schema } from '../../../../amplify/data/resource';
// 💥 NEW: Import DynamoDB client for use in Lambda environment
import { ddbDocClient } from './dynamoClient.server';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Use DynamoDB direct access for reliable server-side mutations across SSR and Lambdas.
const PROPERTY_LEAD_TABLE_NAME =
  process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME || 'PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

// --- Reusable Types ---

// Define the full union of all valid Skip Trace Statuses
export type SkipTraceStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'NO_MATCH'
  | 'NOT_FOUND'
  | 'NOT_AUTHORIZED'
  | 'INVALID_DATA'
  | 'NOT_ELIGIBLE';

// 💥 1. Extend the PropertyLead type to include the new GHL status fields
export type DBLead = Schema['PropertyLead']['type'] & {
  ghlSyncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  ghlContactId?: string | null;
  ghlSyncDate?: string | null; // ISO Date string of last sync attempt
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

// Define a type for the updateable lead properties (all keys EXCEPT 'id')
type UpdatableLeadKeys = Exclude<keyof UpdateLeadInput, 'id'>;

// 💥 2. Update UpdateLeadInput to accept the new GHL status fields
export type UpdateLeadInput = Partial<BaseLeadInput> & {
  id: string;
  skipTraceStatus?: SkipTraceStatus | null;
  ghlSyncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  ghlContactId?: string | null;
  ghlSyncDate?: string | null;
};

// --- CRUD Functions ---

/**
 * LIST all leads for the current user
 * NOTE: Not refactored to DynamoDB, relies on Amplify client.
 */
export async function listLeads(): Promise<DBLead[]> {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) return [];

    // 1. Fetch leads explicitly using User Pool auth
    const { data: leads, errors } =
      await cookiesClient.models.PropertyLead.list({
        authMode: 'userPool',
        filter: { owner: { eq: user.userId } },
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
 * NOTE: Not refactored to DynamoDB, relies on Amplify client.
 */
export async function createLead(leadData: CreateLeadInput): Promise<DBLead> {
  try {
    const { data: newLead, errors } =
      await cookiesClient.models.PropertyLead.create(leadData);
    if (errors) {
      console.error('❌ createLead GraphQL errors:', JSON.stringify(errors, null, 2));
      throw new Error(errors.map((e: any) => e.message).join(', '));
    }
    return newLead as DBLead;
  } catch (error: any) {
    console.error('❌ createLead error:', error.message);
    throw error;
  }
}

/**
 * GET a single Lead by ID (HYBRID IMPLEMENTATION)
 * 💥 3. Updated return type and casting
 */
export async function getLead(id: string): Promise<DBLead | null> {
  try {
    // 1. Try cookiesClient (Next.js SSR / API Route authenticated client)
    try {
      const { data: lead, errors } = await cookiesClient.models.PropertyLead.get({ id });
      if (!errors && lead) {
        return lead as DBLead;
      }
    } catch {
      // Outside request cookie context (e.g. standalone Lambda) — fall through to DynamoDB
    }

    // 2. DynamoDB direct access (for Lambda execution with IAM role)
    const command = new GetCommand({
      TableName: PROPERTY_LEAD_TABLE_NAME,
      Key: { id },
    });
    const { Item } = await ddbDocClient.send(command);
    if (!Item) {
      console.warn(`⚠️ Lead not found: ${id}`);
    }
    return (Item as DBLead) || null;
  } catch (error: any) {
    console.error(`❌ getLead error for ${id}:`, error.message);
    return null;
  }
}

/**
 * GET multiple Leads by IDs
 */
export async function getLeadsByIds(ids: string[]): Promise<DBLead[]> {
  try {
    const leads = await Promise.all(ids.map(id => getLead(id)));
    const validLeads = leads.filter((lead): lead is DBLead => lead !== null);
    
    if (validLeads.length < ids.length) {
      const failedIds = ids.filter((id, index) => leads[index] === null);
      console.warn(`⚠️ Failed to fetch ${failedIds.length} leads:`, failedIds);
    }
    
    return validLeads;
  } catch (error: any) {
    console.error('❌ getLeadsByIds error:', error.message);
    return [];
  }
}

/**
 * UPDATE an existing Lead (HYBRID IMPLEMENTATION)
 * 💥 4. Updated return type and casting
 */
export async function updateLead(leadData: UpdateLeadInput): Promise<DBLead> {
  try {
    // 1. Try cookiesClient (Next.js SSR / API Route path)
    try {
      const { data: updatedLead, errors } =
        await cookiesClient.models.PropertyLead.update(leadData);
      if (!errors && updatedLead) {
        return updatedLead as DBLead;
      }
    } catch {
      // Outside request cookie context (e.g. standalone Lambda) — fall through to DynamoDB
    }

    // 2. DynamoDB direct access (for Lambda execution with IAM role)
    const { id, ...attributesToUpdate } = leadData;

    let UpdateExpression = 'set ';
    const ExpressionAttributeValues: Record<string, any> = {};
    const ExpressionAttributeNames: Record<string, string> = {};

    const keys = Object.keys(attributesToUpdate) as UpdatableLeadKeys[];

    for (const key of keys) {
      const value = attributesToUpdate[key];
      if (value !== undefined) {
        const attributeKey = key as string;
        UpdateExpression += `#${attributeKey} = :${attributeKey}, `;
        ExpressionAttributeNames[`#${attributeKey}`] = attributeKey;
        ExpressionAttributeValues[`:${attributeKey}`] = value;
      }
    }
    UpdateExpression = UpdateExpression.slice(0, -2); // Remove trailing comma and space

    if (Object.keys(ExpressionAttributeValues).length === 0) {
      throw new Error('No valid fields provided for update.');
    }

    const command = new UpdateCommand({
      TableName: PROPERTY_LEAD_TABLE_NAME,
      Key: { id },
      UpdateExpression,
      ExpressionAttributeValues,
      ExpressionAttributeNames,
      ReturnValues: 'ALL_NEW',
    });
    const { Attributes } = await ddbDocClient.send(command);
    return Attributes as DBLead;
  } catch (error: any) {
    console.error(`❌ updateLead error (ID: ${leadData.id}):`, error.message);
    throw error;
  }
}

/**
 * DELETE a Lead
 * NOTE: Not refactored to DynamoDB, relies on Amplify client.
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

/**
 * Mark lead with validation errors
 */
export async function markLeadAsInvalid(leadId: string, errors: string[]) {
  return updateLead({
    id: leadId,
    validationStatus: 'INVALID',
    validationErrors: errors,
  });
}

/**
 * Get leads by owner (user ID)
 */
export async function getLeadsByOwner(ownerId: string): Promise<DBLead[]> {
  try {
    const { data: leads, errors } = await cookiesClient.models.PropertyLead.list({
      filter: { owner: { eq: ownerId } },
      authMode: 'userPool',
    });

    if (errors) {
      console.error('❌ getLeadsByOwner errors:', errors);
      return [];
    }

    return (leads as DBLead[]).sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  } catch (error: any) {
    console.error('❌ getLeadsByOwner error:', error.message);
    return [];
  }
}

/**
 * Get invalid leads (for admin review)
 */
export async function getInvalidLeads(): Promise<DBLead[]> {
  try {
    const { data: leads, errors } = await cookiesClient.models.PropertyLead.list({
      filter: { validationStatus: { eq: 'INVALID' } },
      authMode: 'userPool',
    });

    if (errors) {
      console.error('❌ getInvalidLeads errors:', errors);
      return [];
    }

    return leads as DBLead[];
  } catch (error: any) {
    console.error('❌ getInvalidLeads error:', error.message);
    return [];
  }
}
