import { NextResponse } from 'next/server';
import {
  AuthIsUserAuthenticatedServer,
  AuthGetUserGroupsServer,
} from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';

export async function POST(req: Request) {
  try {
    // 🛡️ Optional auth check for premium features
    const isAuthenticated = await AuthIsUserAuthenticatedServer();
    const groups = isAuthenticated ? await AuthGetUserGroupsServer() : [];
    const isPremium = groups.includes('PRO') || groups.includes('AI_PLAN') || groups.includes('ADMINS');

    const body = await req.json();
    const { lat, lng, street: incomingStreet, city: incomingCity, state: incomingState, zip: incomingZip } = body;
    let { standardizedAddress } = body;

    // Parse standardizedAddress if it's a JSON string
    if (typeof standardizedAddress === 'string' && standardizedAddress.startsWith('{')) {
      try {
        standardizedAddress = JSON.parse(standardizedAddress);
      } catch (e) {}
    }

    // Extract address components
    const street = standardizedAddress?.street?.S || standardizedAddress?.street || incomingStreet || '';
    const city = standardizedAddress?.city?.S || standardizedAddress?.city || incomingCity || '';
    const state = standardizedAddress?.state?.S || standardizedAddress?.state || incomingState || '';
    const zip = standardizedAddress?.zip?.S || standardizedAddress?.zip || incomingZip || '';

    // Use the utility function
    const result = await analyzeBridgeProperty({ street, city, state, zip, lat, lng });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('SERVER ERROR:', error.message);
    return NextResponse.json(
      { success: false, error: error.message, details: error.response?.data || null },
      { status: 500 }
    );
  }
}
