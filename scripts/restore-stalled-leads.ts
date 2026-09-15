/**
 * RESTORE STALLED OUTREACH LEADS
 *
 * Restores leads whose queueStatus was erroneously set to 'CONVERSATION'
 * by checkManualModeExpiry even though the lead never replied.
 * Sets queueStatus back to 'OUTREACH' and sets nextEmailDate so they resume
 * automated cold outreach.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const QUEUE_TABLE = process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME || 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

const DRY_RUN = process.argv.includes('--dry-run');

async function restoreStalledLeads() {
  console.log(`\n🔄 [RESTORE] Starting stalled leads recovery (DRY_RUN = ${DRY_RUN})...\n`);

  let items: any[] = [];
  let lastKey: any;

  do {
    const res = await docClient.send(new ScanCommand({
      TableName: QUEUE_TABLE,
      FilterExpression: 'queueStatus = :conv AND emailStatus = :pending AND attribute_exists(contactEmail)',
      ExpressionAttributeValues: {
        ':conv': 'CONVERSATION',
        ':pending': 'PENDING',
      },
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Found ${items.length} total PENDING items in CONVERSATION status with email.`);

  // Filter for leads that NEVER replied (unresponsive leads misclassified by auto-resume)
  const toRestore = items.filter(item => {
    // If they replied, they belong in CONVERSATION
    if (item.lastLeadReplyDate) return false;
    return true;
  });

  console.log(`Identified ${toRestore.length} stalled leads to restore to OUTREACH (0 replies).\n`);

  const attemptsBreakdown: Record<string, number> = {};
  for (const item of toRestore) {
    const att = (item.emailAttempts || 0).toString();
    attemptsBreakdown[att] = (attemptsBreakdown[att] || 0) + 1;
  }
  console.log('Attempts breakdown of leads to restore:', attemptsBreakdown);

  const now = new Date().toISOString();
  let restoredCount = 0;
  let joyLindoRestored = false;

  for (const item of toRestore) {
    if (item.contactId === 'xoY9hozmKcGLyogZmji2') {
      joyLindoRestored = true;
      console.log(`\n🎯 Found Joy Lindo (${item.contactId}) - currently emailAttempts=${item.emailAttempts}, nextEmailDate=${item.nextEmailDate}`);
    }

    if (!DRY_RUN) {
      await docClient.send(new UpdateCommand({
        TableName: QUEUE_TABLE,
        Key: { id: item.id },
        UpdateExpression: 'SET queueStatus = :outreach, nextEmailDate = :nextDate, updatedAt = :now',
        ExpressionAttributeValues: {
          ':outreach': 'OUTREACH',
          ':nextDate': now,
          ':now': now,
        },
      }));
    }

    restoredCount++;
    if (restoredCount % 50 === 0) {
      console.log(`Progress: ${restoredCount} / ${toRestore.length}...`);
    }
  }

  console.log(`\n✅ [RESTORE] Complete! Successfully processed ${restoredCount} leads.`);
  console.log(`Joy Lindo restored: ${joyLindoRestored}`);
  if (DRY_RUN) {
    console.log('ℹ️ Dry run only. Re-run without --dry-run to apply changes.');
  }
}

restoreStalledLeads().catch(console.error);
