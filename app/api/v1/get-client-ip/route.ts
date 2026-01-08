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
