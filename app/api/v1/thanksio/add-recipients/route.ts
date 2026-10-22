import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { getLeadsByIds, updateLead } from '@/app/utils/aws/data/lead.server';
import {
  THANKS_IO_API_BASE,
  buildThanksIoRecipient,
  getThanksIoList,
  thanksIoListTag,
} from '@/amplify/functions/shared/thanksIoRecipients';

const MAX_LEADS_PER_REQUEST = 200;

/**
 * POST /api/v1/thanksio/add-recipients
 * Body: { leadIds: string[], mailingListId: number, dryRun?: boolean }
 *
 * MANUAL ONLY — adds the user-selected leads to the user-selected Thanks.io mailing list. Nothing
 * calls this automatically. `dryRun: true` validates and returns the eligible/excluded breakdown
 * without contacting Thanks.io (the modal uses it to preview before confirming).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = user.userId;

    const apiKey = process.env.THANKS_IO_API;
    if (!apiKey) {
      return NextResponse.json({ error: 'Thanks.io API key (THANKS_IO_API) is not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { leadIds, mailingListId, dryRun } = body as {
      leadIds: string[];
      mailingListId: number;
      dryRun?: boolean;
    };

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds array is required' }, { status: 400 });
    }
    if (leadIds.length > MAX_LEADS_PER_REQUEST) {
      return NextResponse.json({ error: `Send at most ${MAX_LEADS_PER_REQUEST} leads at a time` }, { status: 400 });
    }

    const list = getThanksIoList(Number(mailingListId));
    if (!list) {
      return NextResponse.json({ error: `Unknown Thanks.io mailing list: ${mailingListId}` }, { status: 400 });
    }

    const leads = await getLeadsByIds(leadIds);

    // IDOR guard: every requested lead must belong to the calling user (same rule as enrich-leads).
    const foreign = leads.filter((lead) => {
      const owner = lead.owner ?? '';
      return owner !== userId && !owner.startsWith(`${userId}::`) && !userId.startsWith(`${owner}::`);
    });
    if (foreign.length > 0) {
      console.warn(`⚠️ IDOR attempt: user ${userId} requested ${foreign.length} leads they don't own`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const eligible: { lead: (typeof leads)[number]; payload: any }[] = [];
    const excluded: { id: string; address: string; reason: string }[] = [];

    for (const lead of leads) {
      const result = buildThanksIoRecipient(lead, list);
      if (result.ok) {
        eligible.push({ lead, payload: result.payload });
      } else {
        excluded.push({ id: lead.id, address: lead.ownerAddress || '', reason: result.reason });
      }
    }

    if (dryRun) {
      return NextResponse.json({
        list: { id: list.id, label: list.label },
        eligibleCount: eligible.length,
        eligible: eligible.map(({ lead, payload }) => ({
          id: lead.id,
          name: payload.name,
          address: lead.ownerAddress,
          saleDate: payload.custom5 ?? null,
          equity: payload.custom6 ?? null,
        })),
        excluded,
      });
    }

    const sent: string[] = [];
    const failed: { id: string; address: string; reason: string }[] = [];

    for (const { lead, payload } of eligible) {
      try {
        const res = await fetch(`${THANKS_IO_API_BASE}/recipients`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Thanks.io ${res.status}: ${errText.slice(0, 200)}`);
        }

        sent.push(lead.id);

        // Record the send so the same lead can't be mailed onto this list twice.
        try {
          const tags = Array.from(new Set([...(lead.customTags || []), thanksIoListTag(list.id)]));
          await updateLead({ id: lead.id, customTags: tags.filter(Boolean) as string[] });
        } catch (tagErr) {
          console.error(`⚠️ [THANKS.IO] Added ${lead.id} to list ${list.id} but failed to tag lead:`, tagErr);
        }
      } catch (err: any) {
        console.error(`❌ [THANKS.IO] Failed to add lead ${lead.id} to list ${list.id}:`, err.message);
        failed.push({ id: lead.id, address: lead.ownerAddress || '', reason: err.message });
      }
    }

    console.log(`📬 [THANKS.IO] User ${userId} → list ${list.id} (${list.label}): sent=${sent.length} excluded=${excluded.length} failed=${failed.length}`);

    return NextResponse.json({
      list: { id: list.id, label: list.label },
      sent: sent.length,
      sentIds: sent,
      excluded,
      failed,
    });
  } catch (error: any) {
    console.error('❌ [THANKS.IO] add-recipients error:', error);
    return NextResponse.json({ error: error.message || 'Failed to add recipients' }, { status: 500 });
  }
}
