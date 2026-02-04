import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { syncToGoHighLevel } from './integrations/gohighlevel';
import { getValidGhlToken } from '../shared/ghlTokenManager';
import { validateLeadForSync, updateLeadSyncStatus, SyncResult } from '../shared/syncUtils';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const propertyLeadTableName = process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME;
const userAccountTableName = process.env.AMPLIFY_DATA_UserAccount_TABLE_NAME;

type Handler = (event: { arguments: { leadId: string }; identity: { sub: string } }) => Promise<any>;

console.log('🔧 [GHL_SYNC] Lambda initialized');
console.log('🔧 [GHL_SYNC] Environment:', {
  hasPropertyLeadTable: !!propertyLeadTableName,
  hasUserAccountTable: !!userAccountTableName,
  region: process.env.AWS_REGION
});

// ---------------------------------------------------------
// HELPER: Core GHL Sync Logic
// ---------------------------------------------------------
async function processGhlSync(lead: any, groups: string[] = [], ownerId: string = ''): Promise<SyncResult> {
  console.log(`🔄 [GHL_SYNC] Processing sync for lead: ${lead.id}`);
  console.log(`🔄 [GHL_SYNC] Owner: ${ownerId}, Groups: ${groups.join(', ')}`);
  
  // ✅ Validate lead before processing
  const validation = validateLeadForSync(lead);
  if (!validation.isValid) {
    console.log(`⏭️ Skipping sync - ${validation.reason}`);
    return {
      status: 'SKIPPED',
      message: validation.reason!,
    };
  }

  // Get user's GHL token and locationId (auto-refreshes if expired)
  console.log(`🔑 [GHL_SYNC] Getting GHL token...`);
  const ghlData = await getValidGhlToken(ownerId);
  
  if (!ghlData) {
    const message = `GHL not connected or token expired. Please reconnect GoHighLevel.`;
    console.error(`❌ [GHL_SYNC] ${message}`);
    await updateLeadSyncStatus(docClient, propertyLeadTableName!, lead.id, 'FAILED');
    return { status: 'FAILED', message };
  }

  console.log(`✅ [GHL_SYNC] Token retrieved, locationId: ${ghlData.locationId}`);
  const { token: ghlToken, locationId: ghlLocationId } = ghlData;

  // 🚦 Check GHL rate limits before syncing
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
      const account = accounts[0];
      const now = Date.now();
      const lastHourReset = account.lastHourReset || 0;
      const lastDayReset = account.lastDayReset || 0;
      const hourlyCount = account.hourlyMessageCount || 0;
      const dailyCount = account.dailyMessageCount || 0;

      // Reset counters if needed
      const hoursSinceReset = (now - lastHourReset) / (1000 * 60 * 60);
      const daysSinceReset = (now - lastDayReset) / (1000 * 60 * 60 * 24);

      const currentHourlyCount = hoursSinceReset >= 1 ? 0 : hourlyCount;
      const currentDailyCount = daysSinceReset >= 1 ? 0 : dailyCount;

      // GHL limits: 100/hour, 1000/day (conservative estimates)
      if (currentHourlyCount >= 100) {
        return {
          status: 'FAILED',
          message: 'GHL hourly rate limit reached (100/hour). Try again later.',
        };
      }

      if (currentDailyCount >= 1000) {
        return {
          status: 'FAILED',
          message: 'GHL daily rate limit reached (1000/day). Try again tomorrow.',
        };
      }
    }
  } catch (err) {
    console.error('Rate limit check failed (non-critical):', err);
  }

  const phones = lead.phones || [];
  const emails = lead.emails || [];
  
  console.log(`📞 Found ${phones.length} phones, ${emails.length} emails:`, { phones, emails });
  
  // ✅ SYNC LEADS WITH PHONES (multiple contacts for multiple phones)
  if (phones.length > 0) {
    console.log(`📞 Syncing ${phones.length} phone contacts`);
    try {
      const syncResults: string[] = [];
      for (let i = 0; i < phones.length; i++) {
        const ghlContactId = await syncToGoHighLevel(
          lead,
          phones[i],
          i + 1,
          i === 0, // First phone is primary
          groups,
          ownerId,
          ghlToken,
          ghlLocationId
        );
        syncResults.push(ghlContactId);
      }

      const primaryGhlId = syncResults[0];
      await updateLeadSyncStatus(docClient, propertyLeadTableName!, lead.id, 'SUCCESS', primaryGhlId);

      return {
        status: 'SUCCESS',
        message: `Synced ${phones.length} phone contact(s).`,
        ghlContactId: primaryGhlId,
      };
    } catch (error: any) {
      await updateLeadSyncStatus(docClient, propertyLeadTableName!, lead.id, 'FAILED');
      return { status: 'FAILED', message: error.message };
    }
  }

  // ✅ SYNC EMAIL-ONLY LEADS (direct mail workflow)
  console.log(`📧 Syncing email-only contact for direct mail`);
  try {
    const ghlContactId = await syncToGoHighLevel(
      lead,
      '', // No phone
      1,
      true, // Primary contact
      groups,
      ownerId,
      ghlToken,
      ghlLocationId
    );

    await updateLeadSyncStatus(docClient, propertyLeadTableName!, lead.id, 'SUCCESS', ghlContactId);

    return {
      status: 'SUCCESS',
      message: 'Synced email contact for direct mail workflow.',
      ghlContactId: ghlContactId,
    };
  } catch (error: any) {
    await updateLeadSyncStatus(docClient, propertyLeadTableName!, lead.id, 'FAILED');
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
    const syncResult = await processGhlSync(lead, groups, ownerId);

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
          const account = accounts[0];
          const now = Date.now();
          const lastHourReset = account.lastHourReset || 0;
          const lastDayReset = account.lastDayReset || 0;
          const hourlyCount = account.hourlyMessageCount || 0;
          const dailyCount = account.dailyMessageCount || 0;

          // Reset counters if needed
          const hoursSinceReset = (now - lastHourReset) / (1000 * 60 * 60);
          const daysSinceReset = (now - lastDayReset) / (1000 * 60 * 60 * 24);

          const newHourlyCount = hoursSinceReset >= 1 ? 1 : hourlyCount + 1;
          const newDailyCount = daysSinceReset >= 1 ? 1 : dailyCount + 1;
          const newHourReset = hoursSinceReset >= 1 ? now : lastHourReset;
          const newDayReset = daysSinceReset >= 1 ? now : lastDayReset;

          await docClient.send(new UpdateCommand({
            TableName: userAccountTableName,
            Key: { id: accounts[0].id },
            UpdateExpression: 'SET totalLeadsSynced = :newTotal, hourlyMessageCount = :hourly, dailyMessageCount = :daily, lastHourReset = :hourReset, lastDayReset = :dayReset',
            ExpressionAttributeValues: {
              ':newTotal': (accounts[0].totalLeadsSynced || 0) + 1,
              ':hourly': newHourlyCount,
              ':daily': newDailyCount,
              ':hourReset': newHourReset,
              ':dayReset': newDayReset,
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
