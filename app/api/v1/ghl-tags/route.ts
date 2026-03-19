import { NextRequest, NextResponse } from 'next/server';
import { cookiesClient, AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

export async function POST(request: NextRequest) {
  try {
    const { contactId, tag } = await request.json();

    if (!contactId || !tag) {
      return NextResponse.json({ error: 'Missing contactId or tag' }, { status: 400 });
    }

    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get GHL integration
    const { data: integrations } = await cookiesClient.models.GhlIntegration.list({
      filter: { userId: { eq: user.userId }, isActive: { eq: true } }
    });

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ error: 'No active GHL integration' }, { status: 404 });
    }

    const integration = integrations[0];

    // Add tag to GHL contact
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}/tags`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.accessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tags: [tag] })
      }
    );

    if (!response.ok) {
      console.error('GHL API error:', response.status, await response.text());
      return NextResponse.json({ error: 'Failed to add tag' }, { status: 500 });
    }

    // Fetch updated contact to return current tags
    const contactResponse = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${integration.accessToken}`,
          'Version': '2021-07-28'
        }
      }
    );

    if (contactResponse.ok) {
      const data = await contactResponse.json();
      return NextResponse.json({ tags: data.contact.tags || [] });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error adding GHL tag:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');
    const tag = searchParams.get('tag');

    if (!contactId || !tag) {
      return NextResponse.json({ error: 'Missing contactId or tag' }, { status: 400 });
    }

    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get GHL integration
    const { data: integrations } = await cookiesClient.models.GhlIntegration.list({
      filter: { userId: { eq: user.userId }, isActive: { eq: true } }
    });

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ error: 'No active GHL integration' }, { status: 404 });
    }

    const integration = integrations[0];

    // Remove tag from GHL contact
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}/tags/${encodeURIComponent(tag)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${integration.accessToken}`,
          'Version': '2021-07-28'
        }
      }
    );

    if (!response.ok) {
      console.error('GHL API error:', response.status, await response.text());
      return NextResponse.json({ error: 'Failed to remove tag' }, { status: 500 });
    }

    // Fetch updated contact to return current tags
    const contactResponse = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${integration.accessToken}`,
          'Version': '2021-07-28'
        }
      }
    );

    if (contactResponse.ok) {
      const data = await contactResponse.json();
      return NextResponse.json({ tags: data.contact.tags || [] });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error removing GHL tag:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
