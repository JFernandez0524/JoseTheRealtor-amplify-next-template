import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer, cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

export async function GET(request: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch door knock leads for this user
    const { data: doorKnockLeads } = await cookiesClient.models.DoorKnockQueue.list({
      filter: {
        userId: { eq: user.userId }
      }
    });

    const leads = (doorKnockLeads || []).map(lead => ({
      id: lead.id,
      ownerName: lead.ownerName,
      propertyAddress: lead.propertyAddress,
      propertyCity: lead.propertyCity,
      propertyState: lead.propertyState,
      propertyZip: lead.propertyZip,
      latitude: lead.latitude,
      longitude: lead.longitude,
      status: lead.status,
      leadType: lead.leadType,
      estimatedValue: lead.estimatedValue,
      priority: lead.priority,
      notes: lead.notes,
      visitedAt: lead.visitedAt
    }));

    return NextResponse.json({
      success: true,
      leads
    });

  } catch (error) {
    console.error('Error fetching door knock leads:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch door knock leads',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
