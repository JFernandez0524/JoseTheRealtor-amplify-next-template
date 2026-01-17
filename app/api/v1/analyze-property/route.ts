import { NextResponse } from 'next/server';
import {
  AuthIsUserAuthenticatedServer,
  AuthGetUserGroupsServer,
} from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';

export async function POST(req: Request) {
  try {
    const isAuthenticated = await AuthIsUserAuthenticatedServer();
    const groups = isAuthenticated ? await AuthGetUserGroupsServer() : [];
    const isPremium = groups.includes('PRO') || groups.includes('AI_PLAN') || groups.includes('ADMINS');

    const body = await req.json();
    console.log('📥 Received body:', body);
    
    const { lat, lng, street, city, state, zip, address } = body;

    // If we have structured data, use it directly
    if (street && city && state && zip) {
      console.log('✅ Using structured address:', { street, city, state, zip });
      const result = await analyzeBridgeProperty({ street, city, state, zip, lat, lng });
      return NextResponse.json(result);
    }

    // Otherwise fall back to raw address string
    if (address) {
      console.log('⚠️ Using raw address string:', address);
      const result = await analyzeBridgeProperty({ street: address, lat, lng });
      return NextResponse.json(result);
    }

    throw new Error('No address data provided');
  } catch (error: any) {
    console.error('SERVER ERROR:', error.message);
    return NextResponse.json(
      { success: false, error: error.message, details: error.response?.data || null },
      { status: 500 }
    );
  }
}
