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
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { findQueueItemByContactId } from './outreachQueue';

const docClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION }),
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
 * NOTE: DynamoDB `Limit` caps rows scanned BEFORE the FilterExpression is applied, so it must
 * NOT be combined with a filter (a `Limit: 1` scan would check only the first table row and
 * almost always miss). We paginate until matches are found — same pattern as
 * findQueueItemByContactId().
 *
 * @param contactId GHL contact ID from the webhook payload
 * @returns the owning userId, or null if the contact can't be attributed to a single tenant
 */
export async function resolveOwnerByGhlContactId(
  contactId: string,
): Promise<string | null> {
  if (!contactId) return null;

  const matches: Array<{ owner?: string | null }> = [];
  let lastKey: Record<string, any> | undefined;
  do {
    const { Items, LastEvaluatedKey } = await docClient.send(
      new ScanCommand({
        TableName: PROPERTY_LEAD_TABLE,
        FilterExpression: 'ghlContactId = :contactId',
        ExpressionAttributeValues: { ':contactId': contactId },
        ExclusiveStartKey: lastKey,
      }),
    );
    if (Items) matches.push(...(Items as Array<{ owner?: string | null }>));
    lastKey = LastEvaluatedKey;
  } while (lastKey);

  const owner = selectOwnerId(matches);
  if (owner) return owner;

  // Fallback: the OutreachQueue also maps contactId → userId.
  const queueItem = await findQueueItemByContactId(contactId);
  return queueItem?.userId ?? null;
}
