import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { syncToGoHighLevel } from './integrations/gohighlevel';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const GHL_API_KEY = process.env.GHL_API_KEY;
const propertyLeadTableName = process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME;
const userAccountTableName = process.env.AMPLIFY_DATA_UserAccount_TABLE_NAME;

type SyncResult = {
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED' | 'ERROR' | 'NO_CHANGE';
  message: string;
  ghlContactId?: string | null;
};

type Handler = (event: { arguments: { leadId: string }; identity: { sub: string } }) => Promise<any>;

// ---------------------------------------------------------
// HELPER: Core GHL Sync Logic
// ---------------------------------------------------------
async function processGhlSync(lead: any): Promise<SyncResult> {
  if (!GHL_API_KEY) {
    const message = `GHL_API_KEY is missing. Check Amplify secrets.`;
    await docClient.send(new UpdateCommand({
      TableName: propertyLeadTableName,
      Key: { id: lead.id },
      UpdateExpression: 'SET ghlSyncStatus = :status',
      ExpressionAttributeValues: {
        ':status': 'FAILED'
      }
    }));
    return { status: 'FAILED', message };
  }

  const currentSkipStatus = lead.skipTraceStatus?.toUpperCase();
  if (currentSkipStatus !== 'COMPLETED') {
    return {
      status: 'SKIPPED',
      message: `Lead status is ${lead.skipTraceStatus}`,
    };
  }

  const phones = lead.phones || [];
  if (phones.length === 0) {
    return { status: 'FAILED', message: 'No phone numbers found.' };
  }

  try {
    const syncResults: string[] = [];
    for (let i = 0; i < phones.length; i++) {
      const ghlContactId = await syncToGoHighLevel(
        lead,
        phones[i],
        i + 1,
        i === 0
      );
      syncResults.push(ghlContactId);
    }

    const primaryGhlId = syncResults[0];
    await docClient.send(new UpdateCommand({
      TableName: propertyLeadTableName,
      Key: { id: lead.id },
      UpdateExpression: 'SET ghlSyncStatus = :status, ghlContactId = :contactId, ghlSyncDate = :syncDate',
      ExpressionAttributeValues: {
        ':status': 'SUCCESS',
        ':contactId': primaryGhlId,
        ':syncDate': new Date().toISOString()
      }
    }));

    return {
      status: 'SUCCESS',
      message: `Synced ${phones.length} contacts.`,
      ghlContactId: primaryGhlId,
    };
  } catch (error: any) {
    await docClient.send(new UpdateCommand({
      TableName: propertyLeadTableName,
      Key: { id: lead.id },
      UpdateExpression: 'SET ghlSyncStatus = :status',
      ExpressionAttributeValues: {
        ':status': 'FAILED'
      }
    }));
    return { status: 'FAILED', message: error.message };
  }
}

// ---------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------
export const handler: Handler = async (event) => {
  const { leadId } = event.arguments;
  const identity = event.identity;

  let ownerId: string | undefined;
  let groups: string[] = [];

  // 🛡️ 1. Extract Identity FIRST (Fixes the logic error)
  if (identity && 'sub' in identity) {
    ownerId = identity.sub;
    groups = (identity as any).claims?.['cognito:groups'] || [];
  }

  // 🛡️ 2. Identity Guard
  if (!ownerId) {
    return {
      status: 'ERROR',
      message: 'User identity missing or not authenticated via Cognito.',
      leadId: leadId || 'unknown',
    };
  }

  // 🛡️ 3. Tier Authorization Check
  const isAuthorized = groups.some((g: string) =>
    ['PRO', 'AI_PLAN', 'ADMINS'].includes(g)
  );

  if (!isAuthorized) {
    return {
      status: 'ERROR',
      message: 'Unauthorized: Subscription required for CRM sync.',
      leadId: leadId,
    };
  }

  try {
    // 🛡️ 4. Ownership Verification
    const { Item: lead } = await docClient.send(new GetCommand({
      TableName: propertyLeadTableName,
      Key: { id: leadId }
    }));

    if (!lead || lead.owner !== ownerId) {
      return { status: 'ERROR', message: 'Authorization denied.', leadId };
    }

    // 🚀 5. Execute Logic
    const syncResult = await processGhlSync(lead);

    // 📊 6. Track usage
    if (syncResult.status === 'SUCCESS') {
      try {
        const { Items: accounts } = await docClient.send(new ScanCommand({
          TableName: userAccountTableName,
          FilterExpression: '#owner = :ownerId',
          ExpressionAttributeNames: {
            '#owner': 'owner'
          },
          ExpressionAttributeValues: {
            ':ownerId': ownerId
          }
        }));

        if (accounts && accounts[0]) {
          await docClient.send(new UpdateCommand({
            TableName: userAccountTableName,
            Key: { id: accounts[0].id },
            UpdateExpression: 'SET totalLeadsSynced = :newTotal',
            ExpressionAttributeValues: {
              ':newTotal': (accounts[0].totalLeadsSynced || 0) + 1
            }
          }));
        }
      } catch (err) {
        console.error('📊 Stats update failed (non-critical):', err);
      }
    }

    return { ...syncResult, leadId: leadId };
  } catch (error: any) {
    console.error('🔥 Critical Handler Error:', error);
    return {
      status: 'ERROR',
      message: `Internal server error: ${error.message}`,
      leadId: leadId || 'unknown',
    };
  }
};
