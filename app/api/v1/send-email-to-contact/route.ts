import { NextResponse } from 'next/server';
import axios from 'axios';
import { generateEmailAIResponse } from '@/app/utils/ai/emailConversationHandler';

/**
 * PRODUCTION OUTBOUND EMAIL ENDPOINT
 * 
 * Used by dailyEmailAgent Lambda for automated email outreach.
 * Does NOT require user authentication - uses provided access token.
 * 
 * WORKFLOW:
 * 1. Validate access token provided in request
 * 2. Fetch contact data from GHL API
 * 3. Extract property info from custom fields
 * 4. Generate AI email using AMMO framework
 * 5. Send via GHL Conversations API
 * 
 * USAGE:
 * POST /api/v1/send-email-to-contact
 * Body: { contactId: string, accessToken: string, fromEmail: string }
 */
export async function POST(req: Request) {
  try {
    const { contactId, accessToken, fromEmail } = await req.json();
    
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

    // Use placeholder conversationId - the email handler will send directly to contact
    const conversationId = 'auto';

    // Generate and send AI email
    const emailResponse = await generateEmailAIResponse({
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
      fromEmail,
      accessToken
    });

    return NextResponse.json({
      success: true,
      contactId,
      conversationId,
      subject: emailResponse.subject
    });

  } catch (error: any) {
    console.error('Send email error:', error.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: error.response?.data?.message || error.message
    }, { status: 500 });
  }
}
