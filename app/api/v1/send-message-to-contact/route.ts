import { NextResponse } from 'next/server';
import axios from 'axios';
import { generateAIResponse } from '@/app/utils/ai/conversationHandler';

/**
 * PRODUCTION OUTBOUND MESSAGING ENDPOINT
 * 
 * Used by dailyOutreachAgent Lambda for automated outreach.
 * Does NOT require user authentication - uses provided access token.
 * 
 * WORKFLOW:
 * 1. Validate access token provided in request
 * 2. Fetch contact data from GHL API
 * 3. Extract property info from custom fields
 * 4. Generate AI message using 5-step script
 * 5. Send via GHL Conversations API
 * 
 * USAGE:
 * POST /api/v1/send-message-to-contact
 * Body: { contactId: string, accessToken: string }
 */
export async function POST(req: Request) {
  try {
    const { contactId, accessToken, fromNumber } = await req.json();
    
    if (!contactId || !accessToken) {
      return NextResponse.json(
        { error: 'contactId and accessToken are required' },
        { status: 400 }
      );
    }

    // Fetch contact from GHL
    const contactResponse = await axios.get(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28'
        }
      }
    );

    const contact = contactResponse.data.contact;

    // Extract property data from custom fields
    const propertyAddress = contact?.customFields?.find((f: any) => f.id === 'p3NOYiInAERYbe0VsLHB')?.value;
    const propertyCity = contact?.customFields?.find((f: any) => f.id === 'h4UIjKQvFu7oRW4SAY8W')?.value;
    const propertyState = contact?.customFields?.find((f: any) => f.id === '9r9OpQaxYPxqbA6Hvtx7')?.value;
    const propertyZip = contact?.customFields?.find((f: any) => f.id === 'hgbjsTVwcyID7umdhm2o')?.value;
    const leadType = contact?.customFields?.find((f: any) => f.id === 'oaf4wCuM3Ub9eGpiddrO')?.value;

    // Use a placeholder conversationId - the AI handler will send directly to contact
    const conversationId = 'auto';

    // Generate and send AI outreach message
    await generateAIResponse({
      contactId,
      conversationId,
      incomingMessage: "initial_outreach",
      contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
      propertyAddress,
      propertyCity,
      propertyState,
      propertyZip,
      leadType,
      locationId: contact.locationId,
      contact,
      fromNumber, // Pass phone number to AI handler
      accessToken // Pass OAuth token for GHL API calls
    });

    return NextResponse.json({
      success: true,
      contactId,
      conversationId
    });

  } catch (error: any) {
    console.error('Send message error:', error.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: error.response?.data?.message || error.message
    }, { status: 500 });
  }
}
