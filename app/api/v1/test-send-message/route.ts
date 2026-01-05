import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { contactId } = await req.json();
    
    if (!contactId) {
      return NextResponse.json({ error: 'contactId required' }, { status: 400 });
    }

    // Test sending a message to this contact
    const testMessage = "This is a test message from your AI system. Please reply 'test' to confirm you receive this.";
    
    const response = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      },
      body: JSON.stringify({
        type: 'SMS',
        contactId,
        message: testMessage
      })
    });

    const result = await response.json();
    
    return NextResponse.json({
      success: response.ok,
      message: response.ok ? 'Test message sent successfully' : 'Failed to send message',
      result,
      testMessage
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
