# AI Messaging Bot - Testing Guide

## ✅ Current Status: PRODUCTION READY

### Recent Updates (2026-01-24):

1. **Webhook Integration - DEPLOYED**
   - Dedicated Lambda function for instant SMS responses
   - Lambda Function URL: https://dpw6qwhfwor3hucpbsitt7skzq0itemx.lambda-url.us-east-1.on.aws/
   - Direct DynamoDB access with proper IAM permissions
   - Automatic OAuth token refresh
   - No polling delay - instant AI responses

2. **Architecture Change**
   - Moved from Next.js API route to dedicated Lambda function
   - Reason: Next.js API routes don't have AWS credentials for DynamoDB
   - Solution: Lambda functions in `amplify/functions/` get explicit IAM permissions
   - Shared utilities in `amplify/functions/shared/` for code reuse

3. **AI Enable Logic**
   - Checks for valid lead type (Probate or PREFORECLOSURE)
   - Requires phone number on contact
   - Excludes "Direct Mail" only contacts
   - Future: Will add app plan and account status checks

## Testing Without Sending Live Messages

### Option 1: Test Endpoint (Recommended)

Use the test endpoint to simulate conversations:

```bash
# Test basic greeting
curl -X POST https://your-domain.com/api/v1/test-ai-response \
  -H "Content-Type: application/json" \
  -d '{
    "contactName": "John Doe",
    "incomingMessage": "Hi, I got your message about my property",
    "propertyAddress": "123 Main St",
    "propertyCity": "Miami",
    "propertyState": "FL",
    "propertyZip": "33101",
    "leadType": "PREFORECLOSURE"
  }'

# Test interest in offer
curl -X POST https://your-domain.com/api/v1/test-ai-response \
  -H "Content-Type: application/json" \
  -d '{
    "contactName": "Jane Smith",
    "incomingMessage": "How much can you offer for my house?",
    "propertyAddress": "456 Oak Ave",
    "propertyCity": "Tampa",
    "propertyState": "FL",
    "propertyZip": "33602",
    "leadType": "PROBATE"
  }'

# Test appointment scheduling
curl -X POST https://your-domain.com/api/v1/test-ai-response \
  -H "Content-Type: application/json" \
  -d '{
    "contactName": "Bob Johnson",
    "incomingMessage": "Yes, Wednesday at 3pm works for me",
    "propertyAddress": "789 Pine Rd",
    "propertyCity": "Orlando",
    "propertyState": "FL",
    "propertyZip": "32801",
    "leadType": "PREFORECLOSURE"
  }'
```

### Option 2: Postman/Insomnia

Import this collection:

**Endpoint:** `POST /api/v1/test-ai-response`

**Body:**
```json
{
  "contactName": "Test Contact",
  "incomingMessage": "Your test message here",
  "propertyAddress": "123 Main St",
  "propertyCity": "Miami",
  "propertyState": "FL",
  "propertyZip": "33101",
  "leadType": "PREFORECLOSURE"
}
```

## Test Scenarios

### 1. Initial Contact
**Message:** "Hi, I got your message about my property"
**Expected:** Should follow 5-step script, introduce Jose, mention both options

### 2. Interest in Offer
**Message:** "How much can you offer?"
**Expected:** Should mention AS-IS cash offer (70% of Zestimate) and retail listing option

### 3. Questions About Process
**Message:** "How does this work?"
**Expected:** Should explain both speed option and top-dollar option

### 4. Ready to Schedule (Handoff Trigger)
**Message:** "I'm interested, can we schedule a time?"
**Expected:** Should trigger handoff, tag contact, send handoff message

### 5. Objections
**Message:** "That seems low"
**Expected:** Should explain both options, emphasize choice and control

### 6. Timeline Questions
**Message:** "How fast can you close?"
**Expected:** Should mention quick cash close vs traditional listing timeline

## Verifying the Script

The AI should follow this structure:

1. ✅ Identify as Jose Fernandez from RE/MAX Homeland Realtors
2. ✅ Mention seeing public notice about the property
3. ✅ Present BOTH options:
   - Cash offer (AS-IS, quick close)
   - Retail listing (maximum value)
4. ✅ Explain the "why" - giving them control with both speed and top-dollar options
5. ✅ Push for 10-minute property visit appointment
6. ✅ Include actual numbers when available:
   - AS-IS offer: 70% of Zestimate
   - Retail value: Full Zestimate

## Checking Property Data

The AI should have access to:
- Property address
- Zestimate value
- AS-IS cash offer (70% of Zestimate)
- Retail listing value (100% of Zestimate)

Verify in test response that these values are included in the system prompt.

## Before Going Live Checklist

- [ ] Environment variables configured (GHL_API_KEY, OPENAI_API_KEY)
- [ ] Test all 6 scenarios above
- [ ] Verify script is followed in responses
- [ ] Confirm property data is included
- [ ] Test handoff triggers work correctly
- [ ] Update `isAIEnabled()` with proper GHL field checks
- [ ] Set up monitoring/logging for live conversations
- [ ] Create GHL custom fields for AI control
- [ ] Test with real GHL contact (in test mode first)
- [ ] Verify webhook signature validation works
- [ ] Test duplicate webhook prevention

## Monitoring After Launch

1. **Check Logs**
   - Review CloudWatch logs for errors
   - Monitor OpenAI API usage
   - Track handoff triggers

2. **Review Conversations**
   - Manually review first 10-20 conversations
   - Check if script is being followed
   - Verify property data accuracy
   - Confirm handoffs are working

3. **Metrics to Track**
   - Response rate
   - Handoff rate
   - Appointment booking rate
   - Average conversation length
   - Error rate

## Emergency Stop

If AI is sending bad messages:

1. **Immediate:** Set all contacts' `aiState` field to "paused" in GHL
2. **Or:** Remove `GHL_API_KEY` from environment variables
3. **Or:** Update `isAIEnabled()` to return `false` for all contacts

## Support

For issues or questions, check:
- CloudWatch logs: `/aws/lambda/ghl-webhook`
- Test endpoint: `/api/v1/test-ai-response`
- Webhook test: `/api/v1/webhook-test`
