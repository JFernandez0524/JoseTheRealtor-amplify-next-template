/**
 * GET /api/v1/get-client-ip
 *
 * Returns the client's IP address by reading x-forwarded-for / x-real-ip headers.
 * Used client-side to resolve the originating IP for logging or geo lookups.
 *
 * AUTH: None
 * RESPONSE: { ip: string, headers: { x-forwarded-for, x-real-ip } }
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get client IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const clientIP = forwarded?.split(',')[0] || realIP || '0.0.0.0';

  return NextResponse.json({ 
    ip: clientIP,
    headers: {
      'x-forwarded-for': forwarded,
      'x-real-ip': realIP,
    }
  });
}
