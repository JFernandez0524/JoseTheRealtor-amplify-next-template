import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer, cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

export async function PATCH(request: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, status, notes } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }

    const { data, errors } = await cookiesClient.models.DoorKnockQueue.update({
      id,
      status,
      notes: notes || null,
      visitedAt: new Date().toISOString(),
    });

    if (errors?.length) {
      console.error('Error updating door knock status:', errors);
      return NextResponse.json({ error: 'Failed to update status', details: errors }, { status: 500 });
    }

    return NextResponse.json({ success: true, lead: data });
  } catch (error) {
    console.error('Error updating door knock status:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
