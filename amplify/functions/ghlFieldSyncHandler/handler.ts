import type { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dispositionAction } from '../shared/dispositions';
import { getIntegrationByLocationId } from '../shared/ghlTokenManager';
import { isInManualMode } from '../shared/ghlTags';
import {
  findConversationId,
  checkRecentActivity,
  activateManualMode,
} from '../shared/conversationActivity';

/** How far back a human outbound message still counts as an active takeover. */
const TAKEOVER_WINDOW_MINUTES = 120;

/**
 * Pause the AI when the agent has **called** this lead by hand.
 *
 * Scope note: this path catches calls, not texts. GHL fires the "Helper: Sync Custom Fields to App"
 * workflow when a custom field changes, and the account's own GHL automation increments
 * `Call Attempt or Text Counter` on **calls only** — a manual text moves no field and produces no
 * webhook here. (Verified against contact LmJHniQhqQcipgeQhNys: the counter held at 1 across every
 * field-sync webhook of the day, unchanged by a manual text.) Manual *texts* are caught separately,
 * by `wasLastOutboundHuman` in ghlWebhookHandler on the lead's next inbound message.
 *
 * That split is necessary rather than redundant: a phone call leaves no message in the
 * conversation at all, so the last-outbound test is structurally blind to it, and this counter
 * bump is the only signal available.
 *
 * The payload does not say which field changed, so this is treated purely as a "something happened
 * on this contact" ping and the conversation is then inspected. Ordered cheapest-first so routine
 * field changes cost no GHL API calls.
 */
async function detectManualCallTakeover(
  contactId: string,
  token: string,
  payloadTags: unknown,
  aiState: unknown
): Promise<boolean> {
  // Already paused — nothing to do, and no reason to spend API calls confirming it.
  if (isInManualMode(payloadTags)) return false;
  if (typeof aiState === 'string' && aiState.toLowerCase() === 'paused') return false;

  const conversationId = await findConversationId(contactId, token);
  if (!conversationId) return false;

  // Counts only human-sent outbound: this app's AI replies and GHL workflow sends are outbound
  // too, and treating those as a takeover would pause the agent on every conversation it answers.
  const activity = await checkRecentActivity(conversationId, token, TAKEOVER_WINDOW_MINUTES);
  if (!activity.hasRecentOutbound) return false;

  console.log(
    `🤚 [FIELD_SYNC] Human outbound at ${activity.lastOutboundTime} for ${contactId} — pausing AI`
  );
  await activateManualMode(contactId, token, 'Agent contacted the lead directly');
  return true;
}

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: Handler = async (event) => {
  try {
    const payload = JSON.parse(event.body || '{}');
    console.log('📦 [FIELD_SYNC] Full payload:', JSON.stringify(payload));
    const contactId = payload.contact_id || payload.contactId || payload.id;

    if (!contactId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing contact ID' }) };
    }

    // 🔒 Multi-tenant isolation: identify the account that fired this webhook from its
    // GHL location, and only ever touch that account's data. The payload's location.id
    // maps to exactly one connected integration (→ its Cognito userId).
    const locationId = payload.location?.id;
    const integration = locationId ? await getIntegrationByLocationId(locationId) : null;
    if (!integration) {
      console.log(`🚫 [FIELD_SYNC] Unknown/inactive location ${locationId} — ignoring`);
      return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Unknown location' }) };
    }

    // GHL's standard webhook payload includes every custom field keyed by its
    // display name — identical across all tenants (the field provisioner creates
    // these exact names). No per-account field IDs needed.
    const callAttempts  = payload['Call Attempt Counter'] ?? payload['Call Attempt or Text Counter'];
    const emailAttempts = payload['Email Attempt Counter'] ?? payload['email attempt counter'];
    const lastCallDate  = payload['Last Call Date'];
    const aiState       = payload['AI State'];
    const mailSentCount = payload['Mail Sent Count'];
    const callOutcome   = payload['Call Outcome'];

    console.log(`🔄 [FIELD_SYNC] contactId=${contactId}`, { callAttempts, emailAttempts, lastCallDate, aiState, mailSentCount, callOutcome });

    // 1. Try direct lookup by App Lead ID (fast, works for newly synced contacts)
    let lead: Record<string, any> | undefined;
    const appLeadId = payload['App Lead ID'] || payload['Lead Source Id'];
    if (appLeadId) {
      const get = await docClient.send(new GetCommand({
        TableName: process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME,
        Key: { id: appLeadId },
      }));
      lead = get.Item;
    }

    // 2. Fall back to scan by ghlContactId for older contacts
    if (!lead) {
      const scan = await docClient.send(new ScanCommand({
        TableName: process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME,
        FilterExpression: 'ghlContactId = :contactId',
        ExpressionAttributeValues: { ':contactId': contactId },
      }));
      lead = scan.Items?.[0];
    }

    if (!lead) {
      console.log(`⚠️ No PropertyLead found for contact ${contactId}`);
      return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Contact not found in app' }) };
    }

    // 🔒 Tenant guard: the resolved lead must belong to the account that fired the webhook.
    if (lead.owner !== integration.userId) {
      console.log(`🚫 [FIELD_SYNC] Lead ${lead.id} (owner ${lead.owner}) not owned by location ${locationId} (user ${integration.userId}) — ignoring`);
      return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Lead not owned by this location' }) };
    }

    // Pause the AI if the agent has called this lead by hand (texts are caught elsewhere — see the
    // note on detectManualCallTakeover). Best-effort: a failure here must not block the field sync
    // below, which is this handler's primary job.
    try {
      await detectManualCallTakeover(contactId, integration.token, payload.tags, aiState);
    } catch (takeoverErr: any) {
      console.error(`⚠️ [FIELD_SYNC] Manual-call takeover check failed for ${contactId}:`, takeoverErr?.message);
    }

    const outreachData: any = { ...(lead.ghlOutreachData || {}) };

    if (callAttempts  !== undefined && callAttempts  !== '') outreachData.smsAttempts  = parseInt(callAttempts)  || 0;
    if (emailAttempts !== undefined && emailAttempts !== '') outreachData.emailAttempts = parseInt(emailAttempts) || 0;
    if (lastCallDate)  outreachData.lastSmsSent  = lastCallDate;
    if (aiState)       outreachData.aiState      = aiState;
    if (mailSentCount !== undefined && mailSentCount !== '') outreachData.mailSentCount = parseInt(mailSentCount) || 0;
    if (callOutcome)   outreachData.callOutcome  = callOutcome;

    await docClient.send(new UpdateCommand({
      TableName: process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME,
      Key: { id: lead.id },
      UpdateExpression: 'SET ghlOutreachData = :data, updatedAt = :now',
      ExpressionAttributeValues: {
        ':data': outreachData,
        ':now': new Date().toISOString(),
      },
    }));

    console.log(`✅ [FIELD_SYNC] Updated PropertyLead ${lead.id}`);

    // Call dispositions affect email outreach. STOP (negative) opts the contact out;
    // ENGAGED (Appointment Set) pauses cold email as engaged. The email agent only sends
    // to OUTREACH-status items, so both halt the cadence.
    const action = dispositionAction(callOutcome);
    if (action !== 'NONE') {
      try {
        const { getQueueItemByContact, findQueueItemByContactId, updateQueueStatus, updateEmailStatus } =
          await import('../shared/outreachQueue');
        // Use the verified tenant userId (queue id is `${userId}_${contactId}`) for the
        // O(1) lookup — authoritative, not the payload's "App User ID". Fall back to the scan.
        const userId = integration.userId;
        let queueItem = await getQueueItemByContact(userId, contactId);
        if (!queueItem) queueItem = await findQueueItemByContactId(contactId);

        if (!queueItem?.id) {
          console.log(`ℹ️ [FIELD_SYNC] No queue item for ${contactId}; disposition "${callOutcome}" noted, nothing to stop`);
        } else if (action === 'STOP' && queueItem.queueStatus !== 'DND') {
          await updateQueueStatus(queueItem.id, 'DND', `Disposition: ${callOutcome}`);
          await updateEmailStatus(queueItem.id, 'OPTED_OUT');
          console.log(`🛑 [FIELD_SYNC] Stopped outreach for ${contactId} — disposition "${callOutcome}"`);
        } else if (action === 'ENGAGED' && queueItem.queueStatus !== 'DND' && queueItem.queueStatus !== 'CONVERSATION') {
          // Engaged (appointment booked): pause cold email but don't opt out.
          await updateQueueStatus(queueItem.id, 'CONVERSATION', `Disposition: ${callOutcome}`);
          console.log(`📅 [FIELD_SYNC] Paused outreach (engaged) for ${contactId} — disposition "${callOutcome}"`);
        }
      } catch (stopErr) {
        // Non-fatal: field sync already succeeded; don't fail the webhook.
        console.error(`⚠️ [FIELD_SYNC] Failed to update outreach for ${contactId}:`, stopErr);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Fields synced', contactId }) };

  } catch (error) {
    console.error('❌ [FIELD_SYNC] Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to process webhook' }) };
  }
};
