import type { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const FIELD_IDS = {
  CALL_ATTEMPT_COUNTER: '0MD4Pp2LCyOSCbCjA5qF',
  EMAIL_ATTEMPT_COUNTER: 'wWlrXoXeMXcM6kUexf2L',
  LAST_CALL_DATE: 'dWNGeSckpRoVUxXLgxMj',
  AI_STATE: '1NxQW2kKMVgozjSUuu7s',
  MAIL_SENT_COUNT: 'DTEW0PLqxp35WHOiDLWR',
  CALL_OUTCOME: 'LNyfm5JDal955puZGbu3',
};

export const handler: Handler = async (event) => {
  try {
    const payload = JSON.parse(event.body || '{}');
    console.log('📦 [FIELD_SYNC] Full payload:', JSON.stringify(payload));
    const contactId = payload.contact_id || payload.contactId || payload.id;

    if (!contactId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing contact ID' }) };
    }

    const callAttempts  = payload['Call Attempt or Text Counter'] ?? payload[FIELD_IDS.CALL_ATTEMPT_COUNTER];
    const emailAttempts = payload['email attempt counter']        ?? payload[FIELD_IDS.EMAIL_ATTEMPT_COUNTER];
    const lastCallDate  = payload['Last Call Date']               ?? payload[FIELD_IDS.LAST_CALL_DATE];
    const aiState       = payload['AI State']                     ?? payload[FIELD_IDS.AI_STATE];
    const mailSentCount = payload['Mail Sent Count']              ?? payload[FIELD_IDS.MAIL_SENT_COUNT];
    const callOutcome   = payload['Call Outcome']                 ?? payload[FIELD_IDS.CALL_OUTCOME];

    console.log(`🔄 [FIELD_SYNC] contactId=${contactId}`, { callAttempts, emailAttempts, lastCallDate, aiState, mailSentCount, callOutcome });

    const scan = await docClient.send(new ScanCommand({
      TableName: process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME,
      FilterExpression: 'ghlContactId = :contactId',
      ExpressionAttributeValues: { ':contactId': contactId },
    }));

    if (!scan.Items?.length) {
      console.log(`⚠️ No PropertyLead found for contact ${contactId}`);
      return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Contact not found in app' }) };
    }

    const lead = scan.Items[0];
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
    return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Fields synced', contactId }) };

  } catch (error) {
    console.error('❌ [FIELD_SYNC] Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to process webhook' }) };
  }
};
