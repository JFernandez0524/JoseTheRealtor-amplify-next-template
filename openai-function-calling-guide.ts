/**
 * OpenAI Function Calling - Makes your bot work like Lex V2
 * 
 * Add this to your conversationHandler.ts OpenAI API call
 */

const INTENT_FUNCTIONS = [
  {
    name: 'sell_property',
    description: 'User wants to sell their property',
    parameters: {
      type: 'object',
      properties: {
        property_address: {
          type: 'string',
          description: 'The full property address'
        },
        reason: {
          type: 'string',
          description: 'Why they want to sell (probate, foreclosure, etc.)'
        },
        timeline: {
          type: 'string',
          description: 'How soon they need to sell'
        }
      },
      required: ['property_address']
    }
  },
  {
    name: 'schedule_viewing',
    description: 'User wants to schedule a property viewing',
    parameters: {
      type: 'object',
      properties: {
        preferred_date: {
          type: 'string',
          description: 'Preferred date for viewing'
        },
        preferred_time: {
          type: 'string',
          description: 'Preferred time for viewing'
        }
      },
      required: ['preferred_date']
    }
  },
  {
    name: 'get_property_value',
    description: 'User wants to know their property value',
    parameters: {
      type: 'object',
      properties: {
        property_address: {
          type: 'string',
          description: 'The property address to value'
        }
      },
      required: ['property_address']
    }
  }
];

// In your OpenAI API call, add:
const response = await axios.post(
  'https://api.openai.com/v1/chat/completions',
  {
    model: 'gpt-4o-mini',
    messages: conversationHistory,
    functions: INTENT_FUNCTIONS, // Add this
    function_call: 'auto', // Let OpenAI decide when to call
    temperature: 0.7
  },
  {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  }
);

// Handle function calls
if (response.data.choices[0].message.function_call) {
  const functionName = response.data.choices[0].message.function_call.name;
  const args = JSON.parse(response.data.choices[0].message.function_call.arguments);
  
  switch (functionName) {
    case 'sell_property':
      // Handle sell intent
      return handleSellProperty(args.property_address, args.reason, args.timeline);
    
    case 'schedule_viewing':
      // Handle scheduling
      return handleScheduleViewing(args.preferred_date, args.preferred_time);
    
    case 'get_property_value':
      // Handle valuation
      return handlePropertyValue(args.property_address);
  }
}

/**
 * Benefits over current system:
 * - Structured intent detection (like Lex)
 * - Automatic parameter extraction
 * - Type-safe slot filling
 * - Better than regex/keyword matching
 * 
 * Cost: Same as current OpenAI usage
 * Complexity: Minimal - just add functions array
 */
