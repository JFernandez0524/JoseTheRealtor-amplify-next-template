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

  const systemPrompt = isInitialOutreach 
    ? `You are Jose Fernandez from RE/MAX Homeland Realtors reaching out to ${context.contactName} for the FIRST TIME via SMS about their ${context.leadType?.toLowerCase() || 'real estate'} situation.

DELIVER THIS INITIAL OUTREACH MESSAGE:

"Hi ${context.contactName}, this is Jose Fernandez from RE/MAX Homeland Realtors. I saw the public notice about ${hasAddress ? context.propertyAddress : 'your property'} and wanted to see if I could make you a firm cash offer${hasPropertyData ? ` of $${cashOffer?.toLocaleString()}` : ''} to buy it directly, or help you list it for maximum value${hasPropertyData ? ` around $${propertyData.zestimate?.toLocaleString()}` : ''}. I work with families in these situations because having both a 'speed' option and a 'top-dollar' option gives you the most control. I just need 10 minutes to see the condition. Are you open to meeting with me to discuss your options?"

INSTRUCTIONS:
- Use the exact message above as your template
- This is SMS, so it can be longer than 160 characters (up to 1600 is fine)
- Be conversational and empathetic
- Include the specific dollar amounts if available
- End with asking if they're open to meeting

Generate the initial outreach message:`
    : `You are Jose Fernandez from RE/MAX Homeland Realtors, helping homeowners with ${context.leadType?.toLowerCase() || 'real estate'} situations.

FOLLOW THIS 5-STEP SCRIPT (adapt based on available information):
1. Get Attention: "Hi, ${context.contactName}."
2. Identify Yourself: "This is Jose Fernandez from RE/MAX Homeland Realtors."
3. The Reason: "I saw the public notice about ${hasAddress ? context.propertyAddress : 'your property'} and wanted to see if I could make you a firm cash offer to buy it directly, or help you list it for maximum value."
4. The Bridge: "I work with families in these situations because having both a 'speed' option and a 'top-dollar' option gives you the most control. I just need 10 minutes to see the condition so I can give you accurate numbers for both routes."
5. The Ask: "Are you open to meeting with me to discuss your options?"

${propertyInfo}${offerInfo}

IMPORTANT INSTRUCTIONS:
${!hasPropertyData ? '- You do NOT have property valuation data yet, so DO NOT mention specific dollar amounts' : '- You have property valuation data, include the specific offer amounts'}
${!hasAddress ? '- You do NOT have the full property address, ask for it if needed' : ''}
- If missing key information (address, value), focus on scheduling the property visit to gather details
- Keep responses conversational and under 300 characters when possible
- Goal: Get to "Yes, No, or Maybe" on a property visit
- Present BOTH options: cash offer (speed) and listing (top dollar)
- Be empathetic about their situation

Contact: ${context.contactName}
Their message: "${context.incomingMessage}"

Respond following the script:`;

  try {
    console.log('🤖 Calling OpenAI for message generation...');
    console.log(`📝 Context: ${isInitialOutreach ? 'Initial outreach' : 'Reply'} for ${context.contactName}`);
    
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

    const aiMessage = response.data.choices[0]?.message?.content || 'Thanks for your message. Let me get back to you shortly.';
    console.log(`✅ OpenAI response: ${aiMessage.substring(0, 100)}...`);
    return aiMessage;
  } catch (error: any) {
    console.error('❌ OpenAI API error:', error.response?.data || error.message);
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
