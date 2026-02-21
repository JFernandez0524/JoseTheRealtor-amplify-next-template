/**
 * POST /api/v1/analyze-property
 * 
 * Analyzes a property using Bridge API (Zillow Zestimate data).
 * 
 * REQUEST BODY:
 * - street: string - Street address (e.g., "123 Main St")
 * - city: string - City name
 * - state: string - State abbreviation (e.g., "FL")
 * - zip: string - ZIP code
 * - lat?: number - Latitude (optional, for coordinate fallback)
 * - lng?: number - Longitude (optional, for coordinate fallback)
 * - address?: string - Raw address string (fallback if structured data not provided)
 * 
 * RESPONSE:
 * - success: boolean - Whether property was found
 * - valuation: object - Zestimate data (zestimate, zpid, address, etc.)
 * - assessment: object - Property assessment data (optional)
 * - error?: string - Error message if failed
 * 
 * AUTHENTICATION:
 * - Optional (works for both authenticated and anonymous users)
 * - Premium users (PRO, AI_PLAN, ADMINS) may have additional features
 * 
 * USED BY:
 * - Frontend property analyzer
 * - Lead detail pages
 * - Property valuation lookups
 */
import { NextResponse } from 'next/server';
import {
  AuthIsUserAuthenticatedServer,
  AuthGetUserGroupsServer,
} from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';

const ALLOWED_ORIGIN = 'https://jose-fernandez.remax.com';

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
};

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { 
    status: 204, 
    headers: getCorsHeaders(req) 
  });
}

export async function POST(req: Request) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const isAuthenticated = await AuthIsUserAuthenticatedServer();
    const groups = isAuthenticated ? await AuthGetUserGroupsServer() : [];
    const isPremium = groups.includes('PRO') || groups.includes('AI_PLAN') || groups.includes('ADMINS');

    const body = await req.json();
    console.log('📥 Received body:', body);
    
    const { lat, lng, street, city, state, zip, address } = body;

    let result;

    if (street && city && state && zip) {
      console.log('✅ Using structured address:', { street, city, state, zip });
      result = await analyzeBridgeProperty({ street, city, state, zip, lat, lng });
    } else if (address) {
      console.log('⚠️ Using raw address string:', address);
      result = await analyzeBridgeProperty({ street: address, lat, lng });
    } else {
      throw new Error('No address data provided');
    }

    return NextResponse.json(result, { headers: corsHeaders });

  } catch (error: any) {
    console.error('SERVER ERROR:', error.message);
    return NextResponse.json(
      { success: false, error: error.message, details: error.response?.data || null },
      { status: 500, headers: corsHeaders }
    );
  }
}
