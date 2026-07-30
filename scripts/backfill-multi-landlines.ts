/**
 * BACKFILL MULTI-LANDLINE LEADS AND RECLASSIFY SKIP TRACE STATUS
 *
 * 1. Updates DynamoDB `skipTraceStatus` from 'NO_QUALITY_CONTACTS' to 'COMPLETED' for all leads
 *    that possess non-DNC landlines.
 * 2. Syncs multi-landline leads directly to GoHighLevel ensuring 1 GHL contact per landline line.
 *
 * Usage:
 *   npx tsx scripts/backfill-multi-landlines.ts --owner <id>                    # dry run
 *   npx tsx scripts/backfill-multi-landlines.ts --owner <id> --apply
 *   npx tsx scripts/backfill-multi-landlines.ts --owner <id> --apply --limit 25
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME =
  process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME || 'PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE';
process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME =
  process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME || 'GhlIntegration-ahlnflzdejd5jdrulwuqcuxm6i-NONE';
process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME =
  process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME || 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { syncToGoHighLevel } from '../amplify/functions/manualGhlSync/integrations/gohighlevel';
import { getValidGhlToken } from '../amplify/functions/shared/ghlTokenManager';
import { updateLeadSyncStatus } from '../amplify/functions/shared/syncUtils';

const REGION = 'us-east-1';
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const PROPERTY_LEAD_TABLE = process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME;
const PROGRESS_FILE = path.resolve(process.cwd(), '.sync-multi-landline-progress.jsonl');

const DELAY_MS = 2500;
const CONSECUTIVE_FAILURE_LIMIT = 5;

function parseArgs(argv: string[]) {
  let owner = '';
  let apply = false;
  let limit = Infinity;
  let leadId = '';

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--owner' && argv[i + 1]) owner = argv[++i];
    else if (argv[i] === '--apply') apply = true;
    else if (argv[i] === '--limit' && argv[i + 1]) limit = parseInt(argv[++i], 10);
    else if (argv[i] === '--lead-id' && argv[i + 1]) leadId = argv[++i];
  }
  return { owner, apply, limit, leadId };
}

const { owner, apply, limit, leadId } = parseArgs(process.argv.slice(2));

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
  console.log(`🔍 Mode: ${apply ? '🚀 APPLY (Live Direct Sync)' : '🧪 DRY RUN'}`);
  console.log(`🔍 Owner: ${owner}`);
  console.log(`🔍 Progress file: ${PROGRESS_FILE}\n`);

  const completedIds = loadCompletedIds();
  console.log(`📋 Found ${completedIds.size} previously completed lead syncs in progress log.`);

  console.log(`📥 Scanning ${PROPERTY_LEAD_TABLE}...`);
  const scannedLeads = await scanAll(PROPERTY_LEAD_TABLE);
  const allLeads = leadId ? scannedLeads.filter((l) => l.id === leadId) : scannedLeads;
  console.log(`✅ Loaded ${allLeads.length} leads for owner ${owner}${leadId ? ` (filtered to leadId: ${leadId})` : ''}.`);

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

  // --- Step 2: Fetch GHL Token ---
  console.log(`\n🔑 Fetching GHL token for owner...`);
  const ghlData = await getValidGhlToken(owner);
  if (!ghlData) {
    throw new Error(`GHL token not found for owner ${owner}. Please connect GHL.`);
  }

  const { token: ghlToken, locationId: ghlLocationId } = ghlData;
  const assignedUserId = ghlData.dialerUserId || '';
  const fieldIds = ghlData.customFieldIds || {};
  const oppFieldIds = ghlData.opportunityFieldIds || {};

  // --- Step 3: Re-Sync Multi-Landline Leads to GHL ---
  const toSync = multiLandlineLeads.slice(0, limit);
  console.log(`\n🚀 Direct-syncing ${toSync.length} multi-landline leads to GHL...`);

  let consecutiveFailures = 0;
  let successCount = 0;

  for (let i = 0; i < toSync.length; i++) {
    const lead = toSync[i];
    const landlines = lead.landlinePhones || [];
    console.log(`\n[${i + 1}/${toSync.length}] Direct-syncing Lead ${lead.id} (${landlines.length} landlines)...`);

    try {
      const contactIds: string[] = [];
      for (let j = 0; j < landlines.length; j++) {
        const phone = landlines[j];
        console.log(`  📞 Syncing landline ${j + 1}/${landlines.length}: ${phone}`);
        const ghlContactId = await syncToGoHighLevel(
          lead as any,
          phone,
          j + 1,
          j === 0, // primary contact
          ['ADMINS'],
          owner,
          ghlToken,
          ghlLocationId,
          fieldIds,
          oppFieldIds,
          assignedUserId
        );
        contactIds.push(ghlContactId);

        if (j === 0) {
          await updateLeadSyncStatus(docClient, PROPERTY_LEAD_TABLE, lead.id, 'SUCCESS', ghlContactId);
        }
      }

      consecutiveFailures = 0;
      successCount++;
      console.log(`  ✅ SUCCESS: Synced ${landlines.length} contacts for lead ${lead.id} (Primary GHL ID: ${contactIds[0]})`);
      appendProgress({
        leadId: lead.id,
        status: 'SUCCESS',
        ghlContactId: contactIds[0],
        allContactIds: contactIds,
        landlineCount: landlines.length,
      });
    } catch (err: any) {
      consecutiveFailures++;
      console.error(`  ❌ EXCEPTION syncing lead ${lead.id}: ${err.message}`);
      appendProgress({
        leadId: lead.id,
        status: 'FAILED',
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

  console.log(`\n🎉 DONE! Direct-synced ${successCount} multi-landline leads.`);
}

main().catch((err) => {
  console.error('🔥 Fatal error in script:', err);
  process.exit(1);
});
