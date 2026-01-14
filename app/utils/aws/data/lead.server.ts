import { cookiesClient } from '../auth/amplifyServerUtils.server';
import { type Schema } from '../../../../amplify/data/resource';
// 💥 NEW: Import DynamoDB client for use in Lambda environment
import { ddbDocClient } from './dynamoClient.server';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Check if we are running inside an AWS Lambda environment
const IS_LAMBDA_CONTEXT =
  !!process.env.AWS_REGION && !!process.env.LAMBDA_TASK_ROOT;
// 🛑 IMPORTANT: Replace this with the actual environment variable name for your DynamoDB table
const PROPERTY_LEAD_TABLE_NAME =
  process.env.AMPLIFY_DATA_LEAD_TABLE_NAME || 'PropertyLead_Default_Table';

// --- Reusable Types ---

// Define the full union of all valid Skip Trace Statuses
export type SkipTraceStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'NO_MATCH'
  | 'NOT_FOUND'
  | 'NOT_AUTHORIZED'
  | 'INVALID_DATA';

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
 * NOTE: Not refactored to DynamoDB, relies on Amplify client.
 */
export async function createLead(leadData: CreateLeadInput): Promise<DBLead> {
  try {
    const { data: newLead, errors } =
      await cookiesClient.models.PropertyLead.create(leadData);
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
 * GET a single Lead by ID (HYBRID IMPLEMENTATION)
 * 💥 3. Updated return type and casting
 */
export async function getLead(id: string): Promise<DBLead | null> {
  try {
    if (IS_LAMBDA_CONTEXT) {
      // 🛑 LAMBDA / DYNAMODB IMPLEMENTATION
      console.log(`[DB] Using DynamoDB client for fetch: ${id}`);
      const command = new GetCommand({
        TableName: PROPERTY_LEAD_TABLE_NAME,
        Key: { id },
      });
      const { Item } = await ddbDocClient.send(command);
      return (Item as DBLead) || null;
    } else {
      // ✅ NEXT.JS / AMPLIFY IMPLEMENTATION
      console.log(`[DB] Using cookiesClient for fetch: ${id}`);
      const { data: lead, errors } =
        await cookiesClient.models.PropertyLead.get({
          id,
        });
      if (errors) {
        throw new Error(errors.map((e: any) => e.message).join(', '));
      }
      return lead as DBLead;
    }
  } catch (error: any) {
    console.error('❌ getLead error:', error.message);
    return null;
  }
}

/**
 * GET multiple Leads by IDs
 */
export async function getLeadsByIds(ids: string[]): Promise<DBLead[]> {
  try {
    const leads = await Promise.all(ids.map(id => getLead(id)));
    return leads.filter((lead): lead is DBLead => lead !== null);
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
    if (IS_LAMBDA_CONTEXT) {
      // 🛑 LAMBDA / DYNAMODB IMPLEMENTATION
      const { id, ...attributesToUpdate } = leadData;

      let UpdateExpression = 'set ';
      const ExpressionAttributeValues: Record<string, any> = {};

      // 💥 NEW: We need ExpressionAttributeNames to map the alias (#name) to the actual attribute name (name)
      const ExpressionAttributeNames: Record<string, string> = {};

      const keys = Object.keys(attributesToUpdate) as UpdatableLeadKeys[];

      for (const key of keys) {
        const value = attributesToUpdate[key];
        if (value !== undefined) {
          const attributeKey = key as string;

          // 1. Alias the name with '#' for the UpdateExpression
          UpdateExpression += `#${attributeKey} = :${attributeKey}, `;

          // 2. Map the alias (#attributeKey) to the real attribute name
          ExpressionAttributeNames[`#${attributeKey}`] = attributeKey;

          // 3. Set the value
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
        ExpressionAttributeNames, // 💥 ADD THIS OBJECT TO THE COMMAND
        ReturnValues: 'ALL_NEW',
      });
      const { Attributes } = await ddbDocClient.send(command);
      return Attributes as DBLead;
    } else {
      // ✅ NEXT.JS / AMPLIFY IMPLEMENTATION
      const { data: updatedLead, errors } =
        await cookiesClient.models.PropertyLead.update(leadData);
      if (errors) {
        throw new Error(errors.map((e: any) => e.message).join(', '));
      }
      return updatedLead as DBLead;
    }
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
