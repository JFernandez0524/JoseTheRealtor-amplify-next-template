import { NextRequest, NextResponse } from 'next/server';
import { cookiesClient } from '../../../utils/aws/auth/amplifyServerUtils.server';

export async function GET(request: NextRequest) {
  try {
    const leadId = request.nextUrl.searchParams.get('leadId');
    if (!leadId) {
      return NextResponse.json({ error: 'leadId required' }, { status: 400 });
    }

    const [{ data: lead }, { data: outreachQueue, errors }] = await Promise.all([
      cookiesClient.models.PropertyLead.get({ id: leadId }),
      cookiesClient.models.OutreachQueue.byLeadId({ leadId })
    ]);

    if (errors) {
      return NextResponse.json({ error: errors }, { status: 500 });
    }

    return NextResponse.json({
      leadId,
      lead: lead || null,
      outreachQueue: outreachQueue || [],
      queueCount: outreachQueue?.length || 0
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
