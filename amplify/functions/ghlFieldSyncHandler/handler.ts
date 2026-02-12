import type { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getValidGhlToken } from '../shared/ghlTokenManager';
import axios from 'axios';

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

  // Find the OutreachQueue item for this contact
  const queueScan = await docClient.send(new ScanCommand({
    TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME,
    FilterExpression: 'contactId = :contactId',
    ExpressionAttributeValues: {
      ':contactId': contactId
    }
  }));

  if (!queueScan.Items || queueScan.Items.length === 0) {
    console.log(`⚠️ [DISPOSITION] No OutreachQueue item found for contact ${contactId}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Contact not in queue' })
    };
  }

  const queueItem = queueScan.Items[0];
  const userId = queueItem.userId;
  const leadId = queueItem.leadId;
  const propertyAddress = queueItem.propertyAddress;
  const contactName = queueItem.contactName;

  console.log(`🔍 [DISPOSITION] Found queue item for user ${userId}, leadId ${leadId}`);

  // Get all OutreachQueue items for this lead
  let relatedContacts;
  if (leadId) {
    // Use leadId GSI for fast query
    const result = await docClient.send(new QueryCommand({
      TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME,
      IndexName: 'outreachQueuesByLeadId',
      KeyConditionExpression: 'leadId = :leadId',
      ExpressionAttributeValues: {
        ':leadId': leadId
      }
    }));
    relatedContacts = result.Items || [];
  } else if (propertyAddress) {
    // Fallback to propertyAddress scan for old items
    console.log(`⚠️ [DISPOSITION] No leadId, falling back to propertyAddress scan`);
    const result = await docClient.send(new ScanCommand({
      TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME,
      FilterExpression: 'userId = :userId AND propertyAddress = :address',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':address': propertyAddress
      }
    }));
    relatedContacts = result.Items || [];
  } else if (contactName) {
    // Last resort: use contactName (strip number suffix like " (2)")
    const baseName = contactName.replace(/\s*\(\d+\)\s*$/, '').trim();
    console.log(`⚠️ [DISPOSITION] No leadId or propertyAddress, falling back to contactName: ${baseName}`);
    const result = await docClient.send(new ScanCommand({
      TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME,
      FilterExpression: 'userId = :userId AND begins_with(contactName, :name)',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':name': baseName
      }
    }));
    relatedContacts = result.Items || [];
  } else {
    console.log(`⚠️ [DISPOSITION] No way to find related contacts`);
    relatedContacts = [queueItem]; // Only update this one contact
  }
  console.log(`📋 [DISPOSITION] Found ${relatedContacts.length} total contacts for user`);

  // Get GHL access token
  const tokenData = await getValidGhlToken(userId);
  if (!tokenData) {
    console.error('❌ [DISPOSITION] No valid GHL token found');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'No valid GHL token' })
    };
  }

  const { token } = tokenData;

  // Update all related contacts in GHL
  let updatedCount = 0;
  for (const contact of relatedContacts) {
    if (contact.contactId === contactId) {
      console.log(`⏭️ [DISPOSITION] Skipping original contact ${contactId}`);
      continue; // Skip the one that triggered the webhook
    }

    try {
      console.log(`🔄 [DISPOSITION] Updating GHL contact ${contact.contactId} with outcome: ${callOutcome}`);
      
      await axios.put(
        `https://services.leadconnectorhq.com/contacts/${contact.contactId}`,
        {
          customFields: [
            {
              id: CUSTOM_FIELD_IDS.CALL_OUTCOME,
              value: callOutcome
            }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Version: '2021-07-28'
          }
        }
      );

      updatedCount++;
      console.log(`✅ [DISPOSITION] Updated contact ${contact.contactId}`);
      
      // Rate limit: 2 seconds between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error(`❌ [DISPOSITION] Failed to update contact ${contact.contactId}:`, error.response?.data || error.message);
    }
  }

  // Update OutreachQueue items with new status
  const shouldStop = STOP_DISPOSITIONS.includes(callOutcome);
  for (const contact of relatedContacts) {
    const updates: any = {
      callOutcome,
      updatedAt: new Date().toISOString()
    };

    if (shouldStop) {
      if (contact.smsStatus) updates.smsStatus = 'OPTED_OUT';
      if (contact.emailStatus) updates.emailStatus = 'OPTED_OUT';
    }

    await docClient.send(new UpdateCommand({
      TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME,
      Key: { id: contact.id },
      UpdateExpression: 'SET callOutcome = :outcome, updatedAt = :now' + 
        (shouldStop && contact.smsStatus ? ', smsStatus = :optedOut' : '') +
        (shouldStop && contact.emailStatus ? ', emailStatus = :optedOut' : ''),
      ExpressionAttributeValues: {
        ':outcome': callOutcome,
        ':now': new Date().toISOString(),
        ...(shouldStop ? { ':optedOut': 'OPTED_OUT' } : {})
      }
    }));
  }

  console.log(`✅ [DISPOSITION] Updated ${updatedCount} related contacts in GHL`);
  console.log(`✅ [DISPOSITION] Updated ${relatedContacts.length} queue items`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: 'Disposition synced to all contacts',
      contactId,
      disposition: callOutcome,
      updatedContacts: updatedCount
    })
  };
}
