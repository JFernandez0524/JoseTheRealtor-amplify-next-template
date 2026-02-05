type LexEvent = {
  sessionState: {
    intent: {
      name: string;
      slots: Record<string, any>;
      state: string;
    };
    sessionAttributes?: Record<string, string>;
  };
  sessionId: string;
  inputTranscript: string;
};

export const handler = async (event: LexEvent) => {
  console.log('Lex fulfillment event:', JSON.stringify(event, null, 2));
  
  const intentName = event.sessionState.intent.name;
  const slots = event.sessionState.intent.slots;
  
  try {
    switch (intentName) {
      case 'SellProperty':
        return handleSellProperty(event, slots);
      
      case 'ScheduleViewing':
        return handleScheduleViewing(event, slots);
      
      case 'FallbackIntent':
        return handleFallback(event);
      
      default:
        return closeIntent(event, 'Fulfilled', 'I can help you with selling your property or scheduling a viewing.');
    }
  } catch (error) {
    console.error('Fulfillment error:', error);
    return closeIntent(event, 'Failed', 'Sorry, something went wrong. Let me connect you with Jose.');
  }
};

function handleSellProperty(event: LexEvent, slots: Record<string, any>) {
  const address = slots.PropertyAddress?.value?.interpretedValue;
  
  if (!address) {
    return elicitSlot(event, 'PropertyAddress', 'What is the property address?');
  }
  
  // TODO: Save to DynamoDB, create GHL contact, etc.
  
  return closeIntent(
    event,
    'Fulfilled',
    `Great! I have your property at ${address}. Jose will reach out shortly to discuss your options for a cash offer or retail listing.`
  );
}

function handleScheduleViewing(event: LexEvent, slots: Record<string, any>) {
  const date = slots.AppointmentDate?.value?.interpretedValue;
  const time = slots.AppointmentTime?.value?.interpretedValue;
  
  if (!date) {
    return elicitSlot(event, 'AppointmentDate', 'What day works best for you?');
  }
  
  if (!time) {
    return elicitSlot(event, 'AppointmentTime', 'What time would you prefer?');
  }
  
  // TODO: Create calendar appointment, notify via GHL
  
  return closeIntent(
    event,
    'Fulfilled',
    `Perfect! Your viewing is scheduled for ${date} at ${time}. Jose will call you to confirm.`
  );
}

function handleFallback(event: LexEvent) {
  return closeIntent(
    event,
    'Fulfilled',
    'Let me connect you with Jose directly. He\'ll reach out to answer your questions personally.'
  );
}

function elicitSlot(event: LexEvent, slotName: string, message: string) {
  return {
    sessionState: {
      ...event.sessionState,
      dialogAction: {
        type: 'ElicitSlot',
        slotToElicit: slotName
      }
    },
    messages: [{ contentType: 'PlainText', content: message }]
  };
}

function closeIntent(event: LexEvent, fulfillmentState: string, message: string) {
  return {
    sessionState: {
      ...event.sessionState,
      intent: {
        ...event.sessionState.intent,
        state: fulfillmentState
      },
      dialogAction: {
        type: 'Close'
      }
    },
    messages: [{ contentType: 'PlainText', content: message }]
  };
}
