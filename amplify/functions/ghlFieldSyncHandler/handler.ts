import type { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CUSTOM_FIELD_IDS = {
  CALL_ATTEMPT_COUNTER: '0MD4Pp2LCyOSCbCjA5qF',
  EMAIL_ATTEMPT_COUNTER: 'wWlrXoXeMXcM6kUexf2L',
  LAST_CALL_DATE: 'dWNGeSckpRoVUxXLgxMj',
  AI_STATE: '1NxQW2kKMVgozjSUuu7s',
  MAIL_SENT_COUNT: 'DTEW0PLqxp35WHOiDLWR',
  CALL_OUTCOME: 'LNyfm5JDal955puZGbu3'
};

export const handler: Handler = async (event) => {
  try {
    const payload = JSON.parse(event.body || '{}');
    console.log('🔄 [GHL_SYNC] Received webhook');

    const contactId = payload.contact_id || payload.contactId || payload.id;

    if (!contactId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing contact ID' })
      };
    }

    // Check if this is a disposition webhook (has Call Outcome)
    const callOutcome = payload['Call Outcome'] || payload[CUSTOM_FIELD_IDS.CALL_OUTCOME];
    
    if (callOutcome) {
      console.log('📞 [DISPOSITION] Processing call outcome:', callOutcome);
      return await handleDisposition(payload, contactId, callOutcome);
    }

    // Otherwise, handle as field sync
    return await handleFieldSync(payload, contactId);

  } catch (error) {
    console.error('❌ [GHL_SYNC] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process webhook' })
    };
  }
};

async function handleFieldSync(payload: any, contactId: string) {
  try {
    // Extract custom field values (GHL sends as human-readable names)
    const callAttempts = payload['Call Attempt or Text Counter'] || payload[CUSTOM_FIELD_IDS.CALL_ATTEMPT_COUNTER];
    const emailAttempts = payload['email attempt counter'] || payload[CUSTOM_FIELD_IDS.EMAIL_ATTEMPT_COUNTER];
    const lastCallDate = payload['Last Call Date'] || payload[CUSTOM_FIELD_IDS.LAST_CALL_DATE];
    const aiState = payload['AI State'] || payload[CUSTOM_FIELD_IDS.AI_STATE];
    const mailSentCount = payload['Mail Sent Count'] || payload[CUSTOM_FIELD_IDS.MAIL_SENT_COUNT];
    const callOutcome = payload['Call Outcome'] || payload[CUSTOM_FIELD_IDS.CALL_OUTCOME];

    console.log('🔄 [FIELD_SYNC] Extracted:', { contactId, callAttempts, emailAttempts, lastCallDate, aiState, callOutcome });

    // Find PropertyLead by ghlContactId
    const scanResult = await docClient.send(new ScanCommand({
      TableName: process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME,
      FilterExpression: 'ghlContactId = :contactId',
      ExpressionAttributeValues: {
        ':contactId': contactId
      },
      Limit: 1
    }));

    if (!scanResult.Items || scanResult.Items.length === 0) {
      console.log(`⚠️ [FIELD_SYNC] No PropertyLead found for contact ${contactId}`);
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Contact not found in app' })
      };
    }

    const lead = scanResult.Items[0];
    const currentOutreachData = lead.ghlOutreachData || {};

    // Build updated outreach data
    const updatedOutreachData: any = { ...currentOutreachData };

    if (callAttempts !== undefined && callAttempts !== '') {
      updatedOutreachData.smsAttempts = parseInt(callAttempts) || 0;
    }
    if (emailAttempts !== undefined && emailAttempts !== '') {
      updatedOutreachData.emailAttempts = parseInt(emailAttempts) || 0;
    }
    if (lastCallDate) {
      updatedOutreachData.lastSmsSent = lastCallDate;
    }
    if (aiState) {
      updatedOutreachData.aiState = aiState;
    }
    if (mailSentCount !== undefined && mailSentCount !== '') {
      updatedOutreachData.mailSentCount = parseInt(mailSentCount) || 0;
    }
    if (callOutcome) {
      updatedOutreachData.callOutcome = callOutcome;
    }

    // Update PropertyLead
    await docClient.send(new UpdateCommand({
      TableName: process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME,
      Key: { id: lead.id },
      UpdateExpression: 'SET ghlOutreachData = :data, updatedAt = :now',
      ExpressionAttributeValues: {
        ':data': updatedOutreachData,
        ':now': new Date().toISOString()
      }
    }));

    console.log(`✅ [FIELD_SYNC] Updated PropertyLead ${lead.id}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Custom fields synced',
        contactId
      })
    };
  } catch (error) {
    console.error('❌ [FIELD_SYNC] Error:', error);
    throw error;
  }
}

async function handleDisposition(payload: any, contactId: string, callOutcome: string) {
  console.log(`📞 [DISPOSITION] Call outcome: ${callOutcome}`);

  const STOP_DISPOSITIONS = [
    'Not Interested',
    'Incorrect Number',
    'Wrong Number / Disconnected / Invalid Number',
    'Listed With Realtor',
    'Sold Already',
    'DNC'
  ];

  // Update PropertyLead with call outcome
  const scanResult = await docClient.send(new ScanCommand({
    TableName: process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME,
    FilterExpression: 'ghlContactId = :contactId',
    ExpressionAttributeValues: {
      ':contactId': contactId
    },
    Limit: 1
  }));

  if (scanResult.Items && scanResult.Items.length > 0) {
    const lead = scanResult.Items[0];
    const currentOutreachData = lead.ghlOutreachData || {};

    await docClient.send(new UpdateCommand({
      TableName: process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME,
      Key: { id: lead.id },
      UpdateExpression: 'SET ghlOutreachData = :data, updatedAt = :now',
      ExpressionAttributeValues: {
        ':data': {
          ...currentOutreachData,
          callOutcome,
          smsStatus: STOP_DISPOSITIONS.includes(callOutcome) ? 'OPTED_OUT' : currentOutreachData.smsStatus,
          emailStatus: STOP_DISPOSITIONS.includes(callOutcome) ? 'OPTED_OUT' : currentOutreachData.emailStatus
        },
        ':now': new Date().toISOString()
      }
    }));

    console.log(`✅ [DISPOSITION] Updated PropertyLead ${lead.id}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: 'Disposition recorded',
      contactId,
      disposition: callOutcome
    })
  };
}
