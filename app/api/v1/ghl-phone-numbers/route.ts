import { NextResponse } from 'next/server';
import { createGhlClient } from '../../../../amplify/functions/shared/ghlClient';
import { AuthGetCurrentUserServer, cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { getValidGhlToken } from '@/app/utils/aws/data/ghlIntegration.server';

/**
 * GET GHL PHONE NUMBERS
 * 
 * Fetches all available phone numbers from user's GHL account
 * Used in settings page for phone number selection
 */
export async function GET(req: Request) {
  console.log('📞 [GHL_PHONE_NUMBERS] Fetching phone numbers...');
  
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      console.error('❌ [GHL_PHONE_NUMBERS] No user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ [GHL_PHONE_NUMBERS] User:', user.userId);

    // Get user's GHL integration
    const { data: integrations } = await cookiesClient.models.GhlIntegration.list({
      filter: {
        userId: { eq: user.userId },
        isActive: { eq: true }
      }
    });

    if (!integrations || integrations.length === 0) {
      console.error('❌ [GHL_PHONE_NUMBERS] No GHL integration found');
      return NextResponse.json({ error: 'GHL not connected' }, { status: 404 });
    }

    const integration = integrations[0];
    console.log('✅ [GHL_PHONE_NUMBERS] Integration found, locationId:', integration.locationId);
    
    const ghlData = await getValidGhlToken(user.userId);

    if (!ghlData) {
      console.error('❌ [GHL_PHONE_NUMBERS] Failed to get access token');
      return NextResponse.json({ error: 'Failed to get access token' }, { status: 500 });
    }

    console.log('✅ [GHL_PHONE_NUMBERS] Token retrieved, fetching phone numbers...');

    // Fetch phone numbers from GHL
    const ghl = createGhlClient(ghlData);
    const response = await ghl.get(`/phone-system/numbers/location/${integration.locationId}`);
    const phoneNumbers = response.data.numbers || [];
    console.log(`✅ [GHL_PHONE_NUMBERS] Found ${phoneNumbers.length} phone numbers`);

    return NextResponse.json({
      success: true,
      phoneNumbers: phoneNumbers.map((p: any) => ({
        number: p.phoneNumber || p.number,
        name: p.name || p.friendlyName || '',
        isDefault: p.isDefault || false,
        type: p.type || 'unknown'
      }))
    });

  } catch (error: any) {
    console.error('❌ [GHL_PHONE_NUMBERS] Error:', error.response?.data || error.message);
    console.error('❌ [GHL_PHONE_NUMBERS] Stack:', error.stack);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
