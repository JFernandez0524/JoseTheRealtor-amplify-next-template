# API Routes Documentation

## Core Routes

### POST /api/v1/analyze-property
**Purpose:** Analyze property using Bridge API (Zillow Zestimate)
**Auth:** Optional
**Request:**
- `street`, `city`, `state`, `zip` - Structured address
- `lat`, `lng` - Coordinates (optional, for fallback)
- `address` - Raw address string (fallback)
**Response:** `{ success, valuation, assessment, error }`
**Used by:** Frontend property analyzer, lead details

### POST /api/v1/send-message-to-contact
**Purpose:** Production AI outreach to GHL contacts
**Auth:** GHL access token (no user auth)
**Request:**
- `contactId` - GHL contact ID
- `accessToken` - GHL OAuth token
- `fromNumber` - Phone to send from (optional)
**Response:** `{ success, message, error }`
**Used by:** dailyOutreachAgent Lambda, manual triggers
**Custom Fields:**
- `p3NOYiInAERYbe0VsLHB` - Property Address
- `h4UIjKQvFu7oRW4SAY8W` - Property City
- `9r9OpQaxYPxqbA6Hvtx7` - Property State
- `hgbjsTVwcyID7umdhm2o` - Property ZIP
- `oaf4wCuM3Ub9eGpiddrO` - Lead Type

### POST /api/v1/send-email-to-contact
**Purpose:** Production AI email outreach to GHL contacts
**Auth:** GHL access token
**Request:** Same as send-message-to-contact
**Response:** `{ success, message, error }`
**Used by:** dailyEmailAgent Lambda

### POST /api/v1/ghl-email-webhook
**Purpose:** Handle GHL email events (replies, bounces)
**Auth:** None (webhook)
**Request:** GHL webhook payload
**Response:** `{ success, message }`
**Actions:**
- Detects email replies → Tags contact, generates AI response
- Detects bounces → Tags contact, stops future emails
**Used by:** GHL email workflow webhooks

### POST /api/v1/start-email-campaign
**Purpose:** Manual bulk email campaign trigger
**Auth:** Required (user must be authenticated)
**Request:** None (uses user's GHL integration)
**Response:** `{ success, sent, failed, errors }`
**Used by:** Dashboard "Start Email Campaign" button

### POST /api/v1/refresh-zestimate
**Purpose:** Refresh Zestimate for a specific lead
**Auth:** Required
**Request:**
- `leadId` - Lead ID to refresh
**Response:** `{ success, zestimate, lastUpdated }`
**Used by:** Lead detail page refresh button

### POST /api/v1/upload-leads
**Purpose:** CSV lead upload with validation
**Auth:** Required
**Request:**
- `file` - CSV file (multipart/form-data)
**Response:** `{ success, imported, failed, errors }`
**Process:**
1. Parse CSV
2. Validate addresses (Google Maps)
3. Fetch Zestimates (Bridge API)
4. Calculate AI scores
5. Store in DynamoDB
**Used by:** Upload page

### POST /api/v1/enrich-leads
**Purpose:** Enrich preforeclosure leads with BatchData
**Auth:** Required
**Request:**
- `leadIds` - Array of lead IDs to enrich
**Response:** `{ success, enriched, cost }`
**Cost:** $0.29 per lead
**Used by:** Dashboard bulk enrich button

### POST /api/v1/ai/score-leads
**Purpose:** Calculate AI scores for leads
**Auth:** Required
**Request:**
- `leadIds` - Array of lead IDs to score
**Response:** `{ success, scored }`
**Scoring factors:** Equity, value, timeline, location, contact availability
**Used by:** Dashboard bulk AI score button

## OAuth Routes

### GET /api/v1/oauth/start
**Purpose:** Initiate GHL OAuth flow
**Auth:** Required
**Response:** Redirects to GHL authorization page
**Used by:** Profile page "Connect GHL" button

### GET /api/v1/oauth/callback
**Purpose:** Handle GHL OAuth callback
**Auth:** None (OAuth flow)
**Query params:**
- `code` - Authorization code from GHL
- `state` - CSRF token
**Response:** Redirects to profile with success/error
**Actions:** Exchanges code for tokens, stores in GhlIntegration table

### POST /api/v1/oauth/refresh
**Purpose:** Refresh expired GHL access token
**Auth:** Required
**Request:** None (uses stored refresh token)
**Response:** `{ success, accessToken }`
**Used by:** Token manager, before GHL API calls

## Webhook Routes

### POST /api/v1/ghl-email-webhook
**Purpose:** Handle email replies and bounces
**Auth:** None (webhook)
**Payload:**
- `type` - Event type (EmailReceived, EmailBounced)
- `contactId` - GHL contact ID
- `body` - Email body (for replies)
**Actions:**
- Reply: Tag contact, generate AI response, send email
- Bounce: Tag contact, stop future emails

### POST /api/v1/ghl-disposition-webhook
**Purpose:** Handle GHL opportunity disposition changes
**Auth:** None (webhook)
**Used by:** GHL workflow automations

### POST /api/v1/ghl-field-sync-webhook
**Purpose:** Sync custom field updates from GHL to app
**Auth:** None (webhook)
**Used by:** GHL workflow automations

## Billing Routes

### POST /api/v1/billing/create-checkout
**Purpose:** Create Stripe checkout session
**Auth:** Required
**Request:**
- `priceId` - Stripe price ID
- `plan` - Plan name (SYNC_PLAN, AI_OUTREACH_PLAN)
**Response:** `{ url }` - Stripe checkout URL
**Used by:** Pricing page subscription buttons

### POST /api/v1/billing/buy-credits
**Purpose:** Purchase skip trace credits
**Auth:** Required
**Request:**
- `amount` - Credit amount (100, 250, 500)
**Response:** `{ url }` - Stripe checkout URL
**Used by:** Profile page credit purchase

### POST /api/v1/billing/webhook
**Purpose:** Handle Stripe webhook events
**Auth:** Stripe signature verification
**Events:**
- `checkout.session.completed` - Grant access, add credits
- `invoice.payment_succeeded` - Renew subscription
- `invoice.payment_failed` - Revoke access
**Actions:** Update user groups, credit balance

## Testing Routes

### POST /api/v1/test-ai-response
**Purpose:** Test AI responses without sending messages
**Auth:** Required
**Request:**
- `contactId` - GHL contact ID
- `message` - Test message
**Response:** `{ aiResponse }` - Generated AI message
**Used by:** Testing AI conversation flow

### POST /api/v1/send-test-to-contact
**Purpose:** Send test message to contact
**Auth:** Required
**Request:** Same as send-message-to-contact
**Response:** `{ success, message }`
**Used by:** Manual testing

## Utility Routes

### GET /api/v1/ghl-phone-numbers
**Purpose:** Get available GHL phone numbers for user
**Auth:** Required
**Response:** `{ phoneNumbers: [] }`
**Used by:** Profile GHL settings dropdown

### GET /api/v1/field-reference
**Purpose:** Get GHL custom field ID reference
**Auth:** Required
**Response:** `{ fields: {} }` - Field name to ID mapping
**Used by:** Development reference

### GET /api/v1/integration-checklist
**Purpose:** Check GHL integration status
**Auth:** Required
**Response:** `{ connected, hasPhone, hasEmail, hasWorkflow }`
**Used by:** Profile integration status

## Custom Field ID Reference

### Contact Fields
- `p3NOYiInAERYbe0VsLHB` - Property Address
- `h4UIjKQvFu7oRW4SAY8W` - Property City
- `9r9OpQaxYPxqbA6Hvtx7` - Property State
- `hgbjsTVwcyID7umdhm2o` - Property ZIP
- `oaf4wCuM3Ub9eGpiddrO` - Lead Type (PROBATE/PREFORECLOSURE)
- `pGfgxcdFaYAkdq0Vp53j` - Contact Type (Phone Contact/Direct Mail)
- `7wIe1cRbZYXUnc3WOVb2` - Zestimate (listing value)
- `sM3hEOHCJFoPyWhj1Vc8` - Cash Offer (70% value)
- `wWlrXoXeMXcM6kUexf2L` - Email Attempt Counter
- `3xOBr4GvgRc22kBRNYCE` - Last Email Date
- `0MD4Pp2LCyOSCbCjA5qF` - Call Attempt Counter
- `dWNGeSckpRoVUxXLgxMj` - Last Call Date
- `1NxQW2kKMVgozjSUuu7s` - AI State (not_started, in_progress, qualified, etc.)

### Mailing Address Fields
- `2RCYsC2cztJ1TWTh0tLt` - Mailing Address
- `2F48dc4QEAOFHNgBNVcu` - Mailing City
- `WzTPYXsXyPcnFSWn2UFf` - Mailing State
- `Vx4EIVAsIK3ej5jEv3Bm` - Mailing ZIP

### App Control Fields
- `CNoGugInWOC59hAPptxY` - App User ID
- `YEJuROSCNnG9OXi3K8lb` - App Plan
- `diShiF2bpX7VFql08MVN` - App Account Status
- `aBlDP8DU3dFSHI2LFesn` - App Lead ID
- `PBInTgsd2nMCD3Ngmy0a` - Lead Source ID (for suppression)

### Additional Phone/Email Fields
- `LkmfM0Va5PylJFsJYjCu` - Phone 2
- `Cu6zwsuWrxoVWdxySc6t` - Phone 3
- `hxwJG0lYeV18IxxWh09H` - Phone 4
- `8fIoSV1W05ciIrn01QT0` - Phone 5
- `JY5nf3NzRwfCGvN5u00E` - Email 2
- `1oy6TLKItn5RkebjI7kD` - Email 3

## Environment Variables Used

### Required for All Routes
- `NEXT_PUBLIC_AWS_REGION` - AWS region
- `NEXT_PUBLIC_USER_POOL_ID` - Cognito user pool
- `NEXT_PUBLIC_USER_POOL_CLIENT_ID` - Cognito client

### API Keys
- `GOOGLE_MAPS_API_KEY` - Address validation
- `BRIDGE_API_KEY` - Zillow Zestimate data
- `OPENAI_API_KEY` - AI message generation

### GHL Integration
- `GHL_CLIENT_ID` - OAuth client ID
- `GHL_CLIENT_SECRET` - OAuth client secret

### Billing
- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Frontend Stripe key

## Rate Limits

### GHL API
- 100 requests per hour per user
- 1000 requests per day per user
- Enforced in: manualGhlSync Lambda

### Bridge API
- 2 second delay between requests
- Enforced in: uploadCsvHandler

### OpenAI API
- No explicit limit (pay-per-use)
- Used for: AI message generation

## Error Handling

All routes return consistent error format:
```json
{
  "success": false,
  "error": "Error message",
  "details": {} // Optional additional context
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad request (missing params)
- `401` - Unauthorized (auth required)
- `403` - Forbidden (insufficient permissions)
- `500` - Server error
