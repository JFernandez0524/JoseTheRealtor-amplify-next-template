/**
 * GHL Custom Field Sync Webhook
 * 
 * Syncs manual changes to GHL custom fields back to the app
 * 
 * Trigger: GHL Workflow → Contact Custom Field Updated
 * 
 * Synced Fields:
 * - call_attempt_counter (0MD4Pp2LCyOSCbCjA5qF) → ghlOutreachData.smsAttempts
 * - email_attempt_counter (wWlrXoXeMXcM6kUexf2L) → ghlOutreachData.emailAttempts
 * - last_call_date (dWNGeSckpRoVUxXLgxMj) → ghlOutreachData.lastSmsSent
 * - AI state (1NxQW2kKMVgozjSUuu7s) → ghlOutreachData.aiState
 * - mail_sent_count (DTEW0PLqxp35WHOiDLWR) → ghlOutreachData.mailSentCount
 */

import { NextResponse } from 'next/server';
import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { updateSmsStatus, updateEmailStatus, findQueueItemByContactId } from '@/amplify/functions/shared/outreachQueue';

const CUSTOM_FIELD_IDS = {
  CALL_ATTEMPT_COUNTER: '0MD4Pp2LCyOSCbCjA5qF',
  EMAIL_ATTEMPT_COUNTER: 'wWlrXoXeMXcM6kUexf2L',
  LAST_CALL_DATE: 'dWNGeSckpRoVUxXLgxMj',
  AI_STATE: '1NxQW2kKMVgozjSUuu7s',
  MAIL_SENT_COUNT: 'DTEW0PLqxp35WHOiDLWR',
  CALL_OUTCOME: 'LNyfm5JDal955puZGbu3'
};

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('🔄 [FIELD_SYNC] Received webhook:', JSON.stringify(payload, null, 2));

    // GHL sends contact.id at root level or in custom data
    const contactId = payload.contactId || payload.id;

    if (!contactId) {
      return NextResponse.json({ error: 'Missing contact ID' }, { status: 400 });
    }

    // Extract custom field values (GHL sends as root-level properties)
    const callAttempts = payload[CUSTOM_FIELD_IDS.CALL_ATTEMPT_COUNTER];
    const emailAttempts = payload[CUSTOM_FIELD_IDS.EMAIL_ATTEMPT_COUNTER];
    const lastCallDate = payload[CUSTOM_FIELD_IDS.LAST_CALL_DATE];
    const aiState = payload[CUSTOM_FIELD_IDS.AI_STATE];
    const mailSentCount = payload[CUSTOM_FIELD_IDS.MAIL_SENT_COUNT];
    const callOutcome = payload[CUSTOM_FIELD_IDS.CALL_OUTCOME];

    console.log('🔄 [FIELD_SYNC] Extracted values:', {
      contactId,
      callAttempts,
      emailAttempts,
      lastCallDate,
      aiState,
      mailSentCount,
      callOutcome
      lastCallDate,
      aiState,
      mailSentCount
    });

    // Find PropertyLead by ghlContactId
    const { data: leads } = await cookiesClient.models.PropertyLead.list({
      filter: { ghlContactId: { eq: contactId } }
    });

    if (!leads || leads.length === 0) {
      console.log(`⚠️ [FIELD_SYNC] No PropertyLead found for contact ${contactId}`);
      return NextResponse.json({ success: true, message: 'Contact not found in app' });
    }

    const lead = leads[0];
    const currentOutreachData = (lead.ghlOutreachData as any) || {};

    // Build updated outreach data
    const updatedOutreachData: any = { ...currentOutreachData };

    if (callAttempts !== undefined) {
      updatedOutreachData.smsAttempts = parseInt(callAttempts) || 0;
    }
    if (emailAttempts !== undefined) {
      updatedOutreachData.emailAttempts = parseInt(emailAttempts) || 0;
    }
    if (lastCallDate) {
      updatedOutreachData.lastSmsSent = lastCallDate;
    }
    if (aiState) {
      updatedOutreachData.aiState = aiState;
    }
    if (mailSentCount !== undefined) {
      updatedOutreachData.mailSentCount = parseInt(mailSentCount) || 0;
    }
    if (callOutcome) {
      updatedOutreachData.callOutcome = callOutcome;
    }

    // Update PropertyLead
    await cookiesClient.models.PropertyLead.update({
      id: lead.id,
      ghlOutreachData: updatedOutreachData
    });

    console.log(`✅ [FIELD_SYNC] Updated PropertyLead ${lead.id}`);

    // Also update OutreachQueue if attempts changed
    if (callAttempts !== undefined || emailAttempts !== undefined) {
      try {
        const queueItem = await findQueueItemByContactId(contactId);
        
        if (queueItem) {
          const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
          const { DynamoDBDocumentClient, UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
          
          const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
          const docClient = DynamoDBDocumentClient.from(dynamoClient);
          
          const queueId = `${queueItem.userId}_${contactId}`;
          const updateExpression: string[] = [];
          const expressionValues: any = { ':now': new Date().toISOString() };
          
          if (callAttempts !== undefined) {
            updateExpression.push('smsAttempts = :smsAttempts');
            expressionValues[':smsAttempts'] = parseInt(callAttempts) || 0;
          }
          if (emailAttempts !== undefined) {
            updateExpression.push('emailAttempts = :emailAttempts');
            expressionValues[':emailAttempts'] = parseInt(emailAttempts) || 0;
          }
          
          if (updateExpression.length > 0) {
            await docClient.send(new UpdateCommand({
              TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME,
              Key: { id: queueId },
              UpdateExpression: `SET ${updateExpression.join(', ')}, updatedAt = :now`,
              ExpressionAttributeValues: expressionValues
            }));
            
            console.log(`✅ [FIELD_SYNC] Updated OutreachQueue for ${contactId}`);
          }
        }
      } catch (queueError) {
        console.error(`⚠️ [FIELD_SYNC] Failed to update queue:`, queueError);
        // Don't fail webhook if queue update fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Custom fields synced',
      contactId,
      updated: Object.keys(updatedOutreachData)
    });

  } catch (error) {
    console.error('❌ [FIELD_SYNC] Webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to sync custom fields' },
      { status: 500 }
    );
  }
}
