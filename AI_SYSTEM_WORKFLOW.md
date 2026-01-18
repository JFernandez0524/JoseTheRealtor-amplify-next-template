# AI Messaging System - Complete Workflow

## System Overview

Your AI messaging system now handles BOTH inbound and outbound prospecting with NO code duplication.

## Architecture

### Shared Components (No Duplication)

1. **AI Conversation Handler** (`app/utils/ai/conversationHandler.ts`)
   - Single source of truth for AI responses
   - Handles both initial outreach and replies
   - Adapts to available contact data
   - Uses 5-step script

2. **GHL Webhook Handler** (`app/api/v1/ghl-webhook/route.ts`)
   - Receives inbound messages
   - Fetches fresh contact data from GHL
   - Calls AI handler
   - Sends response via GHL conversations API

3. **Outreach API** (`app/api/v1/send-test-to-contact/route.ts`)
   - Sends outbound messages
   - Fetches contact data from GHL
   - Calls same AI handler
   - Sends via GHL conversations API

## Complete Workflow

### Outbound Prospecting (Daily Automated)

```
Daily at 9 AM EST
    ↓
Daily Outreach Agent Lambda
    ↓
1. Fetch all GHL integrations
    ↓
2. For each user's GHL account:
   - Get all contacts
   - Filter to contacts with NO conversation history
   - For each new contact:
     ↓
3. Call /api/v1/send-test-to-contact
     ↓
4. Fetch contact data from GHL API
     ↓
5. Extract property info (address, city, state, lead type)
     ↓
6. Call AI Conversation Handler (testMode=false, initial_outreach=true)
     ↓
7. AI generates 5-step script message
     ↓
8. Send via GHL Conversations API
     ↓
9. Message appears in GHL conversation
     ↓
10. Contact receives SMS
```

### Inbound Responses (Real-time)

```
Contact replies via SMS
    ↓
GHL sends webhook to your app
    ↓
GHL Webhook Handler
    ↓
1. Verify webhook signature
    ↓
2. Fetch fresh contact data from GHL API
    ↓
3. Extract property info from custom fields
    ↓
4. Call AI Conversation Handler (testMode=false, initial_outreach=false)
    ↓
5. AI analyzes their message
    ↓
6. AI generates contextual response following script
    ↓
7. Send via GHL Conversations API
    ↓
8. Response appears in GHL conversation
    ↓
9. Contact receives SMS reply
```

## Key Features

### ✅ No Code Duplication
- Single AI handler for all messages
- Single GHL API integration
- Shared conversation logic

### ✅ Always Fresh Data
- Fetches contact data from GHL API (not stale webhook data)
- Gets latest property info from custom fields
- Adapts message based on available data

### ✅ Conversation Threading
- All messages use GHL Conversations API
- Full history visible in GHL
- Proper message threading

### ✅ Smart Adaptation
- If property data exists: includes specific offers
- If data missing: uses generic language, focuses on scheduling visit
- Never mentions amounts without data

### ✅ Rate Limiting
- 2 second delay between outbound messages
- Prevents GHL API throttling
- Respects daily limits

## Data Flow

### Contact Data Sources (Priority Order)

1. **GHL API** (Always fetched fresh)
   - Contact name, phone, email
   - Custom fields (property address, city, state, zip, lead type)
   - Conversation history

2. **Property Analysis API** (If address available)
   - Zestimate value
   - Square footage, beds, baths
   - Year built

3. **AI Calculation**
   - AS-IS cash offer: 70% of Zestimate
   - Retail listing: 100% of Zestimate

## Configuration

### Environment Variables Required

```env
# GHL Integration
GHL_API_KEY=your_ghl_api_key

# AI Service
OPENAI_API_KEY=your_openai_key

# API Endpoint (for Lambda to call)
API_ENDPOINT=https://leads.JoseTheRealtor.com
```

### GHL Custom Field IDs

```typescript
propertyAddress: 'p3NOYiInAERYbe0VsLHB'
propertyCity: 'h4UIjKQvFu7oRW4SAY8W'
propertyState: '9r9OpQaxYPxqbA6Hvtx7'
propertyZip: 'hgbjsTVwcyID7umdhm2o'
leadType: 'oaf4wCuM3Ub9eGpiddrO'
```

## Testing

### Test Outbound Message

```bash
curl -X POST https://leads.JoseTheRealtor.com/api/v1/send-test-to-contact \
  -H "Content-Type: application/json" \
  -d '{"contactId": "OnI6dClVhzwFU8ZOx2rU"}'
```

### Test Inbound Response

Send a text message to your GHL number from the contact's phone. The webhook will automatically trigger.

### Test AI Response (No SMS)

```bash
curl -X POST https://leads.JoseTheRealtor.com/api/v1/test-ai-response \
  -H "Content-Type: application/json" \
  -d '{
    "contactName": "Jose Fernandez",
    "incomingMessage": "How much can you offer?",
    "propertyAddress": "123 Main St",
    "propertyCity": "Miami",
    "propertyState": "FL"
  }'
```

## Deployment

### Deploy the Daily Outreach Agent

```bash
npx ampx sandbox  # For testing
# or
npx ampx pipeline-deploy --branch main  # For production
```

The Lambda will automatically:
- Be created with proper permissions
- Scheduled to run daily at 9 AM EST
- Have access to GHL integration table
- Call your API endpoint for each new contact

## Monitoring

### CloudWatch Logs

- **Daily Outreach**: `/aws/lambda/dailyOutreachAgent`
- **Inbound Webhook**: `/aws/lambda/ghl-webhook`
- **AI Handler**: Check API route logs

### Metrics to Track

- New contacts found daily
- Outreach messages sent
- Inbound messages received
- AI responses generated
- Handoff triggers

## Next Steps

1. ✅ Deploy the daily outreach agent
2. ✅ Configure GHL webhook URL
3. ✅ Add environment variables
4. ✅ Test with your contact
5. ✅ Monitor first 24 hours
6. ✅ Review conversation quality
7. ✅ Adjust script if needed

## Emergency Stop

If AI is sending bad messages:

1. **Disable Daily Agent**: Remove schedule from `resource.ts`
2. **Disable Webhook**: Update `isAIEnabled()` to return `false`
3. **Remove API Key**: Delete `GHL_API_KEY` from environment
