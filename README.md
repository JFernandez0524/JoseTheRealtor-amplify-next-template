# JoseTheRealtor - Real Estate Lead Management Platform

A comprehensive real estate lead management platform built with AWS Amplify Gen2 and Next.js 14. Streamline your property lead analysis, skip tracing, and CRM integration workflow.

## Features

- **Lead Management**: Import and analyze property leads (preforeclosure, probate)
- **AI Lead Scoring**: Intelligent prioritization with 0-100 scores based on equity, value, timeline, location, and contact availability
- **AI Insights Dashboard**: View top hottest leads, urgent attention items, and best ROI opportunities
- **Property Enrichment (Preforeclosure)**: Real equity data, mortgage balances, and quality contact info via BatchData ($0.29/lead)
- **Skip Tracing**: Pay-per-use contact lookup at $0.10 per skip (probate leads)
- **Bulk Operations**: Update multiple lead statuses, skip trace, enrich, calculate AI scores, and sync in one click
- **Smart Filtering**: Filter by manual status, AI priority, owner occupied, high equity, skip trace date, and property type
- **Property Valuation**: Real-time Zestimate data with refresh capability and age indicators
- **CRM Integration**: Seamless GoHighLevel synchronization with rate limiting protection
- **Direct Mail Automation**: Automatic Zestimate and cash offer calculation for GHL Click2Mail campaigns
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

8. **CRM Integration & Direct Mail**
   - Connect GoHighLevel account in Profile settings (connection persists across sessions)
   - Select qualified leads for sync
   - Rate limiting prevents API blocks (100/hour, 1000/day limits enforced)
   - Leads automatically appear in your GHL pipeline with:
     - Zestimate data (full market value for listing option)
     - Cash offer (70% of Zestimate for as-is purchase option)
     - Appropriate tags for direct mail or phone campaigns
   - GHL automations handle Click2Mail integration with mail merge

9. **AI Analysis**
   - Use Chat feature for property insights
   - Get automated follow-up suggestions
   - Analyze market conditions and equity potential

### API Endpoints

The platform provides REST APIs for integration:

- `POST /api/v1/upload-leads` - Upload lead data
- `POST /api/v1/analyze-property` - Property analysis
- `GET /api/v1/oauth/ghl/callback` - GHL OAuth callback
- `POST /api/v1/ghl-webhook` - Handle GHL webhooks

### Troubleshooting

**Common Issues:**

- **CSV Upload Fails**: Ensure required columns are present and properly formatted
- **Skip Trace No Results**: Verify address data is complete and accurate
- **GHL Sync Errors**: Check OAuth connection in Profile settings
- **Missing Credits**: Upgrade to PRO plan for skip tracing features

**Support:**
- Check application logs in AWS CloudWatch
- Review error messages in the dashboard notifications
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