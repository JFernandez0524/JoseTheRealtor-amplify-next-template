import { NextRequest, NextResponse } from 'next/server';
import { getLeadById } from '@/app/utils/aws/data/lead.server';
import { AuthIsUserAuthenticatedServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const isUserAuthenticated = await AuthIsUserAuthenticatedServer();
  if (!isUserAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    const lead = await getLeadById(id);
    return NextResponse.json({ success: true, lead });
  } catch (error: any) {
    console.error(`Error fetching lead ${params.id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Error fetching lead' },
      { status: 500 }
    );
  }
}
