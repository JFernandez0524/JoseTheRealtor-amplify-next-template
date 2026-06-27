/**
 * WEBHOOK TEST ENDPOINT
 *
 * Development/debug utility that logs all incoming request headers and body.
 * Use to inspect what payloads third-party services (GHL, Stripe, etc.) send.
 *
 * POST /api/v1/webhook-test — logs and returns { success: true }
 * GET  /api/v1/webhook-test — returns endpoint status message
 *
 * AUTH: None
 * NOTE: Remove or gate behind auth before exposing in production.
 */
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const headers = Object.fromEntries(req.headers.entries());
    
    console.log('=== WEBHOOK TEST RECEIVED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Headers:', JSON.stringify(headers, null, 2));
    console.log('Body:', body);
    console.log('=== END WEBHOOK TEST ===');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook test received successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Webhook test error:', error);
    return NextResponse.json({ success: false, error: 'Test failed' });
  }
}

export async function GET(req: Request) {
  return NextResponse.json({ 
    message: 'Webhook test endpoint is ready',
    endpoint: '/api/v1/webhook-test',
    method: 'POST'
  });
}
