import { NextResponse } from 'next/server';
import { generateAIResponse } from '@/app/utils/ai/conversationHandler';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // GHL webhook payload structure
    const {
      type,
      contactId,
      conversationId,
      message,
      contact,
      locationId
    } = body;

    // Only handle incoming messages from contacts
    if (type !== 'InboundMessage' || !message?.body) {
      return NextResponse.json({ success: true, message: 'Ignored' });
    }

    // Get property data from contact custom fields
    const propertyAddress = contact?.customFields?.find((f: any) => f.id === 'p3NOYiInAERYbe0VsLHB')?.value;
    const propertyCity = contact?.customFields?.find((f: any) => f.id === 'h4UIjKQvFu7oRW4SAY8W')?.value;
    const propertyState = contact?.customFields?.find((f: any) => f.id === '9r9OpQaxYPxqbA6Hvtx7')?.value;
    const propertyZip = contact?.customFields?.find((f: any) => f.id === 'hgbjsTVwcyID7umdhm2o')?.value;
    const leadType = contact?.customFields?.find((f: any) => f.id === 'oaf4wCuM3Ub9eGpiddrO')?.value;

    // Generate AI response
    const aiResponse = await generateAIResponse({
      contactId,
      conversationId,
      incomingMessage: message.body,
      contactName: `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim(),
      propertyAddress,
      propertyCity,
      propertyState,
      propertyZip,
      leadType,
      locationId,
      contact // Pass full contact object
    });

    return NextResponse.json({ 
      success: true, 
      response: aiResponse 
    });

  } catch (error: any) {
    console.error('GHL Webhook Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
