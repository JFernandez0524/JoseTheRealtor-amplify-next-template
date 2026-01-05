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
