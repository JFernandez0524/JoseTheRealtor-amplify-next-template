import { NextRequest, NextResponse } from 'next/server';
import { cookiesClient } from '../../../utils/aws/auth/amplifyServerUtils.server';

export async function GET(request: NextRequest) {
  try {
    const contactId = request.nextUrl.searchParams.get('contactId');
    if (!contactId) {
      return NextResponse.json({ error: 'contactId required' }, { status: 400 });
    }

    const { data: entries, errors } = await cookiesClient.models.OutreachQueue.list({
      filter: { contactId: { eq: contactId } }
    });

    if (errors) {
      return NextResponse.json({ error: errors }, { status: 500 });
    }

    return NextResponse.json({
      contactId,
      found: entries.length > 0,
      count: entries.length,
      entries
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
