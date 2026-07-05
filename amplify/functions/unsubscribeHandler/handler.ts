/**
 * UNSUBSCRIBE HANDLER - Lambda (public Function URL)
 *
 * Honors a contact's email unsubscribe request (CAN-SPAM: instant, no login required).
 * Fronted by the thin proxy at app/api/v1/unsubscribe/route.ts, which the /unsubscribe page POSTs to.
 *
 * WHY A LAMBDA: unsubscribe clicks are anonymous, and the request must read/write across tenants
 * (GhlIntegration, OutreachQueue, PropertyLead are all owner-scoped in AppSync). The Next.js SSR
 * runtime has neither the DynamoDB table names nor IAM to do this; Lambdas do. See the plan/CLAUDE.md.
 *
 * MULTI-TENANT SAFETY: we never guess a tenant. resolveOwnerByGhlContactId() attributes the contact
 * to its owner from our own records; if it can't, we no-op rather than touch the wrong account.
 *
 * INPUT (JSON body):  { contactId: string, email?: string }
 * OUTPUT (JSON body): { success: boolean, message?: string, error?: string }
 */

import type { Handler } from 'aws-lambda';
import { resolveOwnerByGhlContactId } from '../shared/tenantResolver';
import { getValidGhlToken } from '../shared/ghlTokenManager';
import { ghlAddTags, ghlUpdateContact } from '../shared/ghlClient';
import { getQueueItemByContact, findQueueItemByContactId, updateEmailStatus } from '../shared/outreachQueue';

export const handler: Handler = async (event) => {
  try {
    const { contactId } = JSON.parse(event.body || '{}');

    if (!contactId) {
      return json(400, { success: false, error: 'Contact ID is required' });
    }

    // Resolve the owning tenant from our own records (multi-tenant safe).
    const userId = await resolveOwnerByGhlContactId(contactId);
    if (!userId) {
      // Unknown contact: nothing to unsubscribe, and we must never act on a guessed tenant.
      console.log(`ℹ️ [UNSUBSCRIBE] No owner found for contact ${contactId} — no-op`);
      return json(200, { success: true, message: 'Already unsubscribed or unknown contact' });
    }

    const tokenData = await getValidGhlToken(userId);
    if (!tokenData) {
      console.error(`❌ [UNSUBSCRIBE] No valid GHL token for user ${userId}`);
      return json(500, { success: false, error: 'Failed to retrieve GHL token' });
    }
    const { token } = tokenData;

    // 1. Tag the contact as unsubscribed in GHL.
    await ghlAddTags(token, contactId, ['unsubscribed', 'email:opted-out']);

    // 2. Block further emails via GHL DND settings.
    await ghlUpdateContact(token, contactId, {
      dndSettings: { Email: { status: 'active', message: 'Contact unsubscribed from emails' } },
    });

    // 3. Stop our own outreach cadence for this contact. Try the O(1) key lookup first, then
    // fall back to a scan — queue rows are keyed `${userId}_${contactId}_<email>`, so the
    // key-only lookup misses email-bearing rows (same fallback pattern as ghlFieldSyncHandler).
    let queueItem = await getQueueItemByContact(userId, contactId);
    if (!queueItem) queueItem = await findQueueItemByContactId(contactId);
    if (queueItem?.id) {
      await updateEmailStatus(queueItem.id, 'OPTED_OUT');
    }

    console.log(`✅ [UNSUBSCRIBE] Contact ${contactId} unsubscribed for user ${userId}`);
    return json(200, { success: true, message: 'Successfully unsubscribed' });
  } catch (error: any) {
    console.error('❌ [UNSUBSCRIBE] Error:', error?.response?.data || error?.message || error);
    return json(500, { success: false, error: 'Failed to process unsubscribe request' });
  }
};

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
