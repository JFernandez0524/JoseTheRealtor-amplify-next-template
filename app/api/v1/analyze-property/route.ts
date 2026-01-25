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
