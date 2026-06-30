import type { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dispositionAction } from '../shared/dispositions';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: Handler = async (event) => {
  try {
    const payload = JSON.parse(event.body || '{}');
    console.log('📦 [FIELD_SYNC] Full payload:', JSON.stringify(payload));
    const contactId = payload.contact_id || payload.contactId || payload.id;

    if (!contactId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing contact ID' }) };
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
        // Prefer the O(1) key lookup (queue id is `${userId}_${contactId}`); the payload
        // carries the user id as "App User ID". Fall back to the scan if it's absent.
        const userId = payload['App User ID'];
        let queueItem = userId ? await getQueueItemByContact(userId, contactId) : null;
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
