# 🤖 Conversation Handler Deep Dive

## **Overview**
Your conversation handler is the brain of your AI messaging system. It handles multi-channel conversations (SMS, Facebook, Instagram, WhatsApp) with leads using OpenAI GPT-4o-mini.

---

## **📁 File Location**
`amplify/functions/shared/conversationHandler.ts`

---

## **🎯 Main Purpose**
1. **Receive messages** from GHL (via webhook)
2. **Understand intent** using OpenAI
3. **Track conversation state** (what stage of qualification)
4. **Fetch property data** when needed
5. **Generate smart responses** based on context
6. **Send replies** back to GHL

---

## **🔄 Conversation Flow**

```
NEW_LEAD
   ↓
ASK_INTENT (Are they a buyer or seller?)
   ↓
SELLER_QUALIFICATION (Get property address)
   ↓
PROPERTY_VALUATION (Show Zestimate + cash offer)
   ↓
APPOINTMENT_BOOKING (Schedule viewing)
   ↓
QUALIFIED (Tag for human handoff)
```

---

## **🧩 Key Components**

### **1. ConversationContext**
All the information about the current conversation:
```typescript
{
  contactId: "ghl-contact-id",
  conversationId: "ghl-conversation-id",
  incomingMessage: "I want to sell my house",
  contactName: "John Doe",
  propertyAddress: "123 Main St",
  leadType: "probate",
  messageType: "SMS", // or FB, IG, WhatsApp
  conversationState: "SELLER_QUALIFICATION"
}
```

### **2. Conversation States**
Tracks where you are in the conversation:
- `NEW_LEAD` - First contact
- `ASK_INTENT` - Determining if buyer/seller
- `SELLER_QUALIFICATION` - Getting property details
- `PROPERTY_VALUATION` - Showing value + offers
- `APPOINTMENT_BOOKING` - Scheduling viewing
- `QUALIFIED` - Ready for human handoff

### **3. Property Analysis**
Fetches Zestimate and property details:
```typescript
{
  zestimate: 450000,
  sqft: 2000,
  beds: 3,
  baths: 2,
  yearBuilt: 1995
}
```

### **4. OpenAI Integration**
Generates contextual responses using:
- **System prompt** - Instructions for the AI
- **Conversation history** - Last 10 messages
- **Property data** - Zestimate, cash offer
- **State tracking** - Current conversation stage

---

## **💬 Message Flow Example**

**User:** "I want to sell my house"
↓
**Handler:** Detects SELLER_QUALIFICATION state
↓
**OpenAI:** Generates "What's the property address?"
↓
**User:** "123 Main St, Edison, NJ"
↓
**Handler:** Fetches property data from Bridge API
↓
**OpenAI:** Generates response with Zestimate + cash offer
↓
**User:** "I'm interested in the cash offer"
↓
**Handler:** Moves to APPOINTMENT_BOOKING state
↓
**OpenAI:** "When would you like to schedule a viewing?"

---

## **🛠️ Key Functions**

### **`generateOpenAIResponse()`**
- Builds system prompt with property data
- Includes conversation history
- Calls OpenAI API
- Returns AI-generated response

### **`getPropertyAnalysis()`**
- Calls Bridge API for Zestimate
- Tries address variations
- Falls back to coordinates if needed
- Returns property details

### **`sendGHLMessage()`**
- Sends response back to GHL
- Supports SMS, FB, IG, WhatsApp
- Handles different message types
- Auto-creates conversations if needed

### **`getCurrentState()`**
- Reads GHL custom field `ai_state`
- Determines current conversation stage
- Returns ConversationState

### **`getNextState()`**
- Analyzes user message
- Determines next conversation stage
- Updates state progression

---

## **🎨 System Prompt Structure**

Your AI follows this instruction set:

1. **Compliance Rules**
   - Identify as AI assistant
   - No legal/financial advice
   - Hand off complex questions
   - Exit gracefully if already listed

2. **Conversation Style**
   - 1-2 sentences max
   - Casual, friendly tone
   - Ask one question at a time
   - Use emojis sparingly

3. **5-Step Script**
   - Confirm interest in selling
   - Get property address
   - Present cash offer + retail option
   - Gauge timeline
   - Schedule property visit

4. **State-Specific Guidance**
   - Different prompts for each state
   - Adapts to missing data
   - Handles buyer vs seller flows

---

## **🔧 How to Customize**

### **Change AI Personality**
Edit the system prompt (lines 190-320):
```typescript
RESPONSE STYLE:
- More professional (remove emojis)
- More aggressive (push for appointment)
- More casual (use slang)
```

### **Add New Intent**
Add to conversation states:
```typescript
type ConversationState = 
  | 'NEW_LEAD'
  | 'YOUR_NEW_STATE' // Add here
  | 'QUALIFIED';
```

### **Modify Offers**
Change cash offer calculation (line 145):
```typescript
const cashOffer = zestimate ? Math.round(zestimate * 0.75) : null; // 75% instead of 70%
```

### **Add New Message Channel**
Already supports: SMS, FB, IG, WhatsApp
To add more, update `messageType` enum

---

## **📊 Data Flow Diagram**

```
GHL Webhook → Lambda → conversationHandler.ts
                ↓
        getCurrentState() → Read GHL custom fields
                ↓
        getPropertyAnalysis() → Bridge API (if needed)
                ↓
        generateOpenAIResponse() → OpenAI API
                ↓
        getNextState() → Update conversation state
                ↓
        sendGHLMessage() → Back to GHL
```

---

## **🐛 Common Issues**

**AI not responding?**
- Check OpenAI API key
- Verify GHL webhook is configured
- Check CloudWatch logs

**Wrong property data?**
- Address might be non-standard
- Check Bridge API response
- Verify coordinates are correct

**State not updating?**
- Check GHL custom field `ai_state`
- Verify field exists in GHL
- Check update API call

---

## **📈 Performance Tips**

1. **Use existing Zestimate** - Pass `existingZestimate` to skip API call
2. **Batch messages** - 2-second delay between sends
3. **Cache property data** - Store in GHL custom fields
4. **Limit conversation history** - Only last 10 messages

---

## **🎓 Learning Path**

1. ✅ Read this guide
2. Read the actual code with comments
3. Test using `/api/v1/test-ai-response`
4. Modify system prompt
5. Add custom intents
6. Implement function calling

Want me to explain any specific part in more detail?
