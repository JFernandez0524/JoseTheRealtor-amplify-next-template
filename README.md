# JoseTheRealtor - Real Estate Lead Management Platform

A comprehensive real estate lead management platform built with AWS Amplify Gen2 and Next.js 14. Streamline your property lead analysis, skip tracing, and CRM integration workflow.

## Features

- **Lead Management**: Import and analyze property leads (preforeclosure, probate)
- **Skip Tracing**: Pay-per-use contact lookup at $0.10 per skip
- **CRM Integration**: Seamless GoHighLevel synchronization with workflows
- **AI Assistant**: Claude 3.5 Sonnet for lead analysis and follow-ups
- **Address Validation**: Google Maps API integration for property verification
- **Zestimate Integration**: Automatic Zillow property valuation and market data
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

2. **Skip Trace Contacts**
   - Select leads from dashboard
   - Click "Skip Trace" to find contact information
   - Review discovered phone numbers and emails

3. **CRM Integration**
   - Connect GoHighLevel account in Profile settings (connection persists across sessions)
   - Select qualified leads for sync
   - Leads automatically appear in your GHL pipeline with Zestimate data

4. **AI Analysis**
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
├── amplify/               # AWS Amplify backend configuration
│   ├── auth/             # Cognito authentication
│   ├── data/             # GraphQL schema and resolvers
│   ├── functions/        # Lambda functions
│   └── storage/          # S3 storage configuration
├── components/           # React components
└── utils/               # Utility functions
```

### Environment Variables

Required environment variables for local development (`.env.local`):

```env
# Google Maps (Address Validation)
GOOGLE_MAPS_API_KEY=your_google_maps_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key

# GoHighLevel Integration
GHL_CLIENT_ID=your_ghl_client_id
GHL_CLIENT_SECRET=your_ghl_client_secret

# Skip Tracing Service (also provides Zestimate data)
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