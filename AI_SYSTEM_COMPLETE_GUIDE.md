# AI Messaging System - Complete Guide

## Overview

The AI messaging system handles automated outreach and replies across SMS, Facebook Messenger, Instagram DMs, and WhatsApp. It uses OpenAI GPT-4o-mini with conversation state management and tool calling for property lookups and appointment scheduling.

---

## Initial Outreach

### Message Format (Soft Approach)

**Current Message:**
```
Hi [FirstName], this is Jose with RE/MAX. I'm reaching out based on public information about a property on [StreetName] — just wanted to confirm whether it's something you're planning to sell or keep. Reply STOP to opt out.
```

**Key Elements:**
- First name only (not full name)
- Street name only (not full address)
- "Based on public information" upfront (transparency)
- Framed as confirmation, not sales pitch
- Conversational and human

### Sending Schedule

- **Frequency**: Every hour during business hours
- **Business Hours**: Mon-Fri 9AM-7PM, Sat 9AM-12PM EST (Sunday closed)
- **Rate Limit**: 24-hour minimum between messages to same contact
- **Max Attempts**: 7 touches per contact over 28 days

### How It Works

1. **Queue-Based (Primary)**: Lambda queries OutreachQueue table for PENDING contacts
2. **GHL Fallback**: If queue empty, searches GHL for contacts with "ai outreach" tag
3. **Duplicate Prevention**: Checks `last_call_date` custom field (24-hour minimum)
4. **Message Generation**: Calls `/api/v1/send-message-to-contact` with `initial_outreach` flag
5. **Tracking**: Updates `call_attempt_counter` and `last_call_date` in GHL

---

## Reply Handling

### Webhook Architecture

**Inbound messages trigger webhooks:**
- SMS: GHL webhook → Lambda Function URL
- Facebook/Instagram/WhatsApp: GHL webhook → Lambda Function URL
- Lambda has direct DynamoDB access (no API route needed)

**Webhook Flow:**
1. GHL sends message to Lambda Function URL
2. Lambda fetches conversation history from GHL
3. Lambda generates AI response using conversation context
4. Lambda sends reply via GHL API
5. Lambda updates OutreachQueue status (REPLIED/OPTED_OUT)

### Message Type Detection

```typescript
// Type 2: SMS
// Type 3: Facebook Messenger
// Type 4: Instagram DM
// Type 5: WhatsApp
```

---

## Conversation Context & State Management

### Conversation States

The AI tracks conversation progress through states:

1. **NEW_LEAD** - Initial contact, determine intent
2. **ASK_INTENT** - Ask if buyer or seller
3. **SELLER_QUALIFICATION** - Get property address
4. **PROPERTY_VALUATION** - Show value and present options
5. **BUYER_QUALIFICATION** - Qualify buyer needs
6. **APPOINTMENT_BOOKING** - Schedule consultation
7. **QUALIFIED** - Ready for human handoff

### Context Passed to AI

```typescript
interface ConversationContext {
  contactId: string;
  conversationId: string;
  incomingMessage: string;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  leadType?: string; // PROBATE or PREFORECLOSURE
  existingZestimate?: number;
  existingCashOffer?: number;
  contact?: any; // Full GHL contact object
  accessToken: string;
  locationId: string;
}
```

### Conversation History

**Fetched from GHL on every reply:**
```typescript
// Get last 10 messages from conversation
const messages = await ghl.get(`/conversations/${conversationId}/messages?limit=10`);

// Format for OpenAI
const conversationHistory = messages.map(msg => ({
  role: msg.direction === 'inbound' ? 'user' : 'assistant',
  content: msg.body
}));
```

**Passed to OpenAI:**
- Last 10 messages for context
- Current conversation state
- Property data (if available)
- Lead type and custom fields

---

## AI System Prompt (Current)

### Trust Question Override (Highest Priority)

If user asks:
- "Where did you see this?"
- "How did you get my info?"
- "What notice?"
- "Who gave you my number?"

**AI responds immediately:**
```
Good question — it came from publicly available county records. Nothing private or paid. If this isn't a good time, no worries at all.
```

**Rules:**
- No selling
- No questions back
- No address repetition
- Just answer and stop

### Compliance Rules

1. **Identify as AI**: "I'm Jose's AI assistant helping with initial questions"
2. **No Legal/Financial Advice**: Never give tax, legal, or financial advice
3. **Human Handoff**: Complex questions → "Let me connect you with Jose directly"
4. **Disclaimers**: Property values are estimates only, not appraisals
5. **Already Listed**: If they mention another realtor → graceful exit
6. **Never Repeat Address**: After initial outreach, don't repeat full address

### Already Listed Protocol

If they mention:
- "We're working with [realtor name]"
- "It's already listed"
- "We have a realtor"

**AI responds:**
```
I understand you're already working with [realtor name/brokerage]. I respect that relationship and wish you the best with your sale! If anything changes in the future, feel free to reach out.
```

Then uses `end_conversation` tool to stop all follow-ups.

### Conversation End Detection

**Hard Stop Signals:**
- "ok thanks"
- "all good"
- "got it"
- "sounds good"
- "thank you"
- "thanks"
- "okay"
- "ok"

**When detected:**
- AI does NOT respond
- Silence is success (professional behavior)
- No follow-up messages sent

### Response Style

- **Length**: 1-2 sentences max
- **Tone**: Casual, conversational, human
- **Questions**: One at a time
- **No Emojis**: Professional SMS style
- **No Salesy Language**: Avoid "amazing opportunity", "limited time", etc.

---

## Available AI Tools

The AI can call these functions during conversations:

### 1. validate_address
Standardize addresses using Google Maps API
```typescript
{
  name: 'validate_address',
  parameters: { address: string }
}
```

### 2. get_property_value
Fetch Zestimate and property details
```typescript
{
  name: 'get_property_value',
  parameters: {
    street: string,
    city: string,
    state: string,
    zip: string,
    lat?: number,
    lng?: number
  }
}
```

### 3. check_availability
Check calendar for open slots
```typescript
{
  name: 'check_availability',
  parameters: {
    startDate: string, // YYYY-MM-DD
    endDate: string
  }
}
```

### 4. schedule_consultation
Book appointments in GHL calendar
```typescript
{
  name: 'schedule_consultation',
  parameters: {
    startTime: string, // ISO timestamp
    consultationType: 'buyer' | 'seller'
  }
}
```

### 5. save_buyer_search
Save buyer criteria in kvCORE
```typescript
{
  name: 'save_buyer_search',
  parameters: {
    cities: string[],
    state: string,
    beds: number,
    baths: number,
    maxPrice: number,
    propertyTypes?: string[]
  }
}
```

### 6. end_conversation
Exit and stop follow-ups
```typescript
{
  name: 'end_conversation',
  parameters: {
    reason: string // 'already_listed', 'not_interested', 'completed'
  }
}
```

---

## Message Cleanup & Formatting

### Post-Processing

Before sending, messages are cleaned:

1. **Remove tool call syntax**: `(end_conversation)` → removed
2. **Remove step breakdowns**: "Step 1:", "Combined Message:" → removed
3. **Strip extra whitespace**: Trim and normalize
4. **Remove quotes**: Clean up formatting artifacts

### Example Cleanup

**Before:**
```
I understand you're already working with a realtor. I respect that relationship and wish you the best! (end_conversation)
```

**After:**
```
I understand you're already working with a realtor. I respect that relationship and wish you the best!
```

---

## Tracking & Analytics

### GHL Custom Fields

- `0MD4Pp2LCyOSCbCjA5qF`: call_attempt_counter (SMS count)
- `dWNGeSckpRoVUxXLgxMj`: last_call_date (last SMS timestamp)
- `ai_state`: Current conversation state
- `conversation_sentiment`: Sentiment analysis result

### OutreachQueue Status

**SMS:**
- `PENDING` → Ready for next touch
- `REPLIED` → User responded (stop outreach)
- `FAILED` → Send failed
- `OPTED_OUT` → User said STOP

**Email:**
- `PENDING` → Ready for next touch
- `REPLIED` → User responded
- `BOUNCED` → Email bounced
- `FAILED` → Send failed
- `OPTED_OUT` → User unsubscribed

### CloudWatch Logs

**Lambda Functions:**
- `/aws/lambda/ghlWebhookHandler` - Inbound message handling
- `/aws/lambda/dailyOutreachAgent` - Outbound SMS automation
- `/aws/lambda/dailyEmailAgent` - Outbound email automation

**Key Metrics:**
- Messages sent per hour
- Reply rate
- Opt-out rate
- Conversation completion rate
- Tool usage frequency

---

## Testing

### Test Endpoint

**POST** `/api/v1/test-ai-response`

```json
{
  "contactId": "GHL_CONTACT_ID",
  "message": "Yes, I'm interested in selling"
}
```

**Response:**
```json
{
  "success": true,
  "aiResponse": "Great! What's the property address?",
  "conversationState": "SELLER_QUALIFICATION"
}
```

**Note:** This tests AI responses without actually sending messages.

---

## Best Practices

### DO:
✅ Keep messages under 160 characters when possible
✅ Ask one question at a time
✅ Use natural, conversational language
✅ Respect business hours
✅ Tag contacts appropriately for human handoff
✅ Test changes using the test endpoint

### DON'T:
❌ Give legal or financial advice
❌ Make promises about property values
❌ Continue pursuing already listed properties
❌ Send messages outside business hours
❌ Use overly salesy language
❌ Ask multiple questions in one message
❌ Repeat the property address after initial contact

---

## Troubleshooting

### AI Not Responding
1. Check GHL webhook configuration
2. Verify OAuth token is valid
3. Check CloudWatch logs for errors
4. Test using `/api/v1/test-ai-response`

### Wrong Responses
1. Review conversation history in GHL
2. Check system prompt for conflicting instructions
3. Verify contact has correct custom fields
4. Test with different message variations

### Duplicate Messages
1. Check OutreachQueue for contact
2. Verify `last_call_date` is being updated
3. Review hourly agent logs
4. Ensure 24-hour duplicate prevention is active

### Rate Limiting
1. Check hourly/daily message counts
2. Verify 24-hour delays between messages
3. Review GHL rate limit settings
4. Monitor CloudWatch for throttling errors

---

## File Locations

### Core Files
- `amplify/functions/shared/conversationHandler.ts` - AI message generation
- `amplify/functions/shared/ghlTokenManager.ts` - OAuth token management
- `amplify/functions/shared/outreachQueue.ts` - Queue management
- `amplify/functions/shared/dialTracking.ts` - Duplicate prevention
- `amplify/functions/shared/businessHours.ts` - Business hours checker

### Lambda Functions
- `amplify/functions/ghlWebhookHandler/` - Inbound message webhook
- `amplify/functions/dailyOutreachAgent/` - Outbound SMS automation
- `amplify/functions/dailyEmailAgent/` - Outbound email automation

### API Routes
- `app/api/v1/send-message-to-contact/route.ts` - Message sending
- `app/api/v1/test-ai-response/route.ts` - Testing endpoint
- `app/api/v1/ghl-webhook/route.ts` - Legacy webhook (deprecated)

### Documentation
- `AI_TESTING_GUIDE.md` - Testing procedures
- `AI_SYSTEM_WORKFLOW.md` - Complete system workflow
- `PHASE1_COMPLETE.md` - Phase 1 implementation details
- `OPENAI_ROADMAP.md` - Future improvements

---

## Recent Updates

### 2026-02-06 (Production Hardening)
- ✅ AI identification only when directly asked (improves trust)
- ✅ Trust response variants (3 versions for natural variance)
- ✅ "Not interested" / "Keeping it" detection with 120-day recontact delay
- ✅ Added trust question override for transparency
- ✅ Softened initial outreach message
- ✅ Added conversation end detection
- ✅ Implemented 24-hour duplicate prevention
- ✅ Fixed AI message formatting (removed tool syntax)
- ✅ Added multi-format contact search (phone/email/name variations)
- ✅ Improved error handling and logging

### Risk Mitigation
- **Trust Sensitivity**: System detects when trust is questioned and adjusts behavior
- **Natural Variance**: Trust responses rotate between 3 variants to avoid scripted feel
- **Brand Protection**: Hard objections trigger immediate exit with 120-day cooldown
- **Compliance**: AI disclosure only when asked (TCPA compliant)

### Next Steps
- Phase 2: Behavioral scoring and analytics dashboard
- Voice transcription for call analysis
- Multi-language support
- Advanced sentiment analysis
