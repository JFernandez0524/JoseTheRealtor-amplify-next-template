import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer, cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

export async function DELETE(request: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { errors } = await cookiesClient.models.DoorKnockQueue.delete({ id });

    if (errors?.length) {
      console.error('Error removing from door knock queue:', errors);
      return NextResponse.json({ error: 'Failed to remove', details: errors }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing from door knock queue:', error);
    return NextResponse.json({ error: 'Failed to remove' }, { status: 500 });
  }
}
