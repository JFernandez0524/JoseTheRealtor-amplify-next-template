import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer, AuthGetUserGroupsServer, cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { enrichPreforeclosureLeads } from '@/app/utils/batchdata/enrichment';
import { getLeadsByIds, updateLead } from '@/app/utils/aws/data/lead.server';
import { hasCredits, deductCredits } from '@/app/utils/aws/data/userAccount.server';
import { ENRICHMENT_CREDITS_PER_MATCH, creditsFor, dollarsFor } from '@/amplify/functions/shared/skiptraceBilling';

// Jose (agency owner) — unlimited, never charged. Mirrors the owner exemption in skiptraceLeads.
const OWNER_USER_ID = '44d8f4c8-10c1-7038-744b-271103170819';

/**
 * POST /api/v1/enrich-leads
 * Enrich preforeclosure leads with BatchData. Clients are charged ENRICHMENT_CREDITS_PER_MATCH credits
 * per matched lead (never for no-match); ADMINS and the agency owner are exempt. Each run persists a
 * BatchDataJob record for the Reports "Job Reports" tab.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user and get their ID for ownership validation
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.userId;

    // Parse request body
    const body = await request.json();
    const { leadIds } = body as { leadIds: string[] };

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: 'leadIds array is required' },
        { status: 400 }
      );
    }

    // Fetch leads
    const leads = await getLeadsByIds(leadIds);

    // IDOR guard: every requested lead must belong to the calling user
    const foreignLeads = leads.filter(lead => lead.owner !== userId);
    if (foreignLeads.length > 0) {
      console.warn(`⚠️ IDOR attempt: user ${userId} requested ${foreignLeads.length} leads they don't own`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('📊 Enrich Debug:', {
      requestedIds: leadIds,
      fetchedCount: leads.length,
      leadTypes: leads.map(l => ({ id: l.id, type: l.type }))
    });

    // Filter to preforeclosure only
    const preforeclosureLeads = leads.filter(
      (lead) => lead.type?.toUpperCase() === 'PREFORECLOSURE'
    );

    if (preforeclosureLeads.length === 0) {
      return NextResponse.json(
        { 
          error: 'No preforeclosure leads found in selection',
          debug: {
            requestedIds: leadIds,
            fetchedCount: leads.length,
            leadTypes: leads.map(l => ({ id: l.id, type: l.type }))
          }
        },
        { status: 400 }
      );
    }

    // Check for already enriched leads
    const alreadyEnriched = preforeclosureLeads.filter(
      (lead) => lead.batchDataEnriched
    );
    const toEnrich = preforeclosureLeads.filter(
      (lead) => !lead.batchDataEnriched
    );

    if (toEnrich.length === 0) {
      return NextResponse.json({
        message: 'All selected leads already enriched',
        enriched: 0,
        skipped: alreadyEnriched.length,
        cost: 0,
      });
    }

    // Billing: charge ENRICHMENT_CREDITS_PER_MATCH credits per matched lead. ADMINS + agency owner exempt.
    const groups = await AuthGetUserGroupsServer();
    const isExempt = groups.includes('ADMINS') || userId === OWNER_USER_ID;

    // Upfront credit gate (worst case = every attempted lead matches) so we never call BatchData —
    // and get billed — without the ability to charge the client. Mirrors the skip-trace gate.
    if (!isExempt) {
      const worstCase = toEnrich.length * ENRICHMENT_CREDITS_PER_MATCH;
      if (!(await hasCredits(userId, worstCase))) {
        return NextResponse.json(
          { error: `Insufficient credits: enriching ${toEnrich.length} lead(s) needs up to ${worstCase} credits (${ENRICHMENT_CREDITS_PER_MATCH} per match). Purchase more credits to continue.` },
          { status: 402 }
        );
      }
    }

    // Enrich leads
    const enrichmentResults = await enrichPreforeclosureLeads(toEnrich);

    // BatchData bills enrichment PER MATCH, not per attempt — a no-match lookup is free (verified:
    // BatchData returns matchCount 0 and does not charge). So the client is only charged for the
    // properties BatchData actually matched (enrichmentResults holds one entry per matched lead).
    const matchedCount = enrichmentResults.size;
    const noMatchCount = toEnrich.length - matchedCount;
    const creditsCharged = isExempt ? 0 : creditsFor(matchedCount, ENRICHMENT_CREDITS_PER_MATCH);
    const totalCost = dollarsFor(creditsCharged); // $ charged for matched leads

    // Deduct credits for matched leads only (non-atomic read-then-update; acceptable for low-volume
    // enrichment — the SSR route has no DynamoDB IAM for a conditional decrement).
    if (creditsCharged > 0) {
      await deductCredits(userId, creditsCharged);
    }

    // Update leads in database
    const updatePromises = Array.from(enrichmentResults.entries()).map(
      async ([leadId, enrichment]) => {
        try {
          await updateLead({ id: leadId, ...enrichment } as any);
          return { leadId, success: true };
        } catch (error) {
          console.error(`Failed to update lead ${leadId}:`, error);
          return { leadId, success: false, error: String(error) };
        }
      }
    );

    const updateResults = await Promise.all(updatePromises);
    const successCount = updateResults.filter((r) => r.success).length;
    const failedCount = updateResults.filter((r) => !r.success).length;

    // Leads BatchData couldn't match — returned so the client can keep them selected/visible.
    const noMatchLeads = toEnrich
      .filter((lead) => !enrichmentResults.has(lead.id))
      .map((lead) => ({
        id: lead.id,
        address: [lead.ownerAddress, lead.ownerCity, lead.ownerState].filter(Boolean).join(', '),
      }));
    const noMatchIds = noMatchLeads.map((l) => l.id);

    // Persist a job record for the Reports "Job Reports" tab (best-effort — never fail the run on this).
    try {
      await cookiesClient.models.BatchDataJob.create({
        userId,
        jobType: 'ENRICHMENT',
        leadsSent: toEnrich.length,
        matched: matchedCount,
        noMatch: noMatchCount,
        noQuality: 0,
        failed: failedCount,
        skipped: alreadyEnriched.length,
        creditsPerMatch: ENRICHMENT_CREDITS_PER_MATCH,
        creditsCharged,
        dollarsCharged: totalCost,
        noMatchLeads,
      });
    } catch (jobErr) {
      console.error('⚠️ Failed to record BatchDataJob (non-fatal):', jobErr);
    }

    return NextResponse.json({
      message: `Enriched ${successCount} of ${toEnrich.length} preforeclosure leads (BatchData matched ${matchedCount}, no match ${noMatchCount})`,
      enriched: successCount,
      matched: matchedCount,
      noMatch: noMatchCount,
      noMatchIds,
      attempted: toEnrich.length,
      failed: failedCount,
      skipped: alreadyEnriched.length,
      creditsCharged,
      cost: totalCost, // $ charged; matches × $0.30 (0 for admins/owner)
      results: updateResults,
    });
  } catch (error) {
    console.error('Error enriching leads:', error);
    return NextResponse.json(
      { error: 'Failed to enrich leads', details: String(error) },
      { status: 500 }
    );
  }
}
