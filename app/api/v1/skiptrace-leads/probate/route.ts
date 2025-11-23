//api/v1/skiptrace-leads/probate
import { NextRequest, NextResponse } from 'next/server';
import { AuthIsUserAuthenticatedServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { skipTraceProbateSingleLead } from '@/app/utils/batchData.server';
import { type LeadToSkip } from '@/app/types/batchdata/leadToSkip';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authenticated = await AuthIsUserAuthenticatedServer();
  if (!authenticated) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const lead: LeadToSkip = await req.json();
  if (!lead) {
    return NextResponse.json({ error: 'No lead provided' }, { status: 400 });
  }
  try {
    const response = await skipTraceProbateSingleLead(lead);
    if (!response) {
      return NextResponse.json(
        { error: 'No response from BatchData' },
        { status: 500 }
      );
    }
    console.log(JSON.stringify(response));

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('❌ BatchData skipTrace error:', error.message);
    if (error.response?.data) console.error(error.response.data);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
