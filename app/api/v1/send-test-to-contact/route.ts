import { NextResponse } from 'next/server';
import axios from 'axios';
import { generateAIResponse } from '@/app/utils/ai/conversationHandler';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { getValidGhlToken } from '@/app/utils/aws/data/ghlIntegration.server';

/**
 * OUTBOUND AI MESSAGING ENDPOINT
 * 
 * Sends AI-generated outreach messages to GHL contacts.
 * Used for initial prospecting and manual outreach.
 * 
 * WORKFLOW:
 * 1. Authenticate user
 * 2. Get valid GHL OAuth token (auto-refresh if expired)
 * 3. Fetch contact data from GHL API
 * 4. Extract property info from custom fields
 * 5. Generate AI message using 5-step script
 * 6. Send via GHL Conversations API
 * 
 * USAGE:
 * POST /api/v1/send-test-to-contact
 * Body: { contactId: "ghl-contact-id" }
 * 
 * RELATED FILES:
 * - app/utils/ai/conversationHandler.ts - AI message generation
 * - app/utils/aws/data/ghlIntegration.server.ts - OAuth token management
 * - amplify/functions/dailyOutreachAgent/handler.ts - Automated daily outreach
 * 
 * @example
 * // From browser (logged in)
 * fetch('/api/v1/send-test-to-contact', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ contactId: 'OnI6dClVhzwFU8ZOx2rU' })
 * })
 */
export async function POST(req: Request) {
  try {
    const { contactId } = await req.json();
    
    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId is required' },
        { status: 400 }
      );
    }

    // Get current user
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's valid GHL OAuth token (auto-refreshes if expired)
    const GHL_ACCESS_TOKEN = await getValidGhlToken(user.userId);
    if (!GHL_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'GHL integration not found. Please connect your GHL account.' },
        { status: 404 }
      );
    }

    // 1. Fetch contact from GHL
    const contactResponse = await axios.get(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_ACCESS_TOKEN}`,
          'Version': '2021-07-28'
        }
      }
    );

    const contact = contactResponse.data.contact;

    // 2. Extract property data from custom fields
    const propertyAddress = contact?.customFields?.find((f: any) => f.id === 'p3NOYiInAERYbe0VsLHB')?.value;
    const propertyCity = contact?.customFields?.find((f: any) => f.id === 'h4UIjKQvFu7oRW4SAY8W')?.value;
    const propertyState = contact?.customFields?.find((f: any) => f.id === '9r9OpQaxYPxqbA6Hvtx7')?.value;
    const propertyZip = contact?.customFields?.find((f: any) => f.id === 'hgbjsTVwcyID7umdhm2o')?.value;
    const leadType = contact?.customFields?.find((f: any) => f.id === 'oaf4wCuM3Ub9eGpiddrO')?.value;

    // 3. Get or create conversation
    let conversationId = contact.conversationId;
    if (!conversationId) {
      // Create conversation if it doesn't exist
      const convResponse = await axios.post(
        'https://services.leadconnectorhq.com/conversations',
        {
          locationId: contact.locationId,
          contactId: contactId
        },
        {
          headers: {
            'Authorization': `Bearer ${GHL_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28'
          }
        }
      );
      conversationId = convResponse.data.conversation.id;
    }

    // 4. Generate AI outreach message (simulate initial contact)
    const aiMessage = await generateAIResponse({
      contactId,
      conversationId,
      incomingMessage: "initial_outreach", // Special flag for first message
      contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
      propertyAddress,
      propertyCity,
      propertyState,
      propertyZip,
      leadType,
      locationId: contact.locationId,
      contact
    });

    return NextResponse.json({
      success: true,
      message: 'Outbound message sent successfully',
      contact: {
        name: `${contact.firstName} ${contact.lastName}`,
        phone: contact.phone,
        propertyAddress: propertyAddress ? `${propertyAddress}, ${propertyCity}, ${propertyState}` : 'Not available'
      },
      sentMessage: aiMessage,
      conversationId
    });

  } catch (error: any) {
    console.error('Send outbound message error:', error.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/v1/send-test-to-contact',
    method: 'POST',
    description: 'Send an OUTBOUND AI message to a GHL contact',
    requiredFields: ['contactId'],
    example: {
      contactId: "OnI6dClVhzwFU8ZOx2rU"
    },
    note: 'Looks up contact info and sends personalized outreach message using your GHL OAuth token'
  });
}
