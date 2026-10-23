/**
 * BACKFILL THANKS.IO custom7 / custom8 (QR landing page fields)
 *
 * Recipients added to the preforeclosure Thanks.io lists before custom7 (debt baseline digits) and
 * custom8 (ISO sale date) existed are missing the values the /mailer/auction and /mailer/lis-pendens
 * landing pages read from the QR URL. This script fills them in, using the exact same
 * buildThanksIoRecipient() logic as new adds so the numbers match the printed letter.
 *
 * Flow per list (Preforeclosure - Auction #337586, Preforeclosure - Lis Pendens #309826):
 *   1. GET the list's recipients from Thanks.io.
 *   2. Scan PropertyLead for leads tagged `thanksio:<listId>` (set when they were added).
 *   3. Match recipient ↔ lead by custom1 (GHL contact id).
 *   4. Recompute custom7/custom8 and PUT /recipients/{id} with the existing payload + the new fields.
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/backfill-thanksio-qr-fields.ts   # preview only (no writes)
 *   npx tsx scripts/backfill-thanksio-qr-fields.ts             # live run
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  THANKS_IO_API_BASE,
  THANKS_IO_LISTS,
  buildThanksIoRecipient,
  thanksIoListTag,
  type ThanksIoListConfig,
} from '../amplify/functions/shared/thanksIoRecipients';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DRY_RUN = process.env.DRY_RUN === '1';
const API_KEY = process.env.THANKS_IO_API;
const PROPERTY_LEAD_TABLE = 'PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const LISTS: ThanksIoListConfig[] = [
  THANKS_IO_LISTS.PREFORECLOSURE_AUCTION,
  THANKS_IO_LISTS.PREFORECLOSURE_LIS_PENDENS,
];

// Fields carried over verbatim from the existing Thanks.io recipient on PUT
const CARRY_FIELDS = [
  'name', 'company', 'address', 'address2', 'city', 'province', 'postal_code', 'country',
  'email', 'phone', 'dob',
  'custom1', 'custom2', 'custom3', 'custom4', 'custom5', 'custom6', 'custom9', 'custom10',
] as const;

async function thanksIo(method: 'GET' | 'PUT', urlPath: string, body?: unknown): Promise<any> {
  const res = await fetch(`${THANKS_IO_API_BASE}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Thanks.io ${method} ${urlPath} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

/** All recipients on a mailing list (handles Laravel-style { data, meta } pagination or a bare array). */
async function fetchListRecipients(listId: number): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= 100; page++) {
    const json = await thanksIo('GET', `/mailing-lists/${listId}/recipients?page=${page}`);
    const rows: any[] = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
    if (page === 1 && !Array.isArray(json) && !Array.isArray(json?.data)) {
      console.warn(`⚠️  Unexpected response shape for list ${listId}:`, JSON.stringify(json).slice(0, 400));
    }
    all.push(...rows);
    const lastPage = json?.meta?.last_page ?? json?.last_page;
    if (Array.isArray(json) || rows.length === 0 || (lastPage != null && page >= lastPage) || (lastPage == null && !json?.links?.next && !json?.next_page_url)) {
      break;
    }
  }
  return all;
}

/** Leads tagged as added to this list, keyed by GHL contact id. */
async function fetchTaggedLeads(listId: number): Promise<Map<string, any>> {
  const byGhlId = new Map<string, any>();
  let lastKey: Record<string, any> | undefined;
  do {
    const out = await docClient.send(new ScanCommand({
      TableName: PROPERTY_LEAD_TABLE,
      FilterExpression: 'contains(customTags, :tag)',
      ExpressionAttributeValues: { ':tag': thanksIoListTag(listId) },
      ExclusiveStartKey: lastKey,
    }));
    for (const lead of out.Items ?? []) {
      if (lead.ghlContactId) byGhlId.set(String(lead.ghlContactId), lead);
    }
    lastKey = out.LastEvaluatedKey;
  } while (lastKey);
  return byGhlId;
}

async function main() {
  if (!API_KEY) throw new Error('THANKS_IO_API is not set in .env.local');
  console.log(`\n📬 Thanks.io QR field backfill — ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const list of LISTS) {
    const [recipients, leadsByGhl] = await Promise.all([
      fetchListRecipients(list.id),
      fetchTaggedLeads(list.id),
    ]);
    console.log(`── ${list.label} (#${list.id}): ${recipients.length} recipients, ${leadsByGhl.size} tagged leads`);

    const rows: Record<string, string>[] = [];

    for (const r of recipients) {
      const row: Record<string, string> = {
        recipient: String(r.id ?? '?'),
        name: String(r.name ?? ''),
        property: [r.custom3, r.custom4].filter(Boolean).join(', '),
        custom7: '',
        custom8: '',
        status: '',
      };

      const lead = r.custom1 ? leadsByGhl.get(String(r.custom1)) : undefined;
      if (!lead) {
        row.status = 'SKIP: no matching lead (custom1)';
        skipped++;
        rows.push(row);
        continue;
      }

      // The lead already carries this list's dedupe tag — drop it so the builder recomputes instead of rejecting.
      const tag = thanksIoListTag(list.id);
      const result = buildThanksIoRecipient(
        { ...lead, customTags: (lead.customTags || []).filter((t: string) => t !== tag) },
        list,
      );
      if (!result.ok) {
        row.status = `SKIP: ${result.reason}`;
        skipped++;
        rows.push(row);
        continue;
      }

      const { custom7, custom8 } = result.payload;
      row.custom7 = custom7 ?? '';
      row.custom8 = custom8 ?? '';
      if (!custom7 && !custom8) {
        row.status = 'SKIP: nothing to add';
        skipped++;
        rows.push(row);
        continue;
      }
      if (r.custom7 === custom7 && (r.custom8 ?? undefined) === custom8) {
        row.status = 'OK: already up to date';
        skipped++;
        rows.push(row);
        continue;
      }

      const body: Record<string, unknown> = { mailing_list_id: list.id };
      for (const f of CARRY_FIELDS) {
        if (r[f] !== undefined && r[f] !== null && r[f] !== '') body[f] = r[f];
      }
      if (custom7) body.custom7 = custom7;
      if (custom8) body.custom8 = custom8;

      if (DRY_RUN) {
        row.status = 'WOULD UPDATE';
        updated++;
      } else {
        try {
          await thanksIo('PUT', `/recipients/${r.id}`, body);
          row.status = 'UPDATED';
          updated++;
        } catch (err: any) {
          row.status = `FAILED: ${err.message}`;
          failed++;
        }
      }
      rows.push(row);
    }

    console.table(rows);
  }

  console.log(`\n✅ ${DRY_RUN ? 'Would update' : 'Updated'}: ${updated} · Skipped: ${skipped} · Failed: ${failed}\n`);
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
