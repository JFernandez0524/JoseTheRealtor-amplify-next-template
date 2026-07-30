/**
 * BACKFILL MULTI-LANDLINE LEADS AND RECLASSIFY SKIP TRACE STATUS
 *
 * 1. Updates DynamoDB `skipTraceStatus` from 'NO_QUALITY_CONTACTS' to 'COMPLETED' for all leads
 *    that possess non-DNC landlines.
 * 2. Invokes `manualGhlSync` Lambda for multi-landline leads to ensure 1 GHL contact per landline line.
 *
 * Usage:
 *   npx tsx scripts/backfill-multi-landlines.ts --owner <id>                    # dry run
 *   npx tsx scripts/backfill-multi-landlines.ts --owner <id> --apply
 *   npx tsx scripts/backfill-multi-landlines.ts --owner <id> --apply --limit 25
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const REGION = 'us-east-1';
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const lambda = new LambdaClient({ region: REGION });

const PROPERTY_LEAD_TABLE = 'PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE';
const SYNC_FUNCTION = 'amplify-d127hbsjypuuhr-ma-manualGhlSynclambda03415-uAM4KcABsXse';
const PROGRESS_FILE = path.resolve(process.cwd(), '.sync-multi-landline-progress.jsonl');

const DELAY_MS = 3000;
const CONSECUTIVE_FAILURE_LIMIT = 5;

function parseArgs(argv: string[]) {
  let owner = '';
  let apply = false;
  let limit = Infinity;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--owner' && argv[i + 1]) owner = argv[++i];
    else if (argv[i] === '--apply') apply = true;
    else if (argv[i] === '--limit' && argv[i + 1]) limit = parseInt(argv[++i], 10);
  }
  return { owner, apply, limit };
}

const { owner, apply, limit } = parseArgs(process.argv.slice(2));

if (!owner) {
  console.error('Usage: npx tsx scripts/backfill-multi-landlines.ts --owner <id> [--apply] [--limit N]');
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Lead {
  id: string;
  landlinePhones?: string[];
  phones?: string[];
  emails?: string[];
  skipTraceStatus?: string;
  ghlContactId?: string;
  owner?: string;
}

async function scanAll(table: string): Promise<Lead[]> {
  const items: Lead[] = [];
  let ExclusiveStartKey: Record<string, any> | undefined;

  do {
    const res = await docClient.send(
      new ScanCommand({
        TableName: table,
        ExclusiveStartKey,
        FilterExpression: '#owner = :owner',
        ExpressionAttributeNames: { '#owner': 'owner' },
        ExpressionAttributeValues: { ':owner': owner },
      })
    );
    if (res.Items) items.push(...(res.Items as Lead[]));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items;
}

function loadCompletedIds(): Set<string> {
  const set = new Set<string>();
  if (!fs.existsSync(PROGRESS_FILE)) return set;

  const lines = fs.readFileSync(PROGRESS_FILE, 'utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec.leadId && rec.status === 'SUCCESS') {
        set.add(rec.leadId);
      }
    } catch {}
  }
  return set;
}

function appendProgress(rec: Record<string, any>) {
  fs.appendFileSync(PROGRESS_FILE, JSON.stringify(rec) + '\n');
}

async function main() {
  console.log(`🔍 Environment: Region=${REGION}`);
  console.log(`🔍 Mode: ${apply ? '🚀 APPLY (Live Sync)' : '🧪 DRY RUN'}`);
  console.log(`🔍 Owner: ${owner}`);
  console.log(`🔍 Progress file: ${PROGRESS_FILE}\n`);

  const completedIds = loadCompletedIds();
  console.log(`📋 Found ${completedIds.size} previously completed lead syncs in progress log.`);

  console.log(`📥 Scanning ${PROPERTY_LEAD_TABLE}...`);
  const allLeads = await scanAll(PROPERTY_LEAD_TABLE);
  console.log(`✅ Loaded ${allLeads.length} leads for owner ${owner}.`);

  // 1. Leads needing status update
  const statusUpdateLeads = allLeads.filter((l) => {
    const hasLandline = (l.landlinePhones?.length || 0) > 0;
    return hasLandline && l.skipTraceStatus === 'NO_QUALITY_CONTACTS';
  });

  // 2. Leads with multiple landlines requiring multi-contact GHL sync
  const multiLandlineLeads = allLeads.filter((l) => {
    const noMobiles = !l.phones || l.phones.length === 0;
    const multiLandlines = (l.landlinePhones?.length || 0) > 1;
    return noMobiles && multiLandlines && !completedIds.has(l.id);
  });

  console.log(`\n📊 QUALIFYING LEADS SUMMARY:`);
  console.log(`   - Leads to update status (NO_QUALITY_CONTACTS -> COMPLETED): ${statusUpdateLeads.length}`);
  console.log(`   - Multi-landline leads to sync to GHL (1-Phone-1-Contact): ${multiLandlineLeads.length}`);

  if (!apply) {
    console.log(`\n🧪 DRY RUN COMPLETE. Re-run with --apply to execute status updates and GHL syncs.`);
    return;
  }

  // --- Step 1: Update DynamoDB Statuses ---
  if (statusUpdateLeads.length > 0) {
    console.log(`\n📝 Updating ${statusUpdateLeads.length} lead statuses in DynamoDB...`);
    let updatedCount = 0;
    for (const lead of statusUpdateLeads) {
      try {
        await docClient.send(
          new UpdateCommand({
            TableName: PROPERTY_LEAD_TABLE,
            Key: { id: lead.id },
            UpdateExpression: 'SET skipTraceStatus = :s',
            ExpressionAttributeValues: { ':s': 'COMPLETED' },
          })
        );
        updatedCount++;
      } catch (err: any) {
        console.error(`⚠️ Failed status update for lead ${lead.id}: ${err.message}`);
      }
    }
    console.log(`✅ Status updates completed: ${updatedCount}/${statusUpdateLeads.length}`);
  }

  // --- Step 2: Re-Sync Multi-Landline Leads to GHL ---
  const toSync = multiLandlineLeads.slice(0, limit);
  console.log(`\n🚀 Processing ${toSync.length} multi-landline GHL syncs...`);

  let consecutiveFailures = 0;
  let successCount = 0;

  for (let i = 0; i < toSync.length; i++) {
    const lead = toSync[i];
    console.log(`\n[${i + 1}/${toSync.length}] Syncing Lead ${lead.id} (${lead.landlinePhones?.length} landlines)...`);

    try {
      const payload = { arguments: { leadId: lead.id }, identity: { sub: owner, groups: ['ADMINS'] } };
      const command = new InvokeCommand({
        FunctionName: SYNC_FUNCTION,
        Payload: Buffer.from(JSON.stringify(payload)),
      });

      const res = await lambda.send(command);
      const responsePayload = res.Payload ? JSON.parse(Buffer.from(res.Payload).toString('utf8')) : null;

      if (responsePayload?.status === 'SUCCESS') {
        consecutiveFailures = 0;
        successCount++;
        console.log(`  ✅ SUCCESS: ${responsePayload.message} (Primary Contact: ${responsePayload.ghlContactId})`);
        appendProgress({
          leadId: lead.id,
          status: 'SUCCESS',
          ghlContactId: responsePayload.ghlContactId,
          landlineCount: lead.landlinePhones?.length,
          message: responsePayload.message,
        });
      } else {
        consecutiveFailures++;
        console.error(`  ❌ FAILED: ${responsePayload?.message || 'Unknown Lambda error'}`);
        appendProgress({
          leadId: lead.id,
          status: 'FAILED',
          error: responsePayload?.message || 'Lambda returned non-success',
        });
      }
    } catch (err: any) {
      consecutiveFailures++;
      console.error(`  ❌ EXCEPTION invoking Lambda for lead ${lead.id}: ${err.message}`);
      appendProgress({
        leadId: lead.id,
        status: 'ERROR',
        error: err.message,
      });
    }

    if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
      console.error(`\n🚨 STOPPING: ${CONSECUTIVE_FAILURE_LIMIT} consecutive failures reached.`);
      break;
    }

    if (i < toSync.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n🎉 DONE! Synced ${successCount} leads.`);
}

main().catch((err) => {
  console.error('🔥 Fatal error in script:', err);
  process.exit(1);
});
