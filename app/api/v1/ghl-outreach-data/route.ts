import { NextRequest, NextResponse } from 'next/server';
import { cookiesClient, AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

const GHL_CUSTOM_FIELDS = {
  call_attempt_counter: '0MD4Pp2LCyOSCbCjA5qF',
  email_attempt_counter: 'wWlrXoXeMXcM6kUexf2L',
  last_call_date: 'dWNGeSckpRoVUxXLgxMj',
  ai_state: '1NxQW2kKMVgozjSUuu7s',
  call_outcome: 'LNyfm5JDal955puZGbu3',
  mail_sent_count: 'DTEW0PLqxp35WHOiDLWR',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json({ error: 'Missing contactId' }, { status: 400 });
    }

    // Get current user from server-side auth
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First, try to get data from database (faster and already synced by webhook)
    const { data: leads } = await cookiesClient.models.PropertyLead.list({
      filter: { ghlContactId: { eq: contactId } }
    });

    if (leads && leads.length > 0 && leads[0].ghlOutreachData) {
      console.log('✅ Returning outreach data from database');
      return NextResponse.json(leads[0].ghlOutreachData);
    }

    // Fallback: Fetch from GHL if not in database
    console.log('⚠️ No database data, fetching from GHL');

    // Get GHL integration
    const { data: integrations } = await cookiesClient.models.GhlIntegration.list({
      filter: { userId: { eq: user.userId }, isActive: { eq: true } }
    });

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ error: 'No active GHL integration' }, { status: 404 });
    }

    const integration = integrations[0];

    // Fetch contact from GHL
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${integration.accessToken}`,
          'Version': '2021-07-28'
        }
      }
    );

    if (!response.ok) {
      console.error('GHL API error:', response.status, await response.text());
      return NextResponse.json({ error: 'Failed to fetch contact from GHL' }, { status: 500 });
    }

    const data = await response.json();
    const contact = data.contact;

    // Extract custom fields
    const getFieldValue = (fieldId: string) => {
      const field = contact.customFields?.find((f: any) => f.id === fieldId);
      return field?.value || null;
    };

    const outreachData = {
      smsAttempts: parseInt(getFieldValue(GHL_CUSTOM_FIELDS.call_attempt_counter) || '0'),
      emailAttempts: parseInt(getFieldValue(GHL_CUSTOM_FIELDS.email_attempt_counter) || '0'),
      lastSmsSent: getFieldValue(GHL_CUSTOM_FIELDS.last_call_date),
      aiState: getFieldValue(GHL_CUSTOM_FIELDS.ai_state),
      callOutcome: getFieldValue(GHL_CUSTOM_FIELDS.call_outcome),
      mailSentCount: parseInt(getFieldValue(GHL_CUSTOM_FIELDS.mail_sent_count) || '0'),
      tags: contact.tags || [],
    };

    return NextResponse.json(outreachData);

  } catch (error: any) {
    console.error('Error fetching GHL outreach data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
