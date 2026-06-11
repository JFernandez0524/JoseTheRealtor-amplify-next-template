import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer, cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

export async function PATCH(request: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, status, notes, priority, snoozedUntil } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updateFields: Parameters<typeof cookiesClient.models.DoorKnockQueue.update>[0] = { id };
    if (status !== undefined) {
      updateFields.status = status;
      updateFields.visitedAt = new Date().toISOString();
    }
    if (notes !== undefined) updateFields.notes = notes ?? null;
    if (priority !== undefined) updateFields.priority = priority;
    if (snoozedUntil !== undefined) updateFields.snoozedUntil = snoozedUntil ?? null;

    const { data, errors } = await cookiesClient.models.DoorKnockQueue.update(updateFields);

    if (errors?.length) {
      console.error('Error updating door knock entry:', errors);
      return NextResponse.json({ error: 'Failed to update', details: errors }, { status: 500 });
    }

    return NextResponse.json({ success: true, lead: data });
  } catch (error) {
    console.error('Error updating door knock entry:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
