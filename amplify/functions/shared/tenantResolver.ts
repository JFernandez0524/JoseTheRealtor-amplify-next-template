/**
 * TENANT RESOLVER
 *
 * Resolves which tenant (Cognito userId / GHL integration) owns a given GHL contact, so
 * multi-tenant webhook handlers only ever read and write their own account's data.
 *
 * WHY: public webhook Function URLs (thanks.io, GHL, Facebook) receive events for *any*
 * connected account. Handlers must not fall back to "the first integration in the table" —
 * that grabs an arbitrary tenant's token and leaks data across accounts. Instead we resolve
 * ownership from our OWN records, which can never point at the wrong tenant:
 *   - PropertyLead stores the owning `owner` (Cognito userId) for every synced contact.
 *   - OutreachQueue stores `userId` for every queued contact (reused as a fallback).
 *
 * CALLERS: thanksIoWebhookHandler (delivery/scan updates).
 *
 * RELATED: ghlFieldSyncHandler resolves by `location.id` via getIntegrationByLocationId()
 * because its payload carries the location; thanks.io payloads only carry the GHL contact ID,
 * so we resolve by contact here.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { findQueueItemByContactId } from './outreachQueue';

const docClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION }),
  {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  },
);

const PROPERTY_LEAD_TABLE = process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME;

/**
 * Pick the single owning userId from a set of candidate records.
 *
 * Safety property: returns an owner ONLY when every candidate agrees on exactly one owner.
 * Zero matches, or conflicting owners (which would mean acting on the wrong tenant), return
 * null so the caller does nothing. Pure — unit tested in __tests__/shared/tenantResolver.test.ts.
 *
 * @param candidates records that matched the contact, each carrying an `owner` userId
 * @returns the sole owner userId, or null if there is none / it is ambiguous
 */
export function selectOwnerId(
  candidates: Array<{ owner?: string | null }>,
): string | null {
  const owners = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.owner) owners.add(candidate.owner);
  }
  if (owners.size !== 1) return null;
  const [only] = owners;
  return only ?? null;
}

/**
 * Resolve the owning Cognito userId for a GHL contact ID from our own records.
 *
 * Primary source is PropertyLead (every synced contact has a `ghlContactId` + `owner`);
 * OutreachQueue is a fallback for contacts that exist in the queue but not as a lead.
 *
 * Uses the `byGhlContactId` GSI for fast O(1) point lookups, with a graceful fallback
 * to a filtered Scan if the index is provisioning or not yet populated.
 *
 * @param contactId GHL contact ID from the webhook payload
 * @returns the owning userId, or null if the contact can't be attributed to a single tenant
 */
export async function resolveOwnerByGhlContactId(
  contactId: string,
): Promise<string | null> {
  if (!contactId) return null;

  // 1. Primary: Fast O(1) GSI query on PropertyLead.byGhlContactId
  try {
    const { Items } = await docClient.send(
      new QueryCommand({
        TableName: PROPERTY_LEAD_TABLE,
        IndexName: 'byGhlContactId',
        KeyConditionExpression: 'ghlContactId = :contactId',
        ProjectionExpression: '#owner, ghlContactId',
        ExpressionAttributeNames: { '#owner': 'owner' },
        ExpressionAttributeValues: { ':contactId': contactId },
      }),
    );

    if (Items && Items.length > 0) {
      const owner = selectOwnerId(Items as Array<{ owner?: string | null }>);
      if (owner) return owner;
    }
  } catch (gsiErr: any) {
    // If GSI query fails (e.g. index provisioning in local/test or table transition), fallback to scan
    console.warn('⚠️ [TENANT_RESOLVER] GSI query fallback to scan:', gsiErr.message);
    const matches: Array<{ owner?: string | null }> = [];
    let lastKey: Record<string, any> | undefined;
    do {
      const { Items, LastEvaluatedKey } = await docClient.send(
        new ScanCommand({
          TableName: PROPERTY_LEAD_TABLE,
          FilterExpression: 'ghlContactId = :contactId',
          ProjectionExpression: '#owner, ghlContactId',
          ExpressionAttributeNames: { '#owner': 'owner' },
          ExpressionAttributeValues: { ':contactId': contactId },
          ExclusiveStartKey: lastKey,
        }),
      );
      if (Items) matches.push(...(Items as Array<{ owner?: string | null }>));
      lastKey = LastEvaluatedKey;
    } while (lastKey);

    const owner = selectOwnerId(matches);
    if (owner) return owner;
  }

  // Fallback: the OutreachQueue also maps contactId → userId.
  const queueItem = await findQueueItemByContactId(contactId);
  return queueItem?.userId ?? null;
}
