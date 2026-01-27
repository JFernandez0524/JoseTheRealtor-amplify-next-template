import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * EMAIL CONVERSATION HANDLER
 * 
 * Handles automated email conversations with leads using the AMMO framework
 * (Audience-Message-Method-Outcome) and Hook-Relate-Bridge-Ask structure.
 * 
 * FRAMEWORK:
 * - Hook: Professional salutation (name only, no "Hi/Hello")
 * - Relate: Shows understanding of their probate/foreclosure situation
 * - Bridge: Presents two clear options (cash offer vs retail listing)
 * - Ask: Invites them to meet and discuss options
 * 
 * FEATURES:
 * - Generates personalized emails with property-specific details
 * - Includes cash offer (70% of Zestimate) and retail value
 * - Professional formatting with bullet points
 * - Signature block with contact information
 * - Detects handoff keywords for human follow-up
 * - Updates AI state in GHL custom fields
 * 
 * USAGE:
 * - Initial outreach: Set incomingMessage to "initial_outreach"
 * - Reply handling: Set incomingMessage to the contact's email body
 * - Test mode: Set testMode to true to prevent sending
 * 
 * RELATED FILES:
 * - /api/v1/send-email-to-contact - API route for sending emails
 * - /api/v1/ghl-email-webhook - Webhook for handling replies
 * - amplify/functions/dailyEmailAgent - Lambda for daily automation
 */

interface EmailConversationContext {
  contactId: string;
  conversationId: string;
  incomingMessage: string;
  contactName: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  leadType?: string;
  zestimate?: number;
  emailSignature?: string;
  locationId: string;
  contact?: any;
  testMode?: boolean;
  fromEmail?: string;
  accessToken?: string;
}

interface PropertyAnalysis {
  zestimate?: number;
  sqft?: number;
  beds?: number;
  baths?: number;
  yearBuilt?: number;
}

// Get property analysis
async function getPropertyAnalysis(address: string, city: string, state: string, zip: string): Promise<PropertyAnalysis | null> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/v1/analyze-property`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        street: address,
        city,
        state,
        zip
      })
    });

    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      zestimate: data.valuation?.zestimate,
      sqft: data.valuation?.livingArea,
      beds: data.valuation?.bedrooms,
      baths: data.valuation?.bathrooms,
      yearBuilt: data.valuation?.yearBuilt
    };
  } catch (error) {
    console.error('Property analysis error:', error);
    return null;
  }
}

// Send email via GHL
async function sendGHLEmail(
  conversationId: string,
  subject: string,
  body: string,
  accessToken: string,
  testMode = false,
  fromEmail?: string,
  contactId?: string
) {
  if (testMode) {
    console.log('🧪 TEST MODE - Would send email:', { subject, body });
    return;
  }
  
  try {
    console.log(`📧 Sending email to GHL ${contactId ? `contact ${contactId}` : `conversation ${conversationId}`}`);
    
    const messagePayload: any = {
      type: 'Email',
      subject,
      html: body
    };
    
    if (fromEmail) {
      messagePayload.emailFrom = fromEmail;
    }
    
    // Use contact-based endpoint if contactId provided
    const endpoint = contactId 
      ? `https://services.leadconnectorhq.com/conversations/messages`
      : `https://services.leadconnectorhq.com/conversations/${conversationId}/messages`;
    
    if (contactId) {
      messagePayload.contactId = contactId;
    }
    
    await axios.post(
      endpoint,
      messagePayload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      }
    );
    console.log('✅ Email sent successfully to GHL');
  } catch (error: any) {
    console.error('❌ Failed to send GHL email:', error.response?.data || error.message);
    throw error;
  }
}

// Generate AI email response using OpenAI
async function generateEmailResponse(context: EmailConversationContext, propertyData?: PropertyAnalysis): Promise<{ subject: string; body: string }> {
  const hasPropertyData = propertyData?.zestimate;
  const hasAddress = context.propertyAddress && context.propertyCity && context.propertyState;
  
  const cashOffer = propertyData?.zestimate ? Math.round(propertyData.zestimate * 0.70) : null;
  const isInitialOutreach = context.incomingMessage === 'initial_outreach';
  
  const situationContext = context.leadType === 'Probate' 
    ? 'navigate the complexity and stress of settling estates'
    : 'facing foreclosure situations';

  const systemPrompt = isInitialOutreach 
    ? `You are Jose Fernandez from RE/MAX Homeland Realtors sending a FIRST-TIME email to ${context.contactName} about their ${context.leadType?.toLowerCase()} situation.

AMMO FRAMEWORK:
- Audience: ${context.leadType} lead ${situationContext}
- Message: Offer clarity and control with two clear options
- Outcome: Get them to agree to a 10-minute property walkthrough

GENERATE EMAIL WITH THIS STRUCTURE:

SUBJECT LINE (3-6 words):
"Clarity on ${hasAddress ? context.propertyAddress : 'your property'}"

BODY (HOOK-RELATE-BRIDGE-ASK):

${context.contactName},

I help NJ families ${situationContext}. I saw the public notice regarding the property at ${hasAddress ? context.propertyAddress + ' in ' + context.propertyCity : 'your property'}.

I can provide you with two clear options:

• AS-IS CASH OFFER: ${hasPropertyData ? `$${cashOffer?.toLocaleString()}` : '[Amount TBD]'} (quick close, no repairs needed)
• RETAIL LISTING: ${hasPropertyData ? `$${propertyData.zestimate?.toLocaleString()}` : '[Amount TBD]'} (maximum value, traditional sale)

Having both options gives you complete control over your next move and removes the uncertainty from this process.

I just need 10 minutes to see the property condition so I can give you accurate numbers for both routes.

Are you open to meeting with me to discuss your options?

${context.emailSignature || `Jose Fernandez
RE/MAX Homeland Realtors
(732) 810-0182`}

RULES:
- NO "Hi" or "Hello" - use name only with comma
- Keep professional but empathetic tone
- Include dollar amounts if available
- Use bullet points for options
- End with signature block (use provided HTML signature if available)

Generate the email (return as JSON with "subject" and "body" fields):`
    : `You are Jose Fernandez from RE/MAX Homeland Realtors responding to ${context.contactName}'s email about their ${context.leadType?.toLowerCase()} situation.

CONTEXT:
- Property: ${hasAddress ? `${context.propertyAddress}, ${context.propertyCity}` : 'Address unknown'}
${hasPropertyData ? `- Cash Offer: $${cashOffer?.toLocaleString()}\n- Retail Value: $${propertyData.zestimate?.toLocaleString()}` : '- No valuation data yet'}

THEIR EMAIL: "${context.incomingMessage}"

RESPONSE STRATEGY (HOOK-RELATE-BRIDGE-ASK):
1. Hook: Acknowledge their response directly
2. Relate: Show you understand their situation
3. Bridge: Remind them of the two options and how a walkthrough provides clarity
4. Ask: Move toward scheduling the property visit

RULES:
- Keep response under 150 words
- Be empathetic and professional
- Focus on "control" and "options"
- Goal: Get to "Yes, No, or Maybe" on property visit
- If they show interest, suggest meeting
- Include signature block

Generate the email response (return as JSON with "subject" and "body" fields):`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: isInitialOutreach ? 'Generate the initial outreach email.' : context.incomingMessage }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const result = JSON.parse(response.data.choices[0]?.message?.content || '{}');
    return {
      subject: result.subject || `Re: ${context.propertyAddress || 'Your Property'}`,
      body: result.body || 'Thanks for your message. I\'ll get back to you shortly.'
    };
  } catch (error: any) {
    console.error('❌ OpenAI API error:', error);
    console.error('❌ Full error details:', JSON.stringify(error, null, 2));
    throw new Error(`AI email generation failed: ${error.message}`);
  }
}

// Check if contact has AI enabled
function isAIEnabled(contact: any): boolean {
  const hasEmail = contact?.email;
  const leadType = contact?.customFields?.find((f: any) => f.id === 'oaf4wCuM3Ub9eGpiddrO')?.value;
  const contactType = contact?.customFields?.find((f: any) => f.id === 'pGfgxcdFaYAkdq0Vp53j')?.value;
  
  const isDirectMailOnly = contactType === 'Direct Mail';
  const hasValidLeadType = ['Probate', 'PREFORECLOSURE', 'Preforeclosure'].includes(leadType);
  
  return hasEmail && hasValidLeadType && !isDirectMailOnly;
}

// Update AI state in GHL
async function updateAIState(contactId: string, newState: string, accessToken: string) {
  try {
    await axios.put(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        customFields: [
          { id: '1NxQW2kKMVgozjSUuu7s', value: newState }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Failed to update AI state:', error);
  }
}

function shouldHandoffToHuman(message: string): boolean {
  const handoffKeywords = [
    'speak to someone',
    'talk to a person',
    'human',
    'agent',
    'ready to sell',
    'schedule',
    'appointment',
    'call me',
    'interested',
    'yes i want',
    'how much',
    'what can you offer'
  ];

  return handoffKeywords.some(keyword => 
    message.toLowerCase().includes(keyword)
  );
}

// Main email conversation handler
export async function generateEmailAIResponse(context: EmailConversationContext): Promise<{ subject: string; body: string }> {
  try {
    // Require accessToken for non-test mode
    if (!context.testMode && !context.accessToken) {
      throw new Error('accessToken is required for production mode');
    }

    // Check if AI is enabled for this contact
    if (!context.testMode && !isAIEnabled(context.contact)) {
      console.log(`❌ AI disabled for contact ${context.contactId}`);
      throw new Error('AI is not enabled for this contact');
    }

    // Update AI state to running
    if (!context.testMode && context.accessToken) {
      await updateAIState(context.contactId, 'running', context.accessToken);
    }

    // Check if human handoff is needed
    if (shouldHandoffToHuman(context.incomingMessage)) {
      if (!context.testMode && context.accessToken) {
        await updateAIState(context.contactId, 'handoff', context.accessToken);
        
        // Tag contact for human follow-up
        await axios.post(
          `https://services.leadconnectorhq.com/contacts/${context.contactId}/tags`,
          { tags: ['Ready-For-Human-Contact'] },
          {
            headers: {
              'Authorization': `Bearer ${context.accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      const handoffEmail = {
        subject: 'Re: Your Property Options',
        body: `${context.contactName},\n\nGreat! I'll have one of our property specialists reach out to you within the next few hours to discuss your options in detail.\n\nThanks for your interest!\n\nJose Fernandez\nRE/MAX Homeland Realtors\n(732) 810-0182`
      };
      
      await sendGHLEmail(
        context.conversationId,
        handoffEmail.subject,
        handoffEmail.body,
        context.accessToken || '',
        context.testMode,
        context.fromEmail,
        context.contactId
      );
      
      return handoffEmail;
    }

    // Get property analysis for context
    let propertyData: PropertyAnalysis | null = null;
    
    // Use provided zestimate if available, otherwise fetch from API
    if (context.zestimate) {
      propertyData = { zestimate: context.zestimate };
    } else if (context.propertyAddress && context.propertyCity && context.propertyState) {
      propertyData = await getPropertyAnalysis(
        context.propertyAddress,
        context.propertyCity,
        context.propertyState,
        context.propertyZip || ''
      );
    }

    // Generate AI email response
    const emailResponse = await generateEmailResponse(context, propertyData || undefined);

    // Send response to GHL
    await sendGHLEmail(
      context.conversationId,
      emailResponse.subject,
      emailResponse.body,
      context.accessToken || '',
      context.testMode,
      context.fromEmail,
      context.contactId
    );

    return emailResponse;

  } catch (error) {
    console.error('Email conversation handler error:', error);
    const fallbackEmail = {
      subject: 'Re: Your Property',
      body: `${context.contactName},\n\nThanks for your message! I'll get back to you shortly.\n\nJose Fernandez\nRE/MAX Homeland Realtors\n(732) 810-0182`
    };
    
    if (context.accessToken) {
      await sendGHLEmail(
        context.conversationId,
        fallbackEmail.subject,
        fallbackEmail.body,
        context.accessToken,
        context.testMode,
        context.fromEmail,
        context.contactId
      );
    }
    
    return fallbackEmail;
  }
}
