import axios from 'axios';
import { analyzeBridgeProperty } from '../../../app/utils/bridge.server';

const GHL_API_KEY = process.env.GHL_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Conversation states
type ConversationState = 
  | 'NEW_LEAD'
  | 'ASK_INTENT'
  | 'BUYER_QUALIFICATION'
  | 'SELLER_QUALIFICATION'
  | 'PROPERTY_VALUATION'
  | 'APPOINTMENT_BOOKING'
  | 'QUALIFIED';

interface ConversationContext {
  contactId: string;
  conversationId: string;
  incomingMessage: string;
  contactName: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  propertyLat?: number;
  propertyLng?: number;
  leadType?: string;
  locationId: string;
  contact?: any; // Full contact object for field checking
  testMode?: boolean; // If true, don't send messages to GHL
  fromNumber?: string; // Phone number to send SMS from
  accessToken?: string; // GHL OAuth token for API calls
  messageType?: 'SMS' | 'FB' | 'IG' | 'WhatsApp'; // Message channel type
  existingZestimate?: number; // Zestimate from database (skip API call)
  existingCashOffer?: number; // Cash offer from database (skip calculation)
  // Listing ad context (for buyer leads)
  listingAddress?: string; // Property from the ad
  listingPrice?: number;
  listingBeds?: number;
  listingBaths?: number;
  listingType?: string; // Single Family, Condo, etc.
  listingCity?: string;
  listingState?: string;
  leadIntent?: 'buyer' | 'seller'; // Determined from ad or conversation
  // State tracking
  conversationState?: ConversationState;
  budget?: string;
  timeline?: string;
  location?: string;
  motivation?: string;
}

interface PropertyAnalysis {
  zestimate?: number;
  sqft?: number;
  beds?: number;
  baths?: number;
  yearBuilt?: number;
}

// Get property analysis using Bridge API with address variations and coordinate fallback
async function getPropertyAnalysis(address: string, city: string, state: string, zip: string, lat?: number, lng?: number): Promise<PropertyAnalysis | null> {
  try {
    console.log('🏠 Fetching property data with address variations...');
    
    const result = await analyzeBridgeProperty({
      street: address,
      city,
      state,
      zip,
      lat,
      lng
    });

    if (!result.success || !result.valuation) {
      console.log('⚠️ No property data found');
      return null;
    }
    
    console.log('✅ Property data retrieved:', {
      zestimate: result.valuation.zestimate,
      address: result.valuation.address
    });
    
    return {
      zestimate: result.valuation.zestimate,
      sqft: result.valuation.livingArea,
      beds: result.valuation.bedrooms,
      baths: result.valuation.bathrooms,
      yearBuilt: result.valuation.yearBuilt
    };
  } catch (error: any) {
    console.error('❌ Property analysis error:', error.message);
    return null;
  }
}

// Send message to GHL
async function sendGHLMessage(conversationId: string, message: string, accessToken: string, testMode = false, fromNumber?: string, contactId?: string, messageType: string = 'SMS') {
  if (testMode) {
    console.log('🧪 TEST MODE - Would send message:', message);
    return;
  }
  
  try {
    console.log(`📤 Sending ${messageType} message to GHL ${contactId ? `contact ${contactId}` : `conversation ${conversationId}`}`);
    
    const messagePayload: any = {
      type: messageType, // SMS, FB, IG, WhatsApp
      message
    };
    
    // Add fromNumber if provided (SMS only)
    if (fromNumber && messageType === 'SMS') {
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
    console.log(`✅ ${messageType} message sent successfully to GHL`);
  } catch (error: any) {
    console.error(`❌ Failed to send GHL ${messageType} message:`, error.response?.data || error.message);
    throw error;
  }
}

// Generate AI response using OpenAI with tool calling
async function generateOpenAIResponse(context: ConversationContext, propertyData?: PropertyAnalysis): Promise<string> {
  // Use existing Zestimate from database if available (faster, no API call)
  const zestimate = context.existingZestimate || propertyData?.zestimate;
  const cashOffer = context.existingCashOffer || (zestimate ? Math.round(zestimate * 0.70) : null);
  
  const hasPropertyData = !!zestimate;
  const hasAddress = context.propertyAddress && context.propertyCity && context.propertyState;
  
  const propertyInfo = hasPropertyData ? 
    `Property Details: ${context.propertyAddress}, ${context.propertyCity}, ${context.propertyState} ${context.propertyZip}
    Estimated Value: $${zestimate?.toLocaleString() || 'N/A'}
    ${propertyData?.sqft ? `Square Feet: ${propertyData.sqft}` : ''}
    ${propertyData?.beds ? `Bedrooms: ${propertyData.beds}` : ''}
    ${propertyData?.baths ? `Bathrooms: ${propertyData.baths}` : ''}
    ${propertyData?.yearBuilt ? `Year Built: ${propertyData.yearBuilt}` : ''}` : '';

  const offerInfo = cashOffer && hasPropertyData ? 
    `\nOFFER OPTIONS:
    - AS-IS CASH OFFER: $${cashOffer.toLocaleString()} (70% of market value, quick close)
    - RETAIL LISTING: $${zestimate?.toLocaleString()} (maximum value, traditional sale)` : '';

  // Adapt script based on available data
  const isInitialOutreach = context.incomingMessage === 'initial_outreach';

  const systemPrompt = isInitialOutreach 
    ? `You are Jose Fernandez from RE/MAX Homeland Realtors reaching out to ${context.contactName} for the FIRST TIME via SMS.

DELIVER THIS EXACT INITIAL MESSAGE:

"Hi ${context.contactName}, Jose from RE/MAX here. I saw the notice about ${hasAddress ? context.propertyAddress : 'your property'}. Is the property still for sale? Reply STOP to opt out."

INSTRUCTIONS:
- Use the exact message above
- Keep it under 160 characters if possible
- Include the STOP opt-out for compliance

Generate the initial outreach message:`
    : `You are an AI assistant helping Jose Fernandez, a licensed real estate agent at RE/MAX Homeland Realtors.

COMPLIANCE RULES (CRITICAL):
1. IDENTIFY AS AI: If asked, say "I'm Jose's AI assistant helping with initial questions"
2. NO LEGAL/FINANCIAL ADVICE: Never give tax, legal, or financial advice
3. HUMAN HANDOFF: If asked complex questions, say "Let me connect you with Jose directly"
4. DISCLAIMERS: Property values are estimates only, not appraisals

CONVERSATION STATE: ${nextState}

STATE-SPECIFIC GUIDANCE:

${nextState === 'NEW_LEAD' || nextState === 'ASK_INTENT' ? `
🎯 GOAL: Determine if buyer or seller
ASK: "Are you looking to buy or thinking about selling?"
` : ''}

${nextState === 'SELLER_QUALIFICATION' ? `
🎯 GOAL: Get property address
ASK: "What's the address?" (if not provided)
THEN: Use validate_address tool
` : ''}

${nextState === 'PROPERTY_VALUATION' ? `
🎯 GOAL: Show property value and present options
ACTION: Use get_property_value tool
THEN: "Based on current market data, your property is valued around $X. I can offer you $Y cash for a quick close, or help you list it for the full $X. Which interests you more?"
` : ''}

${nextState === 'BUYER_QUALIFICATION' ? `
🎯 GOAL: Qualify buyer and save search
ASK ONE AT A TIME:
1. "What area are you looking in?"
2. "What's your budget?"
3. "How many bedrooms?"
4. "When are you hoping to move?"
THEN: Use save_buyer_search tool
` : ''}

${nextState === 'APPOINTMENT_BOOKING' ? `
🎯 GOAL: Book consultation
ACTION: Use check_availability tool
THEN: Present 2-3 time slots
THEN: Use schedule_consultation tool
` : ''}

${nextState === 'QUALIFIED' ? `
🎯 GOAL: Confirm appointment and set expectations
SAY: "Perfect! I'll send you a calendar invite. Looking forward to meeting you!"
` : ''}

CONVERSATION CONTEXT:
- Contact: ${context.contactName}
- Their message: "${context.incomingMessage}"
${hasAddress ? `- Known property: ${context.propertyAddress}` : ''}
${context.leadIntent ? `- Intent: ${context.leadIntent}` : ''}

SCENARIO 1: EXISTING LEAD (Has property address in system)
${hasAddress ? `
You already know about their ${context.leadType?.toLowerCase() || 'property'} situation at ${context.propertyAddress}.

CONVERSATION APPROACH:
- Acknowledge their response naturally
- If interested: Present cash offer vs listing options
- If asking about value: Use get_property_value tool
- If hesitant: Address concerns, build trust
- Goal: Schedule 10-minute property walkthrough

EXAMPLE:
Them: "Yes, still interested"
You: "Great! I wanted to see if I could make you a firm cash offer to buy it directly, or help you list it for maximum value. I work with families in these situations because having both options gives you the most control. I just need 10 minutes to see the condition. Are you open to meeting this week?"
` : `
SCENARIO 2: NEW LEAD (No property info - FB ad, website, etc.)

NATURAL CONVERSATION STYLE:
- Talk like a helpful neighbor, not a salesperson
- Use casual language: "Hey", "I'd love to help", "Let me check on that"
- Show genuine interest in their situation
- Keep responses SHORT (1-2 sentences max)

DISCOVERY FLOW:

If they ask about a specific property:
Example: "I don't see 305 Union Ave listed right now, but I can dig into it for you! Are you looking to buy in Belleville?"

STEP 1: DETERMINE INTENT (casual approach)
- "Are you looking to buy or thinking about selling?"
- OR "What brings you to the area - buying or selling?"

STEP 2A: FOR SELLERS - Get Info Naturally
Ask naturally (one at a time):
1. "What's the address?"
2. "What's got you thinking about selling?"
3. "Any timeline in mind?"

Then use tools:
- validate_address (when they give address)
- get_property_value (after validation)
- Present options naturally: "I can either make you a cash offer or help you list it for top dollar. Want to chat about both?"

STEP 2B: FOR BUYERS - Qualify Naturally
Ask one at a time:
1. "What area are you looking in?"
2. "Any other neighborhoods you're considering?"
3. "What's your budget looking like?"
4. "How many bedrooms?"
5. "When are you hoping to move?"

Then: save_buyer_search tool

CONVERSATION RULES:
- ONE question at a time
- Sound like texting a friend
- No corporate speak
- Use contractions (I'm, you're, let's)
- Be brief - 1-2 sentences max
`}

TOOLS AVAILABLE:
- validate_address: Standardize address (new leads only)
- get_property_value: Get Zestimate (when address known)
- schedule_consultation: Book consultation (when qualified)

${propertyInfo}${offerInfo}

RESPONSE STYLE:
- Text like a real person, not a bot
- 1-2 sentences max
- Use casual language
- Show personality
- Be helpful, not salesy

Respond to their message:`;

  try {
    console.log('🤖 Calling OpenAI for message generation...');
    console.log(`📝 Context: ${isInitialOutreach ? 'Initial outreach' : 'Reply'} for ${context.contactName}`);
    
    const tools = [
      {
        type: 'function',
        function: {
          name: 'validate_address',
          description: 'Validate and standardize an address using Google Maps. Use this FIRST before getting property value.',
          parameters: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Full address string (e.g., "123 Main St, Miami, FL 33101")' }
            },
            required: ['address']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_property_value',
          description: 'Get Zestimate and property details. Use AFTER validating address with validate_address tool.',
          parameters: {
            type: 'object',
            properties: {
              street: { type: 'string', description: 'Street address (e.g., "123 Main St")' },
              city: { type: 'string', description: 'City name' },
              state: { type: 'string', description: 'State abbreviation (e.g., "FL")' },
              zip: { type: 'string', description: 'ZIP code' },
              lat: { type: 'number', description: 'Latitude from validated address' },
              lng: { type: 'number', description: 'Longitude from validated address' }
            },
            required: ['street', 'city', 'state', 'zip']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'check_availability',
          description: 'Check available appointment slots. Use this BEFORE scheduling.',
          parameters: {
            type: 'object',
            properties: {
              startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
              endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' }
            },
            required: ['startDate', 'endDate']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'schedule_consultation',
          description: 'Schedule appointment in an available slot. Use AFTER checking availability.',
          parameters: {
            type: 'object',
            properties: {
              consultationType: { type: 'string', enum: ['buyer', 'seller'], description: 'Type of consultation' },
              startTime: { type: 'string', description: 'ISO 8601 datetime from available slots' }
            },
            required: ['consultationType', 'startTime']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'save_buyer_search',
          description: 'Save buyer search criteria in kvCORE for automated property alerts. Use ONLY after asking about additional areas.',
          parameters: {
            type: 'object',
            properties: {
              cities: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'Array of city names buyer is interested in (e.g., ["Miami", "Fort Lauderdale"])' 
              },
              state: { type: 'string', description: 'State abbreviation' },
              minPrice: { type: 'number', description: 'Minimum price' },
              maxPrice: { type: 'number', description: 'Maximum price' },
              beds: { type: 'number', description: 'Minimum bedrooms' },
              baths: { type: 'number', description: 'Minimum bathrooms' },
              propertyTypes: { type: 'array', items: { type: 'string' }, description: 'Property types (Single Family, Condo, etc.)' }
            },
            required: ['cities', 'state', 'maxPrice']
          }
        }
      }
    ];
    
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
        tools,
        tool_choice: 'auto',
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

    const choice = response.data.choices[0];
    
    // Check if AI wants to use a tool
    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      console.log('🔧 AI requested tool call:', choice.message.tool_calls[0].function.name);
      
      const toolCall = choice.message.tool_calls[0];
      const toolName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      
      if (toolName === 'validate_address') {
        console.log('🗺️ Validating address:', args.address);
        const { validateAddressWithGoogle } = await import('../../../app/utils/google.server');
        const validated = await validateAddressWithGoogle(args.address);
        
        if (validated?.success) {
          const { street, city, state, zip } = validated.components;
          const { lat, lng } = validated.location;
          
          // Now get property value with validated address
          const propData = await getPropertyAnalysis(street, city, state, zip, lat, lng);
          
          if (propData?.zestimate) {
            const cashOffer = Math.round(propData.zestimate * 0.70);
            return `Perfect! I found your property at ${validated.formattedAddress}. Current market value is around $${propData.zestimate.toLocaleString()}. I can offer $${cashOffer.toLocaleString()} cash for a quick close, or help you list it for the full $${propData.zestimate.toLocaleString()}. Which interests you more?`;
          } else {
            return `I found your address at ${validated.formattedAddress}, but I'd need to see the property in person to give you an accurate value. Can we schedule a quick 10-minute walkthrough this week?`;
          }
        } else {
          return `I'm having trouble finding that address. Could you provide the full street address, city, and ZIP code?`;
        }
      }
      
      if (toolName === 'get_property_value') {
        console.log('📍 Fetching property value for:', args);
        const propData = await getPropertyAnalysis(args.street, args.city, args.state, args.zip, args.lat, args.lng);
        
        if (propData?.zestimate) {
          const cashOffer = Math.round(propData.zestimate * 0.70);
          return `Based on current market data, your property at ${args.street} is valued around $${propData.zestimate.toLocaleString()}. I can offer you $${cashOffer.toLocaleString()} cash for a quick close, or help you list it for the full $${propData.zestimate.toLocaleString()}. Which option interests you more?`;
        } else {
          return `I'd need to see the property to give you an accurate value. Can we schedule a quick 10-minute walkthrough this week?`;
        }
      }
      
      if (toolName === 'schedule_consultation') {
        console.log('📅 Scheduling consultation:', args);
        const leadType = args.lead_type === 'seller' ? 'seller' : 'buyer';
        
        // Tag contact for human handoff
        return `Great! I'll have one of our ${leadType} specialists reach out within the next few hours to schedule your consultation. Thanks for your interest!`;
      }
      
      if (toolName === 'check_availability') {
        console.log('📅 Checking availability:', args);
        
        try {
          const response = await fetch(
            `https://services.leadconnectorhq.com/calendars/tuC1rqAOzPTThWUC7rvS/free-slots?startDate=${args.startDate}&endDate=${args.endDate}`,
            {
              headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${context.accessToken}`,
                'Version': '2021-07-28'
              }
            }
          );
          
          const data = await response.json();
          
          // Format slots for AI
          if (data.slots && data.slots.length > 0) {
            const formattedSlots = data.slots.slice(0, 5).map((slot: any) => 
              new Date(slot).toLocaleString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit' 
              })
            );
            return `Available times: ${formattedSlots.join(', ')}. Raw slots: ${JSON.stringify(data.slots.slice(0, 5))}`;
          }
          
          return 'No available slots found in that date range.';
        } catch (error) {
          console.error('Failed to check availability:', error);
          return 'Unable to check availability right now.';
        }
      }

      if (toolName === 'schedule_consultation') {
        console.log('📅 Scheduling consultation:', args);
        
        const isBuyer = args.consultationType === 'buyer';
        const description = isBuyer 
          ? 'Join us for a personalized buyer consultation where we\'ll discuss your home search criteria, budget, timeline, and answer all your questions about the buying process. We\'ll also show you how to get pre-approved and find your dream home.'
          : 'Join us for a seller consultation where we\'ll review your property, discuss current market conditions, pricing strategy, and our comprehensive marketing plan to get you the best price for your home.';
        
        try {
          const response = await fetch('https://services.leadconnectorhq.com/calendars/events/appointments', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${context.accessToken}`,
              'Version': '2021-07-28'
            },
            body: JSON.stringify({
              calendarId: 'tuC1rqAOzPTThWUC7rvS',
              locationId: context.locationId,
              contactId: context.contact?.id,
              startTime: args.startTime,
              endTime: new Date(new Date(args.startTime).getTime() + 60*60*1000).toISOString(),
              title: isBuyer ? 'Buyer Consultation' : 'Seller Consultation',
              description: description,
              appointmentStatus: 'confirmed',
              assignedUserId: context.contact?.ownerId || context.contact?.assignedTo,
              meetingLocationType: 'google_conference',
              toNotify: true
            })
          });
          
          const appointment = await response.json();
          return `Perfect! I've scheduled your ${args.consultationType} consultation for ${new Date(args.startTime).toLocaleString()}. You'll receive a Google Meet link and reminders via text and email.`;
        } catch (error) {
          console.error('Failed to schedule appointment:', error);
          return 'I had trouble scheduling that appointment. Let me transfer you to someone who can help.';
        }
      }

      if (toolName === 'save_buyer_search') {
        console.log('💾 Saving buyer search to kvCORE:', args);
        
        try {
          const { createContact, addSearchAlert } = await import('../../../app/utils/kvcore.server');
          
          // Create contact in kvCORE with hashtag to trigger Smart Campaign
          const kvContact = await createContact({
            firstName: context.contactName.split(' ')[0] || 'Buyer',
            lastName: context.contactName.split(' ').slice(1).join(' ') || 'Lead',
            email: context.contact?.email,
            phone: context.contact?.phone,
            dealType: 'buyer',
            source: 'AI Chat - Facebook',
            notes: `Interested in ${args.beds}BR homes in ${args.cities.join(', ')}, ${args.state} under $${args.maxPrice.toLocaleString()}`,
            tags: ['#fbbuyerleads'] // Triggers "Facebook Buyer Leads" Smart Campaign
          });
          
          if (kvContact) {
            // Create areas array from cities
            const areas = args.cities.map((city: string) => ({
              type: 'city',
              name: city
            }));
            
            // Add saved search
            const searchCriteria = {
              types: args.propertyTypes || (context.listingType ? [context.listingType] : ['Single Family', 'Condo']),
              beds: args.beds || context.listingBeds || 3,
              baths: args.baths || context.listingBaths || 2,
              minPrice: args.minPrice || (context.listingPrice ? Math.round(context.listingPrice * 0.9) : undefined),
              maxPrice: args.maxPrice || (context.listingPrice ? Math.round(context.listingPrice * 1.1) : undefined),
              areas: areas,
              frequency: 'daily'
            };
            
            await addSearchAlert(kvContact.id, searchCriteria);
            
            console.log(`✅ Buyer saved in kvCORE with hashtag #fbbuyerleads and auto-alerts for:`, args.cities.join(', '));
            
            const cityList = args.cities.length > 1 
              ? `${args.cities.slice(0, -1).join(', ')} and ${args.cities[args.cities.length - 1]}`
              : args.cities[0];
            
            return `Perfect! I've saved your search for ${cityList}. You'll receive daily emails when new properties match your criteria. I'll also keep you updated via text. Looking forward to helping you find your dream home!`;
          }
        } catch (error) {
          console.error('❌ Failed to save buyer in kvCORE:', error);
        }
        
        return `Great! I've saved your search criteria. You'll receive updates when new properties match. Looking forward to helping you!`;
      }
    }

    const aiMessage = choice.message?.content || 'Thanks for your message. Let me get back to you shortly.';
    console.log(`✅ OpenAI response: ${aiMessage.substring(0, 100)}...`);
    return aiMessage;
  } catch (error: any) {
    console.error('❌ OpenAI API error:', error.response?.data || error.message);
    console.error('❌ Full error details:', JSON.stringify(error, null, 2));
    throw new Error(`AI response generation failed: ${error.message}`);
  }
}

// Check if contact has AI enabled and is in good standing
function isAIEnabled(contact: any): boolean {
  const hasPhone = contact?.phone;
  const leadType = contact?.customFields?.find((f: any) => f.id === 'oaf4wCuM3Ub9eGpiddrO')?.value;
  const contactType = contact?.customFields?.find((f: any) => f.id === 'pGfgxcdFaYAkdq0Vp53j')?.value;
  
  if (!hasPhone) {
    console.log('❌ Contact has no phone number');
    return false;
  }
  
  // Exclude direct mail only contacts
  if (contactType === 'Direct Mail') {
    console.log('❌ Contact is Direct Mail only');
    return false;
  }
  
  // Check all variations of lead type (case-insensitive)
  const validLeadTypes = [
    'Probate',
    'probate', 
    'PROBATE',
    'PREFORECLOSURE',
    'Preforeclosure',
    'preforeclosure',
    'Pre-Foreclosure',
    'pre-foreclosure'
  ];
  
  if (!leadType || !validLeadTypes.includes(leadType)) {
    console.log(`❌ Invalid or missing lead type: "${leadType}"`);
    return false;
  }
  
  return true;
  
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

// Get current conversation state from contact
function getCurrentState(contact: any): ConversationState {
  const aiStateField = contact?.customFields?.find((f: any) => f.id === '1NxQW2kKMVgozjSUuu7s');
  const currentState = aiStateField?.value;
  
  // Map old states to new state machine
  if (currentState === 'handoff' || currentState === 'qualified') return 'QUALIFIED';
  if (currentState === 'valuation') return 'PROPERTY_VALUATION';
  
  // Default to NEW_LEAD if no state
  return currentState as ConversationState || 'NEW_LEAD';
}

// Determine next state based on current state and message
function getNextState(currentState: ConversationState, message: string, hasAddress: boolean, intent?: string): ConversationState {
  const msg = message.toLowerCase();
  
  // Check for explicit booking intent
  if (msg.includes('schedule') || msg.includes('appointment') || msg.includes('meet')) {
    return 'APPOINTMENT_BOOKING';
  }
  
  switch (currentState) {
    case 'NEW_LEAD':
      // Determine if buyer or seller
      if (intent === 'seller' || msg.includes('sell') || msg.includes('value') || msg.includes('worth')) {
        return hasAddress ? 'PROPERTY_VALUATION' : 'SELLER_QUALIFICATION';
      }
      if (intent === 'buyer' || msg.includes('buy') || msg.includes('looking for')) {
        return 'BUYER_QUALIFICATION';
      }
      return 'ASK_INTENT';
      
    case 'ASK_INTENT':
      if (msg.includes('sell')) return hasAddress ? 'PROPERTY_VALUATION' : 'SELLER_QUALIFICATION';
      if (msg.includes('buy')) return 'BUYER_QUALIFICATION';
      return 'ASK_INTENT';
      
    case 'SELLER_QUALIFICATION':
      // Once we have address, move to valuation
      if (hasAddress) return 'PROPERTY_VALUATION';
      return 'SELLER_QUALIFICATION';
      
    case 'PROPERTY_VALUATION':
      // After showing value, push to booking
      return 'APPOINTMENT_BOOKING';
      
    case 'BUYER_QUALIFICATION':
      // After qualifying buyer, push to booking
      if (msg.includes('yes') || msg.includes('interested')) {
        return 'APPOINTMENT_BOOKING';
      }
      return 'BUYER_QUALIFICATION';
      
    case 'APPOINTMENT_BOOKING':
      return 'QUALIFIED';
      
    default:
      return currentState;
  }
}

function shouldHandoffToHuman(message: string): boolean {
  const handoffKeywords = [
    'speak to someone',
    'talk to a person',
    'talk to someone',
    'human agent',
    'real person',
    'ready to sell now',
    'schedule a call',
    'call me back'
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

    // Get current conversation state
    const currentState = getCurrentState(context.contact);
    console.log(`📊 Current state: ${currentState}`);
    
    // Determine next state based on message
    const hasAddress = !!(context.propertyAddress && context.propertyCity && context.propertyState);
    const nextState = getNextState(currentState, context.incomingMessage, hasAddress, context.leadIntent);
    console.log(`➡️ Next state: ${nextState}`);
    
    // Update state if changed
    if (nextState !== currentState && !context.testMode && context.accessToken) {
      await updateAIState(context.contactId, nextState, context.accessToken);
    }

    // 🛡️ Check if AI is enabled for this contact (skip for organic social media leads)
    const isOrganicSocialLead = context.contact?.attributionSource?.medium === 'facebook' || 
                                 context.contact?.lastAttributionSource?.medium === 'facebook';
    
    if (!context.testMode && !isOrganicSocialLead && !isAIEnabled(context.contact)) {
      console.log(`❌ AI disabled for contact ${context.contactId}`);
      throw new Error('AI is not enabled for this contact');
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
              'Content-Type': 'application/json',
              'Version': '2021-07-28'
            }
          }
        );
      }

      const handoffMessage = "Great! I'll have one of our property specialists reach out to you within the next few hours to discuss your options. Thanks for your interest!";
      await sendGHLMessage(context.conversationId, handoffMessage, context.accessToken || '', context.testMode, context.fromNumber, context.contactId, context.messageType || 'SMS');
      return handoffMessage;
    }

    // Get property analysis for context
    let propertyData: PropertyAnalysis | null = null;
    if (context.propertyAddress && context.propertyCity && context.propertyState) {
      propertyData = await getPropertyAnalysis(
        context.propertyAddress,
        context.propertyCity,
        context.propertyState,
        context.propertyZip || '',
        context.propertyLat,
        context.propertyLng
      );
    }

    // Generate AI response
    const aiMessage = await generateOpenAIResponse(context, propertyData || undefined);

    // Send response to GHL (skip in test mode)
    await sendGHLMessage(context.conversationId, aiMessage, context.accessToken || '', context.testMode, context.fromNumber, context.contactId, context.messageType || 'SMS');

    return aiMessage;

  } catch (error: any) {
    console.error('❌ Conversation handler error:', error);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    console.error('❌ Context:', JSON.stringify(context, null, 2));
    throw error; // Don't send fallback - let caller handle error
  }
}
