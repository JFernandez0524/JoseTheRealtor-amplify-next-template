/**
 * GHL TAGS API
 *
 * Add or remove a single tag on a GHL contact.
 *
 * POST /api/v1/ghl-tags
 *   AUTH: Required
 *   BODY: { contactId: string, tag: string }
 *   RESPONSE: { tags: string[] }  — full updated tag list
 *
 * DELETE /api/v1/ghl-tags?contactId=<id>&tag=<tag>
 *   AUTH: Required
 *   RESPONSE: { tags: string[] }  — full updated tag list
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookiesClient, AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { ghlAddTags, ghlGetContact, createGhlClient } from '../../../../amplify/functions/shared/ghlClient';

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

    await ghlAddTags(integration.accessToken, contactId, [tag]);

    const contact = await ghlGetContact(integration.accessToken, contactId);
    return NextResponse.json({ tags: contact.tags || [] });

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

    const ghl = createGhlClient(integration.accessToken);
    await ghl.delete(`/contacts/${contactId}/tags/${encodeURIComponent(tag)}`);

    const contact = await ghlGetContact(integration.accessToken, contactId);
    return NextResponse.json({ tags: contact.tags || [] });

  } catch (error: any) {
    console.error('Error removing GHL tag:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
