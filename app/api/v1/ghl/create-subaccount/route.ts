import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

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
    const subAccountResponse = await fetch('https://services.leadconnectorhq.com/locations/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_AGENCY_TOKEN}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      },
      body: JSON.stringify({
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
        // Pre-configure for real estate
        settings: {
          allowDuplicateContact: false,
          allowDuplicateOpportunity: false,
          allowFacebookNameMerge: true,
          disableContactTimezone: false
        }
      })
    });

    if (!subAccountResponse.ok) {
      throw new Error('Failed to create GHL sub-account');
    }

    const subAccount = await subAccountResponse.json();

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
