import { NextResponse } from 'next/server';
import { generateAIResponse } from '@/app/utils/ai/conversationHandler';

export async function POST(req: Request) {
  try {
    const { message, contactName = "Test User", propertyAddress = "123 Main St" } = await req.json();
    
    const mockContext = {
      contactId: "test-contact-123",
      conversationId: "test-conversation-123",
      incomingMessage: message,
      contactName,
      propertyAddress,
      propertyCity: "Test City",
      propertyState: "TX",
      propertyZip: "12345",
      leadType: "Probate",
      locationId: process.env.GHL_LOCATION_ID!,
      contact: {
        customFields: [
          { id: 'YEJuROSCNnG9OXi3K8lb', value: 'AI' }, // App Plan
          { id: 'diShiF2bpX7VFql08MVN', value: 'active' }, // Account Status
          { id: '1NxQW2kKMVgozjSUuu7s', value: 'active' } // AI State
        ]
      }
    };

    const response = await generateAIResponse(mockContext);
    
    return NextResponse.json({
      success: true,
      input: message,
      aiResponse: response,
      context: mockContext
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
