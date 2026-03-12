import { NextRequest, NextResponse } from 'next/server';
import {
  AuthGetCurrentUserServer,
  cookiesClient,
} from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { getLeadsByIds } from '@/app/utils/aws/data/lead.server';

export async function POST(request: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Door knock queue endpoint

    const { leadIds } = await request.json();

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: 'Lead IDs are required' },
        { status: 400 },
      );
    }

    console.log(
      `🚪 Adding ${leadIds.length} leads to door knock queue for user ${user.userId}`,
      'Lead IDs:', leadIds
    );

    // Fetch the selected leads
    const leads = await getLeadsByIds(leadIds);

    console.log(`📊 Retrieved ${leads.length} leads out of ${leadIds.length} requested`);

    if (!leads || leads.length === 0) {
      console.error('❌ No leads found for IDs:', leadIds);
      return NextResponse.json({ 
        error: 'No leads found',
        details: `Could not find any leads for the ${leadIds.length} provided IDs`
      }, { status: 404 });
    }

    let addedCount = 0;
    const errors: string[] = [];

    // Add each lead to door knock queue
    for (const lead of leads) {
      try {
        // Check if already in door knock queue
        const { data: existing } =
          await cookiesClient.models.DoorKnockQueue.list({
            filter: {
              userId: { eq: user.userId },
              leadId: { eq: lead.id },
            },
          });

        if (existing && existing.length > 0) {
          console.log(
            `⚠️ Lead ${lead.id} already in door knock queue, skipping`,
          );
          continue;
        }

        // Use existing coordinates from PropertyLead (already geocoded during upload)
        await cookiesClient.models.DoorKnockQueue.create({
          userId: user.userId,
          leadId: lead.id,
          ownerFirstName: lead.ownerFirstName || '',
          ownerLastName: lead.ownerLastName || '',
          adminFirstName: lead.adminFirstName || '',
          adminLastName: lead.adminLastName || '',
          propertyAddress: lead.ownerAddress || 'Unknown Address',
          propertyCity: lead.ownerCity || '',
          propertyState: lead.ownerState || '',
          propertyZip: lead.ownerZip || '',
          leadType: lead.type || '',
          estimatedValue: lead.zestimate || lead.estimatedValue || 0,
          status: 'PENDING',
          priority: 'MEDIUM',
          latitude: lead.latitude || null,
          longitude: lead.longitude || null,
        });

        addedCount++;
        console.log(`✅ Added lead ${lead.id} to door knock queue`);
      } catch (error) {
        const errorMsg = `Failed to add lead ${lead.id}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    console.log(
      `🎉 Door knock queue update complete: ${addedCount} added, ${errors.length} errors`,
    );

    return NextResponse.json({
      success: true,
      added: addedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully added ${addedCount} leads to door knock queue`,
    });
  } catch (error) {
    console.error('Error adding leads to door knock queue:', error);
    return NextResponse.json(
      {
        error: 'Failed to add leads to door knock queue',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
