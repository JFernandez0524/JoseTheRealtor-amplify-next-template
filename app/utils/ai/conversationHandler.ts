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
async function sendGHLMessage(conversationId: string, message: string) {
  try {
    await axios.post(
      `https://services.leadconnectorhq.com/conversations/${conversationId}/messages`,
      {
        type: 'SMS',
        message
      },
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Failed to send GHL message:', error);
  }
}

// Generate AI response using OpenAI
async function generateOpenAIResponse(context: ConversationContext, propertyData?: PropertyAnalysis): Promise<string> {
  const propertyInfo = propertyData ? 
    `Property Details: ${context.propertyAddress}, ${context.propertyCity}, ${context.propertyState} ${context.propertyZip}
    Estimated Value: $${propertyData.zestimate?.toLocaleString() || 'N/A'}
    ${propertyData.sqft ? `Square Feet: ${propertyData.sqft}` : ''}
    ${propertyData.beds ? `Bedrooms: ${propertyData.beds}` : ''}
    ${propertyData.baths ? `Bathrooms: ${propertyData.baths}` : ''}
    ${propertyData.yearBuilt ? `Year Built: ${propertyData.yearBuilt}` : ''}` : '';

  const systemPrompt = `You are a professional real estate investor assistant helping homeowners with ${context.leadType?.toLowerCase() || 'real estate'} situations. 

Your goal is to:
1. Build rapport and understand their situation
2. Offer to purchase their property as-is for cash OR list it for them
3. Identify qualified leads who are motivated to sell
4. Schedule appointments for serious prospects

Key Guidelines:
- Be empathetic and professional
- Focus on solving their problems (probate/foreclosure stress)
- Mention cash offers and quick closings
- Ask qualifying questions about timeline and motivation
- Keep responses under 160 characters for SMS
- If they show strong interest, ask to schedule a call

${propertyInfo}

Contact: ${context.contactName}
Their message: "${context.incomingMessage}"

Respond naturally and helpfully:`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
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
  const appPlan = contact?.customFields?.find((f: any) => f.id === 'YEJuROSCNnG9OXi3K8lb')?.value;
  const accountStatus = contact?.customFields?.find((f: any) => f.id === 'diShiF2bpX7VFql08MVN')?.value;
  const aiState = contact?.customFields?.find((f: any) => f.id === '1NxQW2kKMVgozjSUuu7s')?.value;
  
  // Check if AI is enabled and account is in good standing
  const hasAIPlan = appPlan === 'AI';
  const accountActive = accountStatus === 'active';
  const aiNotPaused = aiState !== 'paused';
  
  return hasAIPlan && accountActive && aiNotPaused;
}

// Update AI state in GHL
async function updateAIState(contactId: string, newState: string) {
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
          'Authorization': `Bearer ${GHL_API_KEY}`,
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
    // 🛡️ Check if AI is enabled for this contact (app is source of truth)
    if (!isAIEnabled(context.contact)) {
      console.log(`AI disabled for contact ${context.contactId}`);
      return 'Thanks for your message! Someone will get back to you soon.';
    }

    // Update AI state to running
    await updateAIState(context.contactId, 'running');

    // Check if human handoff is needed
    if (shouldHandoffToHuman(context.incomingMessage)) {
      // Update AI state to handoff
      await updateAIState(context.contactId, 'handoff');
      
      // Tag contact for human follow-up in GHL
      await axios.post(
        `https://services.leadconnectorhq.com/contacts/${context.contactId}/tags`,
        { tags: ['Ready-For-Human-Contact'] },
        {
          headers: {
            'Authorization': `Bearer ${GHL_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const handoffMessage = "Great! I'll have one of our property specialists reach out to you within the next few hours to discuss your options. Thanks for your interest!";
      await sendGHLMessage(context.conversationId, handoffMessage);
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

    // Send response to GHL
    await sendGHLMessage(context.conversationId, aiMessage);

    return aiMessage;

  } catch (error) {
    console.error('Conversation handler error:', error);
    const fallbackMessage = "Thanks for your message! I'll have someone get back to you soon.";
    await sendGHLMessage(context.conversationId, fallbackMessage);
    return fallbackMessage;
  }
}
