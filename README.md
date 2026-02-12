# JoseTheRealtor - Real Estate Lead Management Platform

A comprehensive real estate lead management platform built with AWS Amplify Gen2 and Next.js 14. Streamline your property lead analysis, skip tracing, and CRM integration workflow.

## Features

- **Lead Management**: Import and analyze property leads (preforeclosure, probate)
- **AI Lead Scoring**: Intelligent prioritization with 0-100 scores based on equity, value, timeline, location, and contact availability
- **AI Insights Dashboard**: View top hottest leads, urgent attention items, and best ROI opportunities
- **AI Messaging Bot**: Automated conversations across SMS, Facebook Messenger, Instagram DMs, and WhatsApp using OpenAI
- **Multi-Channel Outreach**: Coordinated messaging with instant AI responses on all platforms
- **Outreach Queue System**: Efficient DynamoDB-based queue for tracking outreach status (90% reduction in API costs)
- **Automated Email Campaigns**: Bulk prospecting emails with personalized property details, Zestimate values, and cash offers
- **Multi-Channel Outreach**: Coordinated SMS and email campaigns with automatic reply/bounce detection and tagging
- **Business Hours Compliance**: All outreach respects Mon-Fri 9AM-7PM, Sat 9AM-12PM EST schedule
- **Property Enrichment (Preforeclosure)**: Real equity data, mortgage balances, and quality contact info via BatchData ($0.29/lead)
- **Skip Tracing**: Pay-per-use contact lookup at $0.10 per skip (probate leads)
- **Bulk Operations**: Update multiple lead statuses, skip trace, enrich, calculate AI scores, and sync in one click
- **Smart Filtering**: Filter by manual status, AI priority, owner occupied, high equity, skip trace date, and property type
- **Property Valuation**: Real-time Zestimate data with refresh capability and age indicators
- **CRM Integration**: Seamless GoHighLevel synchronization with rate limiting protection
- **Direct Mail Automation**: Automatic Zestimate and cash offer calculation for GHL Click2Mail campaigns
- **Daily Outreach Automation**: Automatically finds and messages new GHL contacts every day at 9 AM EST
- **AI Assistant**: Claude 3.5 Sonnet for lead analysis and follow-ups
- **Address Validation**: Google Maps API integration for property verification
- **Role-Based Access**: FREE, SYNC PLAN, AI OUTREACH PLAN, and ADMIN tiers

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- AWS Account with Amplify CLI configured
- Google Maps API key
- GoHighLevel account (for CRM integration)

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd JoseTheRealtor-amplify-next-template
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your API keys:
   ```env
   GOOGLE_MAPS_API_KEY=your_google_maps_key
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
   GHL_CLIENT_ID=your_ghl_client_id
   GHL_CLIENT_SECRET=your_ghl_client_secret
   OPENAI_API_KEY=your_openai_key
   ```

3. **Deploy AWS backend**
   ```bash
   npx ampx sandbox
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

Visit `http://localhost:3000` to access the application.

## Usage Guide

### Getting Started

1. **Sign Up**: Create an account or sign in with Google OAuth
2. **Upload Leads**: Import property leads via CSV upload
3. **Analyze Properties**: Use the property analyzer for market insights
4. **Skip Trace**: Discover contact information for property owners
5. **Sync to CRM**: Connect GoHighLevel and sync qualified leads

### Lead Import Format

Your CSV should include these columns:
- `ownerFirstName`, `ownerLastName`
- `ownerAddress`, `ownerCity`, `ownerState`, `ownerZip`
- `type` (PREFORECLOSURE or PROBATE)
- Optional: `estimatedValue`, `foreclosureAuctionDate`

### Pricing Structure

- **FREE**: 5 starter credits + ability to purchase more at $0.10/skip
- **SYNC PLAN**: $97/month for GHL integration with manual outreach workflows
- **AI OUTREACH PLAN**: $250/month for automated AI text agent + all SYNC features
- **Skip Credits**: Available to all users at $0.10 per skip (packages: 100/$10, 250/$25, 500/$50)

## Deployment to Production

Deploy to AWS Amplify hosting:

```bash
npx ampx generate outputs --app-id <your-app-id> --branch main
npm run build
```

For detailed deployment instructions, see the [Amplify documentation](https://docs.amplify.aws/nextjs/start/quickstart/nextjs-app-router-client-components/#deploy-a-fullstack-app-to-aws).

## User Guide

### Dashboard Navigation

- **Dashboard**: View all your property leads with filtering and sorting
- **Upload**: Import new leads via CSV file upload
- **Profile**: Manage account settings and view credit balance
- **Chat**: Access AI assistant for lead analysis and follow-ups

### Lead Management Workflow

1. **Import Leads**
   - Navigate to Upload page
   - Select CSV file with property data
   - System automatically validates addresses, fetches Zestimate data, and processes leads
   - Rate-limited API calls prevent service interruptions during large uploads

2. **AI Lead Scoring**
   - Select leads from dashboard
   - Click "🤖 Calculate AI Scores" to analyze leads
   - AI scores (0-100) based on equity, value, timeline, location, and contact availability
   - Filter by AI Priority (HIGH/MEDIUM/LOW) to focus on hottest leads
   - View AI Insights Dashboard for top leads, urgent items, and best ROI opportunities

3. **Property Enrichment (Preforeclosure Only)**
   - Select preforeclosure leads from dashboard
   - Click "🏦 Enrich Leads" to get real property data ($0.29/lead)
   - Enrichment includes:
     - Real equity percentage and mortgage balances
     - Owner emails and quality phone numbers (mobile, score 90+, not DNC)
     - Property flags (owner occupied, high equity, free & clear)
     - Foreclosure details and lender information
   - Filter enriched leads by owner occupied and high equity
   - View enrichment data in lead details page
   - Note: Probate leads use regular skip trace ($0.10/lead) instead

4. **Manage Lead Status**
   - Use manual status dropdown to mark leads as ACTIVE, SOLD, PENDING, OFF_MARKET, SKIP, or DIRECT_MAIL
   - Bulk update multiple leads at once using "Set Status..." dropdown
   - Filter dashboard by status to focus on active opportunities
   - Leads marked as SOLD or SKIP are automatically excluded from skip tracing

5. **Monitor Property Values**
   - View Zestimate data with age indicator (shows days since last update)
   - Red warning appears for data older than 180 days
   - Click refresh button (↻) next to any Zestimate to fetch current value
   - Click Zestimate amount to view property on Zillow

6. **Skip Trace Contacts (Probate Leads)**
   - Select probate leads from dashboard
   - View cost preview before skip tracing (shows $0.10 per lead)
   - Click "Skip Trace" to find contact information
   - Review discovered phone numbers and emails
   - Filter by skip trace completion date for targeted downloads

7. **Download Skip Traced Data**
   - Use date range filters to target specific time periods
   - Click "Download Skip Traced" to export leads with contact information
   - CSV includes owner details, property info, phone numbers, emails, manual status, and completion dates

8. **CRM Integration & Automated Campaigns**
   - Connect GoHighLevel account in Profile settings (connection persists across sessions)
   - Configure campaign settings (phone number and email) in Profile → GHL Settings
   - Select qualified leads for sync
   - Rate limiting prevents API blocks (100/hour, 1000/day limits enforced)
   - Leads automatically appear in your GHL pipeline with:
     - Zestimate data (full market value for listing option)
     - Cash offer (70% of Zestimate for as-is purchase option)
     - Appropriate tags for direct mail or phone campaigns
   - **Initial Email**: Automatically sent to all email addresses when contact is created
   - **Bulk Email Campaign**: Click "📧 Start Email Campaign" to email all eligible contacts
   - **Daily SMS Outreach**: Automated at 9 AM EST for contacts with "AI Outreach" tag
   - **Reply Handling**: Automatic detection and tagging of email/SMS replies
   - **Bounce Protection**: Stops emails to bounced addresses automatically

9. **GHL Campaign Settings**
   - Go to Profile → GHL Settings card
   - **Campaign Phone**: Select which GHL phone number to use for SMS campaigns
   - **Campaign Email**: Set your verified email address for email campaigns
   - All messages will be sent from your selected phone/email
   - Replies route directly to you

10. **AI Messaging Bot (Multi-Channel Automated Outreach)**
   - **Supported Channels**: SMS, Facebook Messenger, Instagram DMs, WhatsApp
   - **Daily Automation**: Runs every hour during business hours
   - **Business Hours**: Mon-Fri 9AM-7PM, Sat 9AM-12PM EST (Sunday closed)
   - **Target Contacts**: New GHL contacts with "AI Outreach" tag who haven't been messaged
   - **Webhook Integration**: Instant AI responses to inbound messages via dedicated Lambda function
   - **Conversation Flow**:
     1. Initial outreach introduces you and mentions the property
     2. AI adapts message based on lead type (preforeclosure vs probate)
     3. Handles inbound replies with contextual responses (instant via webhook)
     4. Follows proven 5-step script to schedule property visit
     5. Tags contact for human handoff when qualified
   - **Smart Features**:
     - Respects business hours automatically
     - Rate limited (2 seconds between messages)
     - Tracks conversation history to avoid duplicate messages
     - Automatically detects and tags replies
     - Instant webhook responses (no polling delay)
     - Same AI intelligence across all channels
   - **Technical Implementation**:
     - Dedicated Lambda function with IAM permissions for DynamoDB access
     - Lambda Function URL for public webhook access (no API Gateway needed)
     - Automatic OAuth token refresh via token manager
     - Shared conversation handler between Lambda and Next.js
     - Multi-channel message type detection (SMS=2, FB=3, IG=4, WhatsApp=5)
   - **Facebook/Instagram Setup**:
     - Connect Facebook Page and Instagram in GHL Settings
     - Create GHL workflow: Trigger "Customer Replied" → Filter: Facebook + Instagram
     - Webhook automatically handles all social DMs
   - **Testing**: Use `/api/v1/test-ai-response` endpoint to test AI responses without sending messages

11. **Outreach Queue System (Performance Optimization)**
   - **Purpose**: Replaces expensive GHL API searches with fast DynamoDB queries
   - **Benefits**:
     - 90% reduction in GHL API calls
     - Sub-second queries vs 2-3 second GHL searches
     - Better tracking and analytics
     - Costs pennies instead of dollars per operation
   - **7-Touch Cadence**: Each phone/email gets up to 7 touches over 28 days
     - Touch 1: Day 1 (immediate)
     - Touch 2: Day 5 (4 days later)
     - Touch 3: Day 9 (4 days later)
     - Touch 4: Day 13 (4 days later)
     - Touch 5: Day 17 (4 days later)
     - Touch 6: Day 21 (4 days later)
     - Touch 7: Day 25 (4 days later)
   - **Multi-Contact Support**: Contacts with multiple phones/emails get 7 touches per channel
     - Example: 2 phones + 2 emails = up to 28 total touches (7×4)
   - **How It Works**:
     1. Contacts automatically added to queue when synced to GHL with "ai outreach" tag
     2. Hourly agents query queue for PENDING contacts ready for next touch
     3. After sending, status stays PENDING (for follow-ups) or changes to REPLIED/BOUNCED/OPTED_OUT
     4. Webhooks update status on replies/bounces to stop further touches
   - **Queue Statuses**:
     - SMS: PENDING (ready for next touch) → REPLIED/FAILED/OPTED_OUT (stop)
     - Email: PENDING (ready for next touch) → REPLIED/BOUNCED/FAILED/OPTED_OUT (stop)
   - **Fallback**: If queue is empty or fails, agents fall back to GHL search (no breaking changes)
   - **Architecture**:
     - **Queue Manager**: `amplify/functions/shared/outreachQueue.ts`
     - **Schema**: `amplify/data/resource.ts` (OutreachQueue model)
     - **SMS Agent**: `amplify/functions/dailyOutreachAgent/handler.ts` (uses queue)
     - **Email Agent**: `amplify/functions/dailyEmailAgent/handler.ts` (uses queue)
     - **SMS Webhook**: `app/api/v1/ghl-webhook/route.ts` (updates queue on replies)
     - **Email Webhook**: `app/api/v1/ghl-email-webhook/route.ts` (updates queue on replies/bounces)
     - **Sync Handler**: `amplify/functions/manualGhlSync/integrations/gohighlevel.ts` (adds to queue)

12. **AI Email Messaging (Automated Email Outreach)**
   - **Daily Automation**: Runs every hour during business hours
   - **Business Hours**: Mon-Fri 9AM-7PM, Sat 9AM-12PM EST (Sunday closed)
   - **Target Contacts**: GHL contacts with "ai outreach" tag who haven't been emailed (email_attempt_counter = 0)
   - **Email Framework**: Uses AMMO method (Audience-Message-Method-Outcome)
   - **Email Structure (Hook-Relate-Bridge-Ask)**:
     - **Hook**: Professional salutation (name only, no "Hi/Hello")
     - **Relate**: Shows understanding of their probate/foreclosure situation
     - **Bridge**: Presents two clear options (cash offer vs retail listing)
     - **Ask**: Invites them to meet and discuss options
   - **Email Content**:
     - Subject: "Clarity on [Property Address]" (3-6 words)
     - Personalized with contact's name and property details
     - Bullet points for cash offer and retail value
     - Professional signature block with contact info
     - Includes specific dollar amounts when available
   - **Reply Handling**:
     - AI generates contextual responses to email replies
     - Continues conversation toward property visit
     - Detects handoff keywords and tags for human follow-up
   - **Tracking**:
     - Updates email_attempt_counter after sending
     - Records last_email_date
     - Prevents duplicate emails
   - **Smart Features**:
     - Respects business hours automatically
     - Rate limited (2 seconds between emails)
     - Multi-email support (sends to all addresses on contact)
     - Bounce detection and automatic tagging

13. **Email Campaigns (Manual Bulk Prospecting)**
   - **Manual Trigger**: Click "📧 Start Email Campaign" button in dashboard
   - **Target Contacts**: GHL contacts with "app:synced" tag who haven't been emailed
   - **Email Content**:
     - Personalized with contact's first name
     - Property address and estimated value
     - Cash offer amount (70% of Zestimate)
     - Two options: quick cash sale or full market listing
   - **Multi-Email Support**: Sends to all email addresses on contact (primary + email2 + email3)
   - **Tracking**:
     - Updates email_attempt_counter after sending
     - Records last_email_date
     - Prevents duplicate emails in future campaigns
   - **Reply Handling**:
     - Webhook automatically detects email replies

14. **Webhook Integrations (Real-Time GHL Sync)**
   - **Purpose**: Bi-directional sync between GHL and your app database
   - **Available Webhooks**:
     
     **1. Multi-Channel Message Webhook** (SMS, Facebook, Instagram, WhatsApp)
     - **URL**: `https://dpw6qwhfwor3hucpbsitt7skzq0itemx.lambda-url.us-east-1.on.aws/`
     - **Lambda**: `amplify/functions/ghlWebhookHandler/`
     - **Trigger**: GHL workflow automation on "Customer Replied"
     - **Purpose**: Instant AI responses to inbound messages across all channels
     - **What It Does**:
       - Detects message type (SMS=2, FB=3, IG=4, WhatsApp=5)
       - Generates AI response using conversation handler
       - Updates OutreachQueue status (PENDING → REPLIED)
       - Prevents further automated touches to replied contacts
     - **Setup**: Create GHL workflow with "Customer Replied" trigger → Send webhook POST
     
     **2. Email Reply/Bounce Webhook**
     - **URL**: `/api/v1/ghl-email-webhook` (Next.js API route)
     - **Trigger**: GHL workflow automation on email events
     - **Purpose**: Handle email replies and bounces
     - **What It Does**:
       - Detects email replies and generates AI responses
       - Detects bounced emails and stops future sends
       - Updates OutreachQueue status (PENDING → REPLIED/BOUNCED)
       - Tags contacts appropriately (email:replied, email:bounced)
     - **Setup**: Create GHL workflow with email event triggers → Send webhook POST
     
     **3. Field Sync Webhook** (Custom Field Updates)
     - **URL**: `https://xjiwzxgpa4nzpxdxjl5ib6xdom0gdtvx.lambda-url.us-east-1.on.aws/`
     - **Lambda**: `amplify/functions/ghlFieldSyncHandler/`
     - **Trigger**: GHL workflow automation on custom field updates
     - **Purpose**: Sync GHL custom field changes back to PropertyLead table
     - **What It Does**:
       - Receives updated contact data from GHL
       - Updates corresponding PropertyLead record in DynamoDB
       - Keeps local database in sync with GHL changes
       - Example: Call disposition "Spoke - Follow Up" syncs to lead status
     - **Setup**: Create GHL workflow with field update trigger → Send webhook POST with contact data
   
   - **Webhook Security**:
     - All webhooks use Function URL auth type NONE (public endpoints)
     - GHL cannot authenticate with AWS IAM
     - Security via request validation in handler code
     - Rate limiting and origin checking recommended
   
   - **Monitoring**:
     - All webhook calls logged in CloudWatch
     - View logs in AWS Console → Lambda → Function → Monitor
     - Search by contact ID or request ID for debugging
     - Average response time: 200-300ms

15. **AI Analysis**

## AI Agent System

### Overview

The AI messaging agent uses OpenAI GPT-4o-mini to handle multi-channel conversations with leads. It's designed to qualify prospects, present options, and schedule appointments while maintaining a natural, conversational tone.

### How the AI Works

**Architecture:**
- **Conversation Handler**: `amplify/functions/shared/conversationHandler.ts`
- **Token Manager**: `amplify/functions/shared/ghlTokenManager.ts`
- **Webhook Handler**: `amplify/functions/ghlWebhookHandler/` (instant responses)
- **Daily Agent**: `amplify/functions/dailyOutreachAgent/` (scheduled outreach)

**Conversation States:**
1. `NEW_LEAD` - Initial contact, determine intent
2. `ASK_INTENT` - Ask if buyer or seller
3. `SELLER_QUALIFICATION` - Get property address
4. `PROPERTY_VALUATION` - Show value and present options
5. `BUYER_QUALIFICATION` - Qualify buyer needs
6. `APPOINTMENT_BOOKING` - Schedule consultation
7. `QUALIFIED` - Ready for human handoff

### AI Training & Customization

**System Prompt Location:**
The AI's behavior is controlled by the system prompt in `conversationHandler.ts` (lines 190-320).

**Key Training Areas:**

1. **Compliance Rules** (Lines 195-210)
   - How AI identifies itself
   - When to hand off to human
   - Legal disclaimers
   - Already listed property protocol

2. **Conversation Style** (Lines 250-280)
   - Tone and personality
   - Message length (1-2 sentences)
   - Casual vs professional language
   - Question pacing

3. **Lead Qualification** (Lines 220-250)
   - Questions to ask
   - Information to gather
   - When to present offers
   - Appointment booking criteria

### Modifying AI Behavior

**To Change Conversation Flow:**

1. Edit the system prompt in `conversationHandler.ts`
2. Modify state-specific guidance sections
3. Update conversation rules
4. Test using `/api/v1/test-ai-response` endpoint

**Example: Make AI More Aggressive**
```typescript
// In conversationHandler.ts, update CONVERSATION RULES:
CONVERSATION RULES:
- Ask 2-3 questions per message (instead of 1)
- Push for appointment in every response
- Emphasize urgency and scarcity
```

**Example: Make AI More Casual**
```typescript
RESPONSE STYLE:
- Use emojis occasionally 😊
- More contractions (gonna, wanna)
- Shorter sentences
- More enthusiasm!
```

### Handling Special Situations

**Already Listed Properties:**
The AI automatically detects and exits gracefully when prospects mention:
- "Working with [realtor name]"
- "Already listed"
- "Have a realtor"

**Response:** "I understand you're already working with [name]. I respect that relationship and wish you the best!"

**Not Interested:**
AI tags contact with `conversation_ended` to stop follow-ups.

**Complex Questions:**
AI hands off to human: "Let me connect you with Jose directly for that."

### Available AI Tools

The AI can call these functions during conversations:

1. **validate_address** - Standardize addresses using Google Maps
2. **get_property_value** - Fetch Zestimate and property details
3. **check_availability** - Check calendar for open slots
4. **schedule_consultation** - Book appointments
5. **save_buyer_search** - Save buyer criteria in kvCORE
6. **end_conversation** - Exit and stop follow-ups

### Testing AI Responses

**Test Endpoint:** `POST /api/v1/test-ai-response`

```json
{
  "contactId": "GHL_CONTACT_ID",
  "message": "Yes, I'm interested in selling"
}
```

This tests AI responses without actually sending messages.

### Email Template Customization

**Location:** Profile → Email Templates

**Available Variables:**
- `{firstName}` - Contact's first name
- `{propertyAddress}` - Full property address
- `{zestimate}` - Formatted market value
- `{cashOffer}` - Formatted cash offer (70%)

**Template Types:**
1. **Probate Email Template** - For estate/probate leads
2. **Preforeclosure Email Template** - For foreclosure leads

**HTML Support:**
Templates automatically detect HTML tags. You can use:
- Full HTML formatting
- Inline styles
- Tables and images
- Custom layouts

**Plain Text Example:**
```
{firstName},

I noticed your property at {propertyAddress}...

Cash Offer: {cashOffer}
Market Value: {zestimate}

Best regards,
Jose
```

**HTML Example:**
```html
<div style="font-family: Arial;">
  <h2>Hello {firstName},</h2>
  <p>Property: <strong>{propertyAddress}</strong></p>
  <ul>
    <li>Cash: {cashOffer}</li>
    <li>Retail: {zestimate}</li>
  </ul>
</div>
```

### Best Practices

**DO:**
- ✅ Keep messages under 160 characters when possible
- ✅ Ask one question at a time
- ✅ Use natural, conversational language
- ✅ Respect business hours (Mon-Fri 9AM-7PM, Sat 9AM-12PM EST)
- ✅ Tag contacts appropriately for human handoff
- ✅ Test changes using the test endpoint

**DON'T:**
- ❌ Give legal or financial advice
- ❌ Make promises about property values
- ❌ Continue pursuing already listed properties
- ❌ Send messages outside business hours
- ❌ Use overly salesy language
- ❌ Ask multiple questions in one message

### Monitoring & Analytics

**CloudWatch Logs:**
- View AI conversation logs in AWS CloudWatch
- Search for specific contact IDs or error messages
- Monitor tool usage and response times

**GHL Custom Fields:**
- `ai_state` - Current conversation state
- `email_attempt_counter` - Number of emails sent
- `last_email_date` - Last email timestamp
- `call_attempt_counter` - Number of SMS sent
- `last_call_date` - Last SMS timestamp

### Troubleshooting

**AI Not Responding:**
1. Check GHL webhook configuration
2. Verify OAuth token is valid
3. Check CloudWatch logs for errors
4. Test using `/api/v1/test-ai-response`

**Wrong Responses:**
1. Review conversation history in GHL
2. Check system prompt for conflicting instructions
3. Verify contact has correct custom fields
4. Test with different message variations

**Rate Limiting:**
1. Check hourly/daily message counts
2. Verify 2-second delays between messages
3. Review GHL rate limit settings

14. **AI Analysis**
   - Use Chat feature for property insights
   - Get automated follow-up suggestions
   - Analyze market conditions and equity potential

### API Endpoints

The platform provides REST APIs and Lambda functions for integration:

**Next.js API Routes:**
- `POST /api/v1/upload-leads` - Upload lead data
- `POST /api/v1/analyze-property` - Property analysis
- `POST /api/v1/send-message-to-contact` - Send AI SMS outreach message (production)
- `POST /api/v1/send-email-to-contact` - Send AI email outreach message (production)
- `POST /api/v1/send-test-to-contact` - Send AI outreach message (testing)
- `POST /api/v1/start-email-campaign` - Start bulk email campaign
- `GET /api/v1/ghl-phone-numbers` - Get available GHL phone numbers
- `POST /api/v1/ghl-email-webhook` - Handle email replies and bounces (AI responses)
- `POST /api/v1/test-ai-response` - Test AI responses (no SMS sent)
- `GET /api/v1/oauth/callback` - GHL OAuth callback
- `POST /api/v1/oauth/refresh` - Refresh GHL OAuth token

**Lambda Function URLs:**
- `POST https://dpw6qwhfwor3hucpbsitt7skzq0itemx.lambda-url.us-east-1.on.aws/` - GHL webhook handler (instant AI responses for all channels)

### AI Messaging System

The platform includes an automated AI messaging system for multi-channel lead outreach:

**Features:**
- Automated daily outreach to new contacts
- Instant inbound message handling with AI responses via webhook
- Multi-channel support: SMS, Facebook Messenger, Instagram DMs, WhatsApp
- 5-step proven script for property visits
- Adapts to missing property data
- Human handoff for qualified leads

**Architecture:**
- `amplify/functions/shared/conversationHandler.ts` - AI message generation (multi-channel)
- `amplify/functions/shared/ghlTokenManager.ts` - OAuth token management (shared)
- `amplify/functions/ghlWebhookHandler/` - Dedicated Lambda for all message webhooks
- `amplify/functions/dailyOutreachAgent/` - Daily automation

**Why Lambda Function Instead of API Route:**
Next.js API routes don't have AWS credentials to access DynamoDB. Dedicated Lambda functions in `amplify/functions/` get explicit IAM permissions via `backend.ts`, enabling direct DynamoDB access for webhook handling.

**Supported Message Types:**
- Type 2: SMS
- Type 3: Facebook Messenger
- Type 4: Instagram DM
- Type 5: WhatsApp

**Documentation:**
- `AI_TESTING_GUIDE.md` - Testing procedures
- `AI_SYSTEM_WORKFLOW.md` - Complete system workflow

### Admin Features

**Admin Dashboard** (`/admin`)
- View all users and their subscription status
- Manage user groups (FREE, SYNC PLAN, AI OUTREACH PLAN, ADMINS)
- Add/remove users from groups
- Monitor system-wide usage statistics
- View validation errors for imported leads

**User Management:**
- Add users to ADMINS group for full access
- Assign PRO group for GHL sync features
- Assign AI_PLAN group for automated messaging
- Remove users from groups to revoke access

**GHL Settings Configuration:**
- Users configure their own phone/email in Profile → GHL Settings
- Each user selects from their available GHL phone numbers
- Campaign settings are per-user (multi-tenant support)
- Settings stored in GhlIntegration table

**System Monitoring:**
- CloudWatch logs for all Lambda functions
- GHL rate limiting tracked per user
- Email/SMS tracking via custom fields
- Webhook logs for reply/bounce events

**Configuration Files:**
- `amplify/data/resource.ts` - Database schema
- `amplify/backend.ts` - Lambda configuration
- Environment variables in Amplify Console

### Troubleshooting

**Common Issues:**

- **CSV Upload Fails**: Ensure required columns are present and properly formatted
- **Skip Trace No Results**: Verify address data is complete and accurate
- **GHL Sync Errors**: Check OAuth connection in Profile settings
- **Missing Credits**: Upgrade to PRO plan for skip tracing features
- **AI Not Responding**: Verify GHL webhook is configured and OAuth token is valid
- **Email Not Sending**: Verify email address is verified in GHL
- **SMS Wrong Number**: Check GHL Settings to select correct phone number

**Support:**
- Check application logs in AWS CloudWatch
- Review error messages in the dashboard notifications
- Test AI responses using `/api/v1/test-ai-response` endpoint
- Contact support for account-specific issues

## Development

### Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes (webhooks, OAuth, property analysis)
│   ├── components/        # React components
│   │   ├── dashboard/     # Dashboard components (table, filters)
│   │   ├── leadDetails/   # Lead detail page components
│   │   └── shared/        # Reusable UI components
│   └── utils/             # Utility functions
│       ├── aws/
│       │   ├── auth/      # Authentication utilities
│       │   │   ├── amplifyFrontEndUser.ts  # Client-side auth
│       │   │   └── amplifyServerUtils.server.ts  # Server-side auth
│       │   └── data/      # Data access layer
│       │       ├── lead.client.ts  # Client-side lead operations
│       │       ├── lead.server.ts  # Server-side lead operations
│       │       ├── frontEndClient.ts  # Amplify client for browser
│       │       └── pagination.ts  # Pagination utilities
│       ├── billing/       # Subscription management utilities
│       ├── bridge.server.ts  # Bridge API (Zestimate) integration
│       └── google.server.ts  # Address validation
├── amplify/               # AWS Amplify backend configuration
│   ├── auth/             # Cognito authentication
│   ├── data/             # GraphQL schema and resolvers
│   ├── functions/        # Lambda functions
│   │   ├── shared/       # Shared utilities
│   │   │   ├── ghlTokenManager.ts  # GHL OAuth token refresh
│   │   │   └── bridgeUtils.ts  # Property data API utilities
│   │   ├── skiptraceLeads/  # Bulk skip trace handler
│   │   └── manualGhlSync/   # GHL sync handler
│   └── storage/          # S3 storage configuration
└── components/           # Shared React components
```

### Code Organization

**Frontend Data Access** (`app/utils/aws/data/`)
- `lead.client.ts` - **Client-side** lead operations (React components)
  - `fetchLeads()` - Get all leads
  - `updateLead()` - Update a lead
  - `skipTraceLeads()` - Skip trace leads
  - `syncToGHL()` - Sync to GoHighLevel
  - `observeLeads()` - Real-time lead updates
- `lead.server.ts` - **Server-side** lead operations (API routes, Lambda)
  - Auto-detects Lambda vs API route context
  - Uses DynamoDB in Lambda, Amplify client in API routes
- `frontEndClient.ts` - Amplify client for browser operations
- `pagination.ts` - Automatic pagination for large datasets

**Authentication** (`app/utils/aws/auth/`)
- `amplifyFrontEndUser.ts` - Client-side auth utilities
- `amplifyServerUtils.server.ts` - Server-side auth utilities

**Property Data** (`app/utils/`)
- `bridge.server.ts` - Bridge API integration for Zestimate data
  - Address-based search with variations
  - Coordinate-based fallback search
  - Sorts by main house priority + newest timestamp
- `google.server.ts` - Google Maps address validation

**Business Logic** (`app/utils/billing/`)
- `subscriptionManager.ts` - Subscription lifecycle management

**Shared Functions** (`amplify/functions/shared/`)
- `ghlTokenManager.ts` - OAuth token refresh automation
- `bridgeUtils.ts` - Property data API utilities for Lambda

### Key Features

**Real-Time Updates**
- Dashboard uses `observeQuery` for automatic updates
- Manual refresh after bulk operations (skip trace, sync, etc.)
- No page reload needed - instant UI updates

**Automatic Token Refresh**
- GHL OAuth tokens auto-refresh before expiration
- Users stay connected without manual reconnection
- See `amplify/functions/shared/ghlTokenManager.ts`

**Subscription Management**
- Stripe webhooks handle payment events
- Automatic access revocation on payment failure
- Group-based authorization (PRO, AI_PLAN)
- See `app/utils/billing/subscriptionManager.ts`

**Bulk Skip Tracing**
- Processes up to 100 leads in single API call
- Parallel database updates for performance
- Saves all raw data (qualified + unqualified contacts)
- Phone number formatting: (XXX) XXX-XXXX

**Zestimate Refresh**
- Visual feedback (loading spinner, success checkmark)
- Coordinate-based fallback when address not found
- Matches Zillow's property selection logic
- Updates age counter immediately
- Uses standardized addresses for accuracy
- See `amplify/functions/skiptraceLeads/handler.ts`

**Validation Error Tracking**
- Invalid leads flagged for admin review
- Admin dashboard shows validation errors
- Prevents processing incomplete data

### Environment Variables

Required environment variables for local development (`.env.local`):

```env
# Google Maps (Address Validation)
GOOGLE_MAPS_API_KEY=your_google_maps_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key

# GoHighLevel Integration
GHL_CLIENT_ID=your_ghl_client_id
GHL_CLIENT_SECRET=your_ghl_client_secret

# Skip Tracing & Property Data Service
BRIDGE_API_KEY=your_bridge_key

# AI Services
OPENAI_API_KEY=your_openai_key
```

**Production Deployment:**

For production on AWS Amplify, environment variables are handled using the official AWS approach:

1. **Set in Amplify Console**: Go to your Amplify app → App Settings → Environment variables
2. **Add all required variables** (same names as above)
3. **Build process**: The `amplify.yml` uses `env | grep` to write variables to `.env.production`
4. **Runtime access**: API routes access them via `process.env.VARIABLE_NAME`

The build process automatically:
- Writes server-side variables (GHL_CLIENT_ID, API keys, etc.) to `.env.production`
- Writes all `NEXT_PUBLIC_` prefixed variables for client-side access
- Only includes variables that actually exist in the build environment

**Security Notes:**
- Never commit actual API keys to GitHub
- Server-side variables (without `NEXT_PUBLIC_`) remain secure and server-only
- Use `.env.example` as a template for other developers
- Amplify Console variables are encrypted and only available during build/runtime

### Local Development

```bash
# Install dependencies
npm install

# Start Amplify sandbox
npx ampx sandbox

# Run development server
npm run dev
```

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.