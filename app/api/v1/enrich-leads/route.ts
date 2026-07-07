import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { enrichPreforeclosureLeads } from '@/app/utils/batchdata/enrichment';
import { getLeadsByIds, updateLead } from '@/app/utils/aws/data/lead.server';

/**
 * POST /api/v1/enrich-leads
 * Enrich preforeclosure leads with BatchData
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

    // Enrich leads
    const enrichmentResults = await enrichPreforeclosureLeads(toEnrich);

    // BatchData bills enrichment PER MATCH, not per attempt — a no-match lookup is free (verified:
    // BatchData returns matchCount 0 and does not charge). So the client is only charged for the
    // properties BatchData actually matched (enrichmentResults holds one entry per matched lead).
    const costPerLead = 0.35;
    const matchedCount = enrichmentResults.size;
    const noMatchCount = toEnrich.length - matchedCount;
    const totalCost = matchedCount * costPerLead;

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
    const noMatchIds = toEnrich
      .map((lead) => lead.id)
      .filter((id) => !enrichmentResults.has(id));

    return NextResponse.json({
      message: `Enriched ${successCount} of ${toEnrich.length} preforeclosure leads (BatchData matched ${matchedCount}, no match ${noMatchCount})`,
      enriched: successCount,
      matched: matchedCount,
      noMatch: noMatchCount,
      noMatchIds,
      attempted: toEnrich.length,
      failed: failedCount,
      skipped: alreadyEnriched.length,
      cost: totalCost, // charged only for BatchData matches
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
