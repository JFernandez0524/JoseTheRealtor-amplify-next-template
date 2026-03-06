# Developer Guide - JoseTheRealtor Platform

**Last Updated:** 2026-03-06

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [API Routes Reference](#api-routes-reference)
3. [Lambda Functions](#lambda-functions)
4. [AI System Customization](#ai-system-customization)
5. [Webhook Configuration](#webhook-configuration)
6. [Testing Procedures](#testing-procedures)
7. [Deployment Guide](#deployment-guide)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Tech Stack
- **Frontend:** Next.js 14 (App Router), React, TypeScript
- **Backend:** AWS Amplify Gen2
- **Database:** DynamoDB
- **Authentication:** AWS Cognito
- **Storage:** S3
- **Functions:** Lambda (Node.js 18)
- **AI:** OpenAI GPT-4o-mini
- **CRM:** GoHighLevel (OAuth integration)

### Key Components

```
app/
├── api/v1/              # API routes (Next.js)
├── components/          # React components
└── utils/               # Utility functions
    ├── aws/
    │   ├── auth/        # Authentication
    │   └── data/        # Data access layer
    ├── billing/         # Subscription management
    ├── bridge.server.ts # Property data API
    └── google.server.ts # Address validation

amplify/
├── auth/                # Cognito config
├── data/                # DynamoDB schema
├── functions/           # Lambda functions
│   ├── shared/          # Shared utilities
│   │   ├── config.ts              # Env validation
│   │   ├── idempotency.ts         # Webhook dedup
│   │   ├── logger.ts              # Structured logging
│   │   ├── sanitize.ts            # Input sanitization
│   │   ├── conversationHandler.ts # AI logic
│   │   ├── ghlTokenManager.ts     # OAuth refresh
│   │   └── outreachQueue.ts       # Queue management
│   ├── ghlWebhookHandler/   # Multi-channel webhook
│   ├── dailyOutreachAgent/  # SMS automation
│   ├── dailyEmailAgent/     # Email automation
│   └── skiptraceLeads/      # Bulk skip trace
└── storage/             # S3 config
```

### Data Flow

**Lead Upload:**
1. User uploads CSV → `POST /api/v1/upload-leads`
2. Validate addresses → Google Maps API
3. Fetch Zestimates → Bridge API
4. Calculate AI scores → OpenAI
5. Store in DynamoDB → Lead table

**AI Outreach:**
1. Hourly cron → `dailyOutreachAgent` Lambda
2. Query OutreachQueue → Find PENDING contacts
3. Generate AI message → `conversationHandler.ts`
4. Send via GHL API → SMS/Email
5. Update queue status → PENDING (for follow-ups)

**Webhook Response:**
1. Lead replies → GHL workflow triggers webhook
2. Lambda receives → `ghlWebhookHandler`
3. Check idempotency → Skip if already processed
4. Fetch conversation history → GHL API
5. Generate AI response → OpenAI
6. Send response → GHL API
7. Update queue status → REPLIED (stop touches)

---

## API Routes Reference

### Core Routes

#### POST /api/v1/analyze-property
Analyze property using Bridge API (Zillow Zestimate)

**Request:**
```json
{
  "street": "123 Main St",
  "city": "Miami",
  "state": "FL",
  "zip": "33101",
  "lat": 25.7617,  // optional
  "lng": -80.1918  // optional
}
```

**Response:**
```json
{
  "success": true,
  "valuation": {
    "zestimate": 450000,
    "lastUpdated": "2026-03-06T10:00:00Z"
  }
}
```

#### POST /api/v1/send-message-to-contact
Production AI SMS outreach to GHL contacts

**Request:**
```json
{
  "contactId": "GHL_CONTACT_ID",
  "accessToken": "GHL_ACCESS_TOKEN",
  "fromNumber": "+17328100182"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "AI message sent successfully"
}
```

#### POST /api/v1/send-email-to-contact
Production AI email outreach to GHL contacts

**Request:** Same as send-message-to-contact

**Response:** Same as send-message-to-contact

#### POST /api/v1/upload-leads
CSV lead upload with validation

**Request:** `multipart/form-data` with `file` field

**Response:**
```json
{
  "success": true,
  "imported": 45,
  "failed": 5,
  "errors": ["Row 3: Invalid address", ...]
}
```

**Process:**
1. Parse CSV
2. Validate addresses (Google Maps)
3. Fetch Zestimates (Bridge API)
4. Calculate AI scores
5. Store in DynamoDB

#### POST /api/v1/refresh-zestimate
Refresh Zestimate for a specific lead

**Request:**
```json
{
  "leadId": "LEAD_ID"
}
```

**Response:**
```json
{
  "success": true,
  "zestimate": 450000,
  "lastUpdated": "2026-03-06T10:00:00Z"
}
```

### OAuth Routes

#### GET /api/v1/oauth/start
Initiate GHL OAuth flow

**Response:** Redirects to GHL authorization page

#### GET /api/v1/oauth/callback
Handle GHL OAuth callback

**Query Params:**
- `code` - Authorization code from GHL
- `state` - CSRF token

**Response:** Redirects to profile with success/error

#### POST /api/v1/oauth/refresh
Refresh expired GHL access token

**Response:**
```json
{
  "success": true,
  "accessToken": "NEW_ACCESS_TOKEN"
}
```

### Webhook Routes

#### POST /api/v1/ghl-email-webhook
Handle email replies and bounces

**Payload:**
```json
{
  "type": "EmailReceived",
  "contactId": "GHL_CONTACT_ID",
  "body": "Email content"
}
```

**Actions:**
- Reply: Tag contact, generate AI response, send email
- Bounce: Tag contact, stop future emails

### Testing Routes

#### POST /api/v1/test-ai-response
Test AI responses without sending messages

**Request:**
```json
{
  "contactId": "GHL_CONTACT_ID",
  "message": "Test message"
}
```

**Response:**
```json
{
  "aiResponse": "Generated AI message"
}
```

---

## Lambda Functions

### ghlWebhookHandler
**Purpose:** Handle all inbound messages from GHL (SMS, Facebook, Instagram, WhatsApp)

**Trigger:** Lambda Function URL (webhook)

**URL:** `https://dpw6qwhfwor3hucpbsitt7skzq0itemx.lambda-url.us-east-1.on.aws/`

**Key Features:**
- Environment validation at module load
- Webhook idempotency (prevents duplicates)
- Direction check (skips outbound agent messages)
- Input sanitization
- Structured error logging

**Flow:**
1. Validate environment variables
2. Check idempotency (skip if already processed)
3. Check message direction (skip if outbound)
4. Sanitize input (contactId, userId, etc.)
5. Fetch conversation history from GHL
6. Generate AI response via conversationHandler
7. Send response via GHL API
8. Update OutreachQueue status
9. Mark webhook as processed

### dailyOutreachAgent
**Purpose:** Automated SMS outreach to new contacts

**Trigger:** EventBridge (hourly during business hours)

**Flow:**
1. Query OutreachQueue for PENDING SMS contacts
2. Filter by business hours (Mon-Fri 9AM-7PM, Sat 9AM-12PM EST)
3. Generate AI message for each contact
4. Send via GHL API
5. Update queue status (PENDING for follow-ups)

### dailyEmailAgent
**Purpose:** Automated email outreach to new contacts

**Trigger:** EventBridge (hourly during business hours)

**Flow:** Same as dailyOutreachAgent but for emails

### skiptraceLeads
**Purpose:** Bulk skip trace leads via Bridge API

**Trigger:** API call from dashboard

**Flow:**
1. Receive array of lead IDs
2. Fetch lead data from DynamoDB
3. Call Bridge API for each lead
4. Parse and format contact data
5. Update leads in DynamoDB (parallel)
6. Return results

---

## AI System Customization

### Conversation Handler

**Location:** `amplify/functions/shared/conversationHandler.ts`

**System Prompt:** Lines 190-320

**Key Training Areas:**

#### 1. Compliance Rules (Lines 195-210)
```typescript
COMPLIANCE RULES:
- Identify yourself as Jose's AI assistant
- Hand off to human for complex questions
- Never give legal/financial advice
- Exit gracefully if already listed
```

#### 2. Conversation Style (Lines 250-280)
```typescript
RESPONSE STYLE:
- Keep messages 1-2 sentences
- Ask one question at a time
- Use natural, conversational language
- No emojis, no salesy language
```

#### 3. Lead Qualification (Lines 220-250)
```typescript
QUALIFICATION QUESTIONS:
- Determine if buyer or seller
- Get property address (sellers)
- Present cash offer vs retail options
- Schedule consultation
```

### Modifying AI Behavior

**To make AI more aggressive:**
```typescript
CONVERSATION RULES:
- Ask 2-3 questions per message
- Push for appointment in every response
- Emphasize urgency and scarcity
```

**To make AI more casual:**
```typescript
RESPONSE STYLE:
- Use emojis occasionally 😊
- More contractions (gonna, wanna)
- Shorter sentences
```

### Testing AI Changes

**Test endpoint:** `POST /api/v1/test-ai-response`

```bash
curl -X POST http://localhost:3000/api/v1/test-ai-response \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "TEST_ID",
    "message": "Yes, I want to sell"
  }'
```

---

## Webhook Configuration

### Multi-Channel Message Webhook

**URL:** `https://dpw6qwhfwor3hucpbsitt7skzq0itemx.lambda-url.us-east-1.on.aws/`

**Setup in GHL:**
1. Go to Automations → Workflows
2. Create workflow: "Customer Replied"
3. Add filter: Message Type = SMS, Facebook, Instagram, WhatsApp
4. Add action: Send Webhook Request (POST)
5. URL: Lambda Function URL above
6. Body: Raw JSON (GHL provides payload)

**Supported Message Types:**
- Type 2: SMS
- Type 3: Facebook Messenger
- Type 4: Instagram DM
- Type 5: WhatsApp

### Email Reply/Bounce Webhook

**URL:** `https://your-domain.com/api/v1/ghl-email-webhook`

**Setup in GHL:**
1. Create workflow: "Email Received"
2. Add action: Send Webhook Request (POST)
3. URL: API route above
4. Body: Include contactId, body, type

### Field Sync Webhook

**URL:** `https://xjiwzxgpa4nzpxdxjl5ib6xdom0gdtvx.lambda-url.us-east-1.on.aws/`

**Purpose:** Sync call dispositions across all contacts for same lead

**Setup:** See `docs/GHL_FIELD_SYNC_WEBHOOK_SETUP.md`

### Thanks.io Direct Mail Webhook

**URL:** `https://turhumn37zo2ksb5pfckwbyi7m0hssnq.lambda-url.us-east-1.on.aws/`

**Purpose:** Track direct mail delivery and QR scans

**Setup:**
1. Go to thanks.io dashboard → Webhooks
2. Add webhook URL above
3. When sending mail, set `custom_1` = `{{contact.contact_id}}`

---

## Testing Procedures

### Local Development

```bash
# Install dependencies
npm install

# Start Amplify sandbox
npx ampx sandbox

# Run development server
npm run dev
```

### Testing AI Responses

**Test without sending messages:**
```bash
curl -X POST http://localhost:3000/api/v1/test-ai-response \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "TEST_ID",
    "message": "How did you get my info?"
  }'
```

**Expected response:** AI explains county records source

### Testing Webhook Idempotency

```bash
WEBHOOK_ID="test-$(date +%s)"

# Send first request
curl -X POST https://dpw6qwhfwor3hucpbsitt7skzq0itemx.lambda-url.us-east-1.on.aws/ \
  -H "x-ghl-webhook-id: $WEBHOOK_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "InboundMessage",
    "contactId": "test",
    "customData": {
      "userId": "test",
      "messageBody": "hi",
      "direction": "inbound"
    }
  }'

# Send duplicate (should return "Already processed")
curl -X POST https://dpw6qwhfwor3hucpbsitt7skzq0itemx.lambda-url.us-east-1.on.aws/ \
  -H "x-ghl-webhook-id: $WEBHOOK_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "InboundMessage",
    "contactId": "test",
    "customData": {
      "userId": "test",
      "messageBody": "hi",
      "direction": "inbound"
    }
  }'
```

### Testing CSV Upload

1. Navigate to http://localhost:3000/upload
2. Download template CSV
3. Add 10-20 test leads
4. Upload and watch progress modal
5. Verify leads appear on dashboard

**Expected:**
- Progress bar updates every 10 rows
- Automatic redirect on completion
- All valid leads visible on dashboard

### Testing Lead Enrichment

1. Upload preforeclosure leads
2. Select leads from dashboard
3. Click "🏦 Enrich Leads"
4. Verify cost preview ($0.29/lead)
5. Confirm enrichment
6. Check lead details for enriched data

**Expected:**
- Real equity percentage
- Mortgage balances
- Quality phone numbers (mobile, 90+ score)
- Owner emails

---

## Deployment Guide

### Environment Variables

**Required for all environments:**
```env
GOOGLE_MAPS_API_KEY=your_key
BRIDGE_API_KEY=your_key
OPENAI_API_KEY=your_key
GHL_CLIENT_ID=your_key
GHL_CLIENT_SECRET=your_key
```

**Local development:** `.env.local`

**Production:** Amplify Console → Environment variables

### Sandbox Deployment

```bash
# Export environment variables
set -a && source .env.local && set +a

# Deploy to sandbox
npx ampx sandbox
```

### Production Deployment

```bash
# Commit changes
git add .
git commit -m "feat: your changes"

# Push to main branch
git push origin main
```

**Amplify automatically:**
1. Detects push to main
2. Runs build process
3. Deploys Lambda functions
4. Updates API routes
5. Deploys frontend

### Post-Deployment Tasks

**Enable TTL on WebhookIdempotency table:**
```bash
TABLE_NAME=$(aws dynamodb list-tables --query "TableNames[?contains(@, 'WebhookIdempotency')]" --output text)

aws dynamodb update-time-to-live \
  --table-name "$TABLE_NAME" \
  --time-to-live-specification "Enabled=true, AttributeName=ttl"
```

**Verify deployment:**
```bash
# Check Lambda logs
aws logs tail /aws/lambda/ghlWebhookHandler --follow

# Test webhook
curl -X POST https://dpw6qwhfwor3hucpbsitt7skzq0itemx.lambda-url.us-east-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d '{"type":"InboundMessage","contactId":"test"}'
```

---

## Troubleshooting

### AI Not Responding

**Check:**
1. GHL webhook configuration
2. OAuth token validity
3. CloudWatch logs for errors
4. Test using `/api/v1/test-ai-response`

**Common issues:**
- Webhook URL incorrect
- Token expired (should auto-refresh)
- Missing environment variables
- Direction check blocking (if agent sent message)

### Duplicate Messages

**Check:**
1. WebhookIdempotency table exists
2. TTL enabled on table
3. Webhook ID in request headers
4. CloudWatch logs for "Already processed"

**Fix:**
```bash
# Enable TTL
TABLE_NAME=$(aws dynamodb list-tables --query "TableNames[?contains(@, 'WebhookIdempotency')]" --output text)
aws dynamodb update-time-to-live \
  --table-name "$TABLE_NAME" \
  --time-to-live-specification "Enabled=true, AttributeName=ttl"
```

### Lambda Deployment Not Working

**Issue:** Code changes not deploying via `npx ampx sandbox`

**Fix:**
```bash
# Option 1: Direct Lambda update
cd amplify/functions/YOUR_FUNCTION
zip -r function.zip .
aws lambda update-function-code \
  --function-name YOUR_FUNCTION_NAME \
  --zip-file fileb://function.zip
cd ../../..

# Option 2: Production deployment
git add .
git commit -m "fix: your changes"
git push origin main
```

### Missing Environment Variables

**Symptom:** Lambda fails with "Missing required env vars"

**Fix:**
1. Check `.env.local` has all required variables
2. Export before sandbox: `set -a && source .env.local && set +a`
3. For production: Add to Amplify Console → Environment variables

### Rate Limiting Errors

**Symptom:** GHL API returns 429 Too Many Requests

**Fix:**
- Rate limits: 100/hour, 1000/day
- Reduce outreach frequency
- Check for infinite loops in webhooks
- Review CloudWatch logs for excessive calls

### Webhook Not Triggering

**Check:**
1. Webhook URL correct in GHL workflow
2. Workflow enabled and published
3. Trigger conditions met
4. Lambda Function URL accessible (public)

**Test manually:**
```bash
curl -X POST https://your-webhook-url \
  -H "Content-Type: application/json" \
  -d '{"type":"InboundMessage","contactId":"test"}'
```

---

## Quick Reference

### Useful Commands

```bash
# Deploy sandbox
set -a && source .env.local && set +a && npx ampx sandbox

# Watch Lambda logs
aws logs tail /aws/lambda/ghlWebhookHandler --follow

# Check idempotency table
aws dynamodb scan --table-name $(aws dynamodb list-tables --query "TableNames[?contains(@, 'WebhookIdempotency')]" --output text) --limit 10

# Test AI response
curl -X POST http://localhost:3000/api/v1/test-ai-response \
  -H "Content-Type: application/json" \
  -d '{"contactId":"TEST","message":"hi"}'
```

### Important URLs

- **Webhook Handler:** `https://dpw6qwhfwor3hucpbsitt7skzq0itemx.lambda-url.us-east-1.on.aws/`
- **Field Sync Webhook:** `https://xjiwzxgpa4nzpxdxjl5ib6xdom0gdtvx.lambda-url.us-east-1.on.aws/`
- **Thanks.io Webhook:** `https://turhumn37zo2ksb5pfckwbyi7m0hssnq.lambda-url.us-east-1.on.aws/`

### Key Files

- **AI Logic:** `amplify/functions/shared/conversationHandler.ts`
- **Token Manager:** `amplify/functions/shared/ghlTokenManager.ts`
- **Queue Manager:** `amplify/functions/shared/outreachQueue.ts`
- **Config Validator:** `amplify/functions/shared/config.ts`
- **Idempotency:** `amplify/functions/shared/idempotency.ts`
