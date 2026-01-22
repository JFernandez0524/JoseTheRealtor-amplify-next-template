import axios from 'axios';

const GHL_API_KEY = process.env.GHL_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ConversationContext {
  contactId: string;
  conversationId: string;
  incomingMessage: string;
  contactName: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  leadType?: string;
  locationId: string;
  contact?: any; // Full contact object for field checking
  testMode?: boolean; // If true, don't send messages to GHL
  fromNumber?: string; // Phone number to send SMS from
  accessToken?: string; // GHL OAuth token for API calls
}

interface PropertyAnalysis {
  zestimate?: number;
  sqft?: number;
  beds?: number;
  baths?: number;
  yearBuilt?: number;
}

// Get property analysis using existing route
async function getPropertyAnalysis(address: string, city: string, state: string, zip: string): Promise<PropertyAnalysis | null> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/v1/analyze-property`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add auth headers if needed for internal calls
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

// Send message to GHL
async function sendGHLMessage(conversationId: string, message: string, accessToken: string, testMode = false, fromNumber?: string, contactId?: string) {
  if (testMode) {
    console.log('🧪 TEST MODE - Would send message:', message);
    return;
  }
  
  try {
    console.log(`📤 Sending message to GHL ${contactId ? `contact ${contactId}` : `conversation ${conversationId}`}`);
    
    const messagePayload: any = {
      type: 'SMS',
      message
    };
    
    // Add fromNumber if provided
    if (fromNumber) {
      messagePayload.fromNumber = fromNumber;
    }
    
    // Use contact-based endpoint if contactId provided (auto-creates conversation)
    const endpoint = contactId 
      ? `https://services.leadconnectorhq.com/conversations/messages`
      : `https://services.leadconnectorhq.com/conversations/${conversationId}/messages`;
    
    if (contactId) {
      messagePayload.contactId = contactId;
    }
    
    const response = await axios.post(
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
    console.log('✅ Message sent successfully to GHL');
  } catch (error: any) {
    console.error('❌ Failed to send GHL message:', error.response?.data || error.message);
    throw error;
  }
}

// Generate AI response using OpenAI
async function generateOpenAIResponse(context: ConversationContext, propertyData?: PropertyAnalysis): Promise<string> {
  const hasPropertyData = propertyData?.zestimate;
  const hasAddress = context.propertyAddress && context.propertyCity && context.propertyState;
  
  const propertyInfo = propertyData ? 
    `Property Details: ${context.propertyAddress}, ${context.propertyCity}, ${context.propertyState} ${context.propertyZip}
    Estimated Value: $${propertyData.zestimate?.toLocaleString() || 'N/A'}
    ${propertyData.sqft ? `Square Feet: ${propertyData.sqft}` : ''}
    ${propertyData.beds ? `Bedrooms: ${propertyData.beds}` : ''}
    ${propertyData.baths ? `Bathrooms: ${propertyData.baths}` : ''}
    ${propertyData.yearBuilt ? `Year Built: ${propertyData.yearBuilt}` : ''}` : '';

  const cashOffer = propertyData?.zestimate ? Math.round(propertyData.zestimate * 0.70) : null;
  const offerInfo = cashOffer && propertyData ? 
    `\nOFFER OPTIONS:
    - AS-IS CASH OFFER: $${cashOffer.toLocaleString()} (70% of market value, quick close)
    - RETAIL LISTING: $${propertyData.zestimate?.toLocaleString()} (maximum value, traditional sale)` : '';

  // Adapt script based on available data
  const isInitialOutreach = context.incomingMessage === 'initial_outreach';
  
  // AMMO Framework context for AI
  const situationContext = context.leadType === 'Probate' 
    ? 'navigating the complexity and stress of settling an estate'
    : 'facing the pressure and uncertainty of a foreclosure situation';
  
  const emotionalTrigger = context.leadType === 'Probate'
    ? 'avoiding the burden of property maintenance and estate complications'
    : 'preventing foreclosure auction and protecting their credit';

  const systemPrompt = isInitialOutreach 
    ? `You are Jose Fernandez from RE/MAX Homeland Realtors reaching out to ${context.contactName} for the FIRST TIME via SMS.

AMMO FRAMEWORK:
- Audience: ${context.leadType} lead ${situationContext}
- Message: Offer clarity and control with two clear options (speed vs. top dollar)
- Outcome: Get them to agree to a 10-minute property walkthrough

HOOK-RELATE-BRIDGE-ASK STRUCTURE:

Hook: "${context.contactName}, this is Jose Fernandez from RE/MAX Homeland Realtors."

Relate: "I help NJ families ${situationContext}. I saw the public notice about ${hasAddress ? context.propertyAddress : 'your property'}."

Bridge: "I can provide you with two options: a firm cash offer${hasPropertyData ? ` of $${cashOffer?.toLocaleString()}` : ''} for a quick close, or help you list it for maximum value${hasPropertyData ? ` around $${propertyData.zestimate?.toLocaleString()}` : ''}. Having both options gives you complete control over your next move."

Ask: "I just need 10 minutes to see the property condition so I can give you accurate numbers for both routes. Are you open to meeting with me?"

FANATICAL PROSPECTING RULES:
- NO "Hi" or "Hello" - address by name only
- Be conversational, not salesy
- Focus on their emotional trigger: ${emotionalTrigger}
- Emphasize "clarity", "control", and "options"
- Keep it personal and specific to their situation

Generate the message:`
    : `You are Jose Fernandez from RE/MAX Homeland Realtors helping ${context.contactName} with their ${context.leadType?.toLowerCase()} situation.

CONTEXT:
- Lead Type: ${context.leadType} (${situationContext})
- Property: ${hasAddress ? `${context.propertyAddress}, ${context.propertyCity}` : 'Address unknown'}
${hasPropertyData ? `- Cash Offer: $${cashOffer?.toLocaleString()} (70% of value)\n- Retail Value: $${propertyData.zestimate?.toLocaleString()}` : '- No valuation data yet'}

THEIR MESSAGE: "${context.incomingMessage}"

RESPONSE STRATEGY (HOOK-RELATE-BRIDGE-ASK):
1. Hook: Acknowledge their response directly
2. Relate: Show you understand their ${context.leadType?.toLowerCase()} situation
3. Bridge: Remind them of the two options (speed vs. top dollar) and how a 10-minute walkthrough provides clarity
4. Ask: Move toward scheduling the property visit

FANATICAL PROSPECTING RULES:
- Keep responses under 300 characters when possible
- Be empathetic about ${emotionalTrigger}
- Focus on giving them "control" and "options"
- Goal: Get to "Yes, No, or Maybe" on the property visit
- If they show interest, suggest a specific day/time
- Never be pushy - offer clarity and peace of mind

Generate your response:`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: isInitialOutreach 
          ? [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: 'Generate the initial outreach message following the 5-step script.' }
            ]
          : [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: context.incomingMessage }
            ],
        max_tokens: 150,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0]?.message?.content || 'Thanks for your message. Let me get back to you shortly.';
  } catch (error) {
    console.error('OpenAI API error:', error);
    return 'Thanks for reaching out! I\'d love to help with your property. Can you tell me more about your situation?';
  }
}

// Check if contact has AI enabled and is in good standing
function isAIEnabled(contact: any): boolean {
  // 🔧 TEMPORARY FIX: Since AI control fields don't exist yet,
  // enable AI for contacts with phone numbers and specific lead types
  const hasPhone = contact?.phone;
  const leadType = contact?.customFields?.find((f: any) => f.id === 'oaf4wCuM3Ub9eGpiddrO')?.value;
  const contactType = contact?.customFields?.find((f: any) => f.id === 'pGfgxcdFaYAkdq0Vp53j')?.value;
  
  // Enable AI for contacts with phones that aren't direct mail only
  const isDirectMailOnly = contactType === 'Direct Mail';
  const hasValidLeadType = ['Probate', 'PREFORECLOSURE', 'Preforeclosure'].includes(leadType);
  
  return hasPhone && hasValidLeadType && !isDirectMailOnly;
  
  // 🚨 TODO: Once AI control fields are added to GHL, use this logic:
  // const appPlan = contact?.customFields?.find((f: any) => f.id === 'YEJuROSCNnG9OXi3K8lb')?.value;
  // const accountStatus = contact?.customFields?.find((f: any) => f.id === 'diShiF2bpX7VFql08MVN')?.value;
  // const aiState = contact?.customFields?.find((f: any) => f.id === '1NxQW2kKMVgozjSUuu7s')?.value;
  // const hasAIPlan = appPlan === 'AI';
  // const accountActive = accountStatus === 'active';
  // const aiNotPaused = aiState !== 'paused';
  // return hasAIPlan && accountActive && aiNotPaused;
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

// Main conversation handler
export async function generateAIResponse(context: ConversationContext): Promise<string> {
  try {
    // Require accessToken for non-test mode
    if (!context.testMode && !context.accessToken) {
      throw new Error('accessToken is required for production mode');
    }

    // 🛡️ Check if AI is enabled for this contact (app is source of truth)
    if (!context.testMode && !isAIEnabled(context.contact)) {
      console.log(`AI disabled for contact ${context.contactId}`);
      return 'Thanks for your message! Someone will get back to you soon.';
    }

    // Update AI state to running (skip in test mode)
    if (!context.testMode && context.accessToken) {
      await updateAIState(context.contactId, 'running', context.accessToken);
    }

    // Check if human handoff is needed
    if (shouldHandoffToHuman(context.incomingMessage)) {
      // Update AI state to handoff
      if (!context.testMode && context.accessToken) {
        await updateAIState(context.contactId, 'handoff', context.accessToken);
        
        // Tag contact for human follow-up in GHL
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

      const handoffMessage = "Great! I'll have one of our property specialists reach out to you within the next few hours to discuss your options. Thanks for your interest!";
      await sendGHLMessage(context.conversationId, handoffMessage, context.accessToken || '', context.testMode, context.fromNumber, context.contactId);
      return handoffMessage;
    }

    // Get property analysis for context
    let propertyData: PropertyAnalysis | null = null;
    if (context.propertyAddress && context.propertyCity && context.propertyState) {
      propertyData = await getPropertyAnalysis(
        context.propertyAddress,
        context.propertyCity,
        context.propertyState,
        context.propertyZip || ''
      );
    }

    // Generate AI response
    const aiMessage = await generateOpenAIResponse(context, propertyData || undefined);

    // Send response to GHL (skip in test mode)
    await sendGHLMessage(context.conversationId, aiMessage, context.accessToken || '', context.testMode, context.fromNumber, context.contactId);

    return aiMessage;

  } catch (error) {
    console.error('Conversation handler error:', error);
    const fallbackMessage = "Thanks for your message! I'll have someone get back to you soon.";
    if (context.accessToken) {
      await sendGHLMessage(context.conversationId, fallbackMessage, context.accessToken, context.testMode, context.fromNumber, context.contactId);
    }
    return fallbackMessage;
  }
}
