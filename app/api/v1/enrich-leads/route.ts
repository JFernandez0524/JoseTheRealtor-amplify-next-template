import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { enrichPreforeclosureLeads } from '@/app/utils/batchdata/enrichment';
import { getLeadsByIds, updateLead } from '@/app/utils/aws/data/lead.server';

/**
 * POST /api/v1/enrich-leads
 * Enrich preforeclosure leads with BatchData
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    
    // Filter to preforeclosure only
    const preforeclosureLeads = leads.filter(lead => lead.type === 'PREFORECLOSURE');
    
    if (preforeclosureLeads.length === 0) {
      return NextResponse.json(
        { error: 'No preforeclosure leads found in selection' },
        { status: 400 }
      );
    }

    // Check for already enriched leads
    const alreadyEnriched = preforeclosureLeads.filter(lead => lead.batchDataEnriched);
    const toEnrich = preforeclosureLeads.filter(lead => !lead.batchDataEnriched);

    if (toEnrich.length === 0) {
      return NextResponse.json({
        message: 'All selected leads already enriched',
        enriched: 0,
        skipped: alreadyEnriched.length,
        cost: 0,
      });
    }

    // Calculate cost ($0.30 per lead)
    const costPerLead = 0.30;
    const totalCost = toEnrich.length * costPerLead;

    // Enrich leads
    const enrichmentResults = await enrichPreforeclosureLeads(toEnrich);

    // Update leads in database
    const updatePromises = Array.from(enrichmentResults.entries()).map(
      async ([leadId, enrichment]) => {
        try {
          await updateLead(leadId, enrichment);
          return { leadId, success: true };
        } catch (error) {
          console.error(`Failed to update lead ${leadId}:`, error);
          return { leadId, success: false, error: String(error) };
        }
      }
    );

    const updateResults = await Promise.all(updatePromises);
    const successCount = updateResults.filter(r => r.success).length;
    const failedCount = updateResults.filter(r => !r.success).length;

    return NextResponse.json({
      message: `Enriched ${successCount} preforeclosure leads`,
      enriched: successCount,
      failed: failedCount,
      skipped: alreadyEnriched.length,
      cost: totalCost,
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
