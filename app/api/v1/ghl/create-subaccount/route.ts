/**
 * POST /api/v1/ghl/create-subaccount
 *
 * Creates a new GHL sub-account (location) under the agency using the agency token.
 * Intended for provisioning new user accounts during onboarding.
 *
 * AUTH: Required (Cognito JWT via cookies)
 * REQUEST BODY: { businessName: string, phone: string }
 * RESPONSE: { success: true, subAccountId: string, locationId: string }
 *
 * TODO: Billing subscription setup and DynamoDB UserAccount update are not yet
 * implemented (see TODO comments in handler).
 *
 * REQUIRES: GHL_AGENCY_TOKEN env var (agency-level OAuth token)
 */
import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { createGhlClient } from '../../../../../amplify/functions/shared/ghlClient';

const GHL_AGENCY_TOKEN = process.env.GHL_AGENCY_TOKEN; // Your agency access token

export async function POST(req: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user email from attributes
    const userEmail = user.signInDetails?.loginId || user.username || 'user@example.com';

    const { businessName, phone } = await req.json();

    // Create GHL Sub-Account
    const ghl = createGhlClient(GHL_AGENCY_TOKEN!);
    const subAccountRes = await ghl.post('/locations/', {
      name: businessName,
      email: userEmail,
      phone: phone,
      address: '',
      city: '',
      state: '',
      postalCode: '',
      website: '',
      timezone: 'America/New_York',
      country: 'US',
      settings: {
        allowDuplicateContact: false,
        allowDuplicateOpportunity: false,
        allowFacebookNameMerge: true,
        disableContactTimezone: false
      }
    });

    const subAccount = subAccountRes.data;

    // TODO: Update UserAccount in DynamoDB with sub-account info
    // TODO: Set up billing subscription
    // TODO: Configure default pipelines and workflows

    return NextResponse.json({
      success: true,
      subAccountId: subAccount.id,
      locationId: subAccount.id,
      message: 'GHL sub-account created successfully'
    });

  } catch (error: any) {
    console.error('Sub-account creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create sub-account', details: error.message },
      { status: 500 }
    );
  }
}
