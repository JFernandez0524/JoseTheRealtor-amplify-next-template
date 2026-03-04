import { NextRequest, NextResponse } from 'next/server';
import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

const GHL_CUSTOM_FIELDS = {
  call_attempt_counter: 'RkfK2vCGvjd4MjVLvJQo',
  email_attempt_counter: 'qjBXAiMSe0Nt0zzPiMJu',
  last_call_date: 'Nt0zzPiMJuqjBXAiMSe0',
  last_email_date: 'e0Nt0zzPiMJuqjBXAiMS',
  ai_state: '1NxQW2kKMVgozjSUuu7s',
  call_outcome: 'contact.customField.call_outcome__c',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json({ error: 'Missing contactId' }, { status: 400 });
    }

    // Get current user from server-side auth
    const { userId } = await cookiesClient.auth.fetchAuthSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get GHL integration
    const { data: integrations } = await cookiesClient.models.GhlIntegration.list({
      filter: { userId: { eq: userId }, isActive: { eq: true } }
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
      lastEmailSent: getFieldValue(GHL_CUSTOM_FIELDS.last_email_date),
      smsStatus: 'PENDING', // Default status
      emailStatus: 'PENDING', // Default status
      aiState: getFieldValue(GHL_CUSTOM_FIELDS.ai_state),
      callOutcome: getFieldValue(GHL_CUSTOM_FIELDS.call_outcome),
    };

    return NextResponse.json(outreachData);

  } catch (error: any) {
    console.error('Error fetching GHL outreach data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
