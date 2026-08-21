import { NextResponse } from 'next/server';
import axios from 'axios';
import { AuthGetCurrentUserServer, AuthGetUserGroupsServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { createGhlIntegration } from '@/app/utils/aws/data/ghlIntegration.server';
import {
  provisionCustomFields,
  provisionOpportunityFields,
  provisionTags,
} from '../../../../../amplify/functions/shared/ghlFieldProvisioner';

/**
 * POST /api/v1/ghl/connect-pit
 *
 * Connects a user's GoHighLevel sub-account using a Private Integration Token (PIT).
 * Validates the token and location against the GHL API, auto-provisions custom fields
 * and tags, and stores the integration record in DynamoDB.
 *
 * AUTH: Required (Cognito JWT via cookies, PRO/AI_PLAN/ADMINS required)
 * BODY: { locationId: string, pitToken: string }
 */
export async function POST(req: Request) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    const groups = await AuthGetUserGroupsServer();
    const hasPaidPlan = groups.includes('PRO') || groups.includes('AI_PLAN') || groups.includes('ADMINS');
    if (!hasPaidPlan) {
      return NextResponse.json(
        { error: 'Paid subscription (PRO or AI_PLAN) is required to connect CRM.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const locationId = (body.locationId || '').trim();
    const pitToken = (body.pitToken || '').trim();

    if (!locationId || !pitToken) {
      return NextResponse.json(
        { error: 'Both Location ID and Private Integration Token (PIT) are required.' },
        { status: 400 }
      );
    }

    // 1. Live validation of the PIT token and Location ID against HighLevel API
    try {
      console.log(`🔍 [GHL_PIT] Testing PIT token for location: ${locationId}...`);
      await axios.get(
        `https://services.leadconnectorhq.com/locations/${locationId}`,
        {
          headers: {
            Authorization: `Bearer ${pitToken}`,
            Version: '2021-07-28',
          },
          timeout: 10000,
        }
      );
      console.log(`✅ [GHL_PIT] Location verified successfully: ${locationId}`);
    } catch (testError: any) {
      console.error('❌ [GHL_PIT] Token validation failed:', testError.response?.data || testError.message);
      const apiMsg = testError.response?.data?.message || testError.message;
      return NextResponse.json(
        {
          error: `HighLevel authentication failed: ${apiMsg}. Please verify that your Location ID and Private Integration Token are correct and have location access.`,
        },
        { status: 400 }
      );
    }

    // 2. Auto-provision custom fields, opportunity fields, and system tags
    let customFieldIds: Record<string, string> | undefined;
    let opportunityFieldIds: Record<string, string> | undefined;
    try {
      console.log(`🔧 [GHL_PIT] Auto-provisioning custom fields and tags for location: ${locationId}...`);
      const [cFields, oFields] = await Promise.all([
        provisionCustomFields(locationId, pitToken),
        provisionOpportunityFields(locationId, pitToken),
        provisionTags(locationId, pitToken),
      ]);
      customFieldIds = cFields;
      opportunityFieldIds = oFields;
      console.log('✅ [GHL_PIT] Custom fields and tags provisioned successfully.');
    } catch (provErr: any) {
      console.warn('⚠️ [GHL_PIT] Non-fatal field provisioning warning:', provErr.message);
    }

    // 3. Store integration in database with 100-year validity (~3.15 billion seconds)
    // Static PITs do not expire every 24h like OAuth tokens.
    const ONE_HUNDRED_YEARS_IN_SECONDS = 100 * 365 * 24 * 60 * 60;

    await createGhlIntegration(user.userId, {
      access_token: pitToken,
      refresh_token: 'PIT_STATIC',
      expires_in: ONE_HUNDRED_YEARS_IN_SECONDS,
      locationId,
      customFieldIds,
      opportunityFieldIds,
    });

    console.log(`✅ [GHL_PIT] Private Integration successfully saved for user: ${user.userId}`);

    return NextResponse.json({
      success: true,
      locationId,
      message: 'GoHighLevel connected successfully via Private Integration Token!',
    });
  } catch (error: any) {
    console.error('🔥 [GHL_PIT] Unexpected error connecting PIT:', error);
    return NextResponse.json(
      { error: 'Internal server error while connecting Private Integration: ' + error.message },
      { status: 500 }
    );
  }
}
