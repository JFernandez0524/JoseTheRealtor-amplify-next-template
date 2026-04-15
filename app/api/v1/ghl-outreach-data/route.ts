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

    // Always fetch live tags from GHL (tags are not stored in ghlOutreachData)
    const { data: integrations } = await cookiesClient.models.GhlIntegration.list({
      filter: { userId: { eq: user.userId }, isActive: { eq: true } }
    });

    let liveTags: string[] = [];
    let liveCustomFields: any[] = [];

    if (integrations && integrations.length > 0) {
      const integration = integrations[0];
      const ghlResponse = await fetch(
        `https://services.leadconnectorhq.com/contacts/${contactId}`,
        { headers: { 'Authorization': `Bearer ${integration.accessToken}`, 'Version': '2021-07-28' } }
      );
      if (ghlResponse.ok) {
        const ghlData = await ghlResponse.json();
        liveTags = ghlData.contact?.tags || [];
        liveCustomFields = ghlData.contact?.customFields || [];
      }
    }

    if (leads && leads.length > 0 && leads[0].ghlOutreachData) {
      const outreach = typeof leads[0].ghlOutreachData === 'string' ? JSON.parse(leads[0].ghlOutreachData) : leads[0].ghlOutreachData;
      return NextResponse.json({ ...outreach, tags: liveTags });
    }

    // Fallback: build from GHL custom fields if no DB data
    const getFieldValue = (fieldId: string) => {
      const field = liveCustomFields.find((f: any) => f.id === fieldId);
      return field?.value || null;
    };

    return NextResponse.json({
      smsAttempts: parseInt(getFieldValue(GHL_CUSTOM_FIELDS.call_attempt_counter) || '0'),
      emailAttempts: parseInt(getFieldValue(GHL_CUSTOM_FIELDS.email_attempt_counter) || '0'),
      lastSmsSent: getFieldValue(GHL_CUSTOM_FIELDS.last_call_date),
      aiState: getFieldValue(GHL_CUSTOM_FIELDS.ai_state),
      callOutcome: getFieldValue(GHL_CUSTOM_FIELDS.call_outcome),
      mailSentCount: parseInt(getFieldValue(GHL_CUSTOM_FIELDS.mail_sent_count) || '0'),
      tags: liveTags,
    });

  } catch (error: any) {
    console.error('Error fetching GHL outreach data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
