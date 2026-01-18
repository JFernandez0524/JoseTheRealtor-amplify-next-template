import { NextResponse } from 'next/server';
import { generateAIResponse } from '@/app/utils/ai/conversationHandler';

/**
 * TEST ENDPOINT - Simulate AI responses without sending actual messages
 * 
 * Usage:
 * POST /api/v1/test-ai-response
 * Body: {
 *   contactName: "John Doe",
 *   incomingMessage: "How much can you offer for my house?",
 *   propertyAddress: "123 Main St",
 *   propertyCity: "Miami",
 *   propertyState: "FL",
 *   propertyZip: "33101",
 *   leadType: "PREFORECLOSURE"
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const {
      contactName = "Test Contact",
      incomingMessage,
      propertyAddress,
      propertyCity,
      propertyState,
      propertyZip,
      leadType = "PREFORECLOSURE"
    } = body;

    if (!incomingMessage) {
      return NextResponse.json(
        { error: 'incomingMessage is required' },
        { status: 400 }
      );
    }

    // Mock context for testing
    const testContext = {
      contactId: 'test-contact-id',
      conversationId: 'test-conversation-id',
      incomingMessage,
      contactName,
      propertyAddress,
      propertyCity,
      propertyState,
      propertyZip,
      leadType,
      locationId: 'test-location-id',
      testMode: true, // Enable test mode
      contact: {
        firstName: contactName.split(' ')[0],
        lastName: contactName.split(' ')[1] || '',
        phone: '+1234567890',
        customFields: []
      }
    };

    console.log('🧪 Testing AI Response with context:', testContext);

    // Generate response WITHOUT sending to GHL
    // We'll temporarily modify the handler to skip sending
    const aiResponse = await generateAIResponse(testContext);

    return NextResponse.json({
      success: true,
      testMode: true,
      input: {
        contactName,
        message: incomingMessage,
        property: propertyAddress ? `${propertyAddress}, ${propertyCity}, ${propertyState} ${propertyZip}` : 'Not provided'
      },
      aiResponse,
      note: 'This is a TEST - no actual message was sent to GHL'
    });

  } catch (error: any) {
    console.error('Test AI Response Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/v1/test-ai-response',
    method: 'POST',
    description: 'Test AI responses without sending actual messages',
    requiredFields: ['incomingMessage'],
    optionalFields: ['contactName', 'propertyAddress', 'propertyCity', 'propertyState', 'propertyZip', 'leadType'],
    example: {
      contactName: "John Doe",
      incomingMessage: "How much can you offer?",
      propertyAddress: "123 Main St",
      propertyCity: "Miami",
      propertyState: "FL",
      propertyZip: "33101",
      leadType: "PREFORECLOSURE"
    }
  });
}
