# JoseTheRealtor - Real Estate Lead Management Platform

A comprehensive real estate lead management platform built with AWS Amplify Gen2 and Next.js 14. Streamline your property lead analysis, skip tracing, and CRM integration workflow.

## Features

- **Lead Management**: Import and analyze property leads (preforeclosure, probate)
- **AI Lead Scoring**: Intelligent prioritization with 0-100 scores based on equity, value, timeline, location, and contact availability
- **AI Insights Dashboard**: View top hottest leads, urgent attention items, and best ROI opportunities
- **AI SMS Bot**: Automated text conversations with leads using OpenAI, following proven 5-step script for property visits
- **Automated Email Campaigns**: Bulk prospecting emails with personalized property details, Zestimate values, and cash offers
- **Multi-Channel Outreach**: Coordinated SMS and email campaigns with automatic reply/bounce detection and tagging
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

10. **AI SMS Messaging (Automated Text Outreach)**
   - **Daily Automation**: Runs every day at 9 AM EST
   - **Target Contacts**: New GHL contacts with "AI Outreach" tag who haven't been messaged
   - **Conversation Flow**:
     1. Initial outreach introduces you and mentions the property
     2. AI adapts message based on lead type (preforeclosure vs probate)
     3. Handles inbound replies with contextual responses
     4. Follows proven 5-step script to schedule property visit
     5. Tags contact for human handoff when qualified
   - **Smart Features**:
     - Respects business hours (9 AM - 8 PM EST only)
     - Rate limited (2 seconds between messages)
     - Tracks conversation history to avoid duplicate messages
     - Automatically detects and tags replies
   - **Testing**: Use `/api/v1/test-ai-response` endpoint to test AI responses without sending SMS

11. **Email Campaigns (Bulk Prospecting)**
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
     - Tags contact with "email:replied"
     - Removes from future campaigns
   - **Bounce Protection**:
     - Detects bounced emails via webhook
     - Tags contact with "email:bounced"
     - Stops future emails to that address
   - **Rate Limiting**: 2 seconds between emails to prevent API throttling

12. **AI Analysis**
   - Use Chat feature for property insights
   - Get automated follow-up suggestions
   - Analyze market conditions and equity potential

### API Endpoints

The platform provides REST APIs for integration:

- `POST /api/v1/upload-leads` - Upload lead data
- `POST /api/v1/analyze-property` - Property analysis
- `POST /api/v1/send-message-to-contact` - Send AI outreach message (production)
- `POST /api/v1/send-test-to-contact` - Send AI outreach message (testing)
- `POST /api/v1/start-email-campaign` - Start bulk email campaign
- `GET /api/v1/ghl-phone-numbers` - Get available GHL phone numbers
- `POST /api/v1/ghl-email-webhook` - Handle email replies and bounces
- `POST /api/v1/test-ai-response` - Test AI responses (no SMS sent)
- `GET /api/v1/oauth/callback` - GHL OAuth callback
- `POST /api/v1/oauth/refresh` - Refresh GHL OAuth token
- `POST /api/v1/ghl-webhook` - Handle GHL webhooks

### AI Messaging System

The platform includes an automated AI messaging system for lead outreach:

**Features:**
- Automated daily outreach to new contacts
- Inbound message handling with AI responses
- 5-step proven script for property visits
- Adapts to missing property data
- Human handoff for qualified leads

**Architecture:**
- `app/utils/ai/conversationHandler.ts` - AI message generation
- `app/utils/aws/data/ghlIntegration.server.ts` - OAuth token management
- `app/api/v1/ghl-webhook/route.ts` - Inbound message handler
- `amplify/functions/dailyOutreachAgent/` - Daily automation

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