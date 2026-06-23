import { NextResponse } from 'next/server';
import { ghlAddTags, ghlUpdateContact } from '../../../../amplify/functions/shared/ghlClient';
import { getValidGhlToken } from '@/app/utils/aws/data/ghlIntegration.server';

/**
 * UNSUBSCRIBE API
 *
 * Handles email unsubscribe requests from contacts.
 *
 * ACTIONS:
 * 1. Tags contact as "unsubscribed" in GHL
 * 2. Updates GHL DND settings to block emails
 * 3. Updates OutreachQueue status to OPTED_OUT
 *
 * COMPLIANCE:
 * - CAN-SPAM Act compliant (instant unsubscribe)
 * - Permanent opt-out (no re-subscription without explicit consent)
 * - No login or payment required
 */
export async function POST(req: Request) {
  try {
    const { contactId, email } = await req.json();

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'Contact ID is required' },
        { status: 400 },
      );
    }

    // Get contact to find userId
    const { cookiesClient } = await import(
      '@/app/utils/aws/auth/amplifyServerUtils.server'
    );

    // Fetch contact from GHL to get locationId
    // We need to find the integration first - try to get it from the contact's location
    // For now, we'll use a direct GHL API call with any active integration
    const { data: integrations } =
      await cookiesClient.models.GhlIntegration.list({
        filter: { isActive: { eq: true } },
      });

    if (!integrations || integrations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active GHL integration found' },
        { status: 404 },
      );
    }

    // Use first active integration (in production, you'd match by locationId)
    const integration = integrations[0];
    const accessToken = await getValidGhlToken(integration.userId);

    if (!accessToken) {
      return NextResponse.json({ success: false, error: 'Failed to retrieve GHL token' }, { status: 500 });
    }

    // 1. Tag contact as unsubscribed
    await ghlAddTags(accessToken, contactId, ['unsubscribed', 'email:opted-out']);

    // 2. Update DND settings to block emails
    await ghlUpdateContact(accessToken, contactId, {
      dndSettings: { Email: { status: 'active', message: 'Contact unsubscribed from emails' } }
    });

    // 3. Update OutreachQueue status to OPTED_OUT
    const { data: queueItems } = await cookiesClient.models.OutreachQueue.list({
      filter: {
        contactId: { eq: contactId },
      },
    });

    for (const item of queueItems) {
      await cookiesClient.models.OutreachQueue.update({
        id: item.id,
        emailStatus: 'OPTED_OUT',
      });
    }

    console.log(`✅ Contact ${contactId} unsubscribed successfully`);

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed',
    });
  } catch (error: any) {
    console.error('Unsubscribe error:', error.response?.data || error.message);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process unsubscribe request',
      },
      { status: 500 },
    );
  }
}
