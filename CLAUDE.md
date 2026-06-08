# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Next.js dev server
npm run build      # Production build
npm run lint       # ESLint check
npm run fix-syncs  # Fix failed GHL sync jobs (runs tsx scripts/fix-failed-syncs.ts)
```

No test suite is configured.

## Architecture Overview

This is a **real estate lead management and automated outreach platform** built with Next.js 14 (App Router) + AWS Amplify Gen2. It syncs leads to GoHighLevel (GHL) CRM and automates AI-driven multi-channel outreach.

### Backend Stack

- **Database:** DynamoDB via AWS Amplify Data Client (GraphQL-based). Schema is defined in `amplify/data/resource.ts`.
- **Auth:** AWS Cognito with Google OAuth only. User groups: `ADMINS`, `PRO` (sync plan), `AI_PLAN` (AI outreach plan), `FREE`.
- **Lambda Functions:** 14 functions in `amplify/functions/` — these are the core business logic for async processing (CSV uploads, GHL sync, AI outreach agents, webhooks).
- **Storage:** S3 for CSV lead file uploads (triggers `uploadCsvHandler` Lambda).

### Key Data Models

- `PropertyLead` — Core entity with lead type enum `PREFORECLOSURE | PROBATE`, GHL sync status, enrichment data
- `GhlIntegration` — Per-user GHL OAuth tokens, rate limit counters, campaign config
- `OutreachQueue` — Queue entries with SMS/email status GSIs (reduces GHL API calls by ~90%)
- `WebhookIdempotency` — Dedup table with 24h TTL to prevent duplicate webhook processing

### Data Access Pattern

Two files handle DynamoDB access per entity:
- `app/utils/aws/lead.client.ts` — Client-side (React components, uses Amplify Data Client)
- `app/utils/aws/lead.server.ts` — Server-side (API routes, uses AWS SDK directly)

Lambdas use the AWS SDK directly (`DynamoDBDocumentClient`), not the Amplify client.

### API Routes (`app/api/v1/`)

Next.js API routes handle synchronous operations (GHL OAuth, Stripe billing, enrichment calls). Async/long-running work is done in Lambda functions. Notable:
- `/api/v1/oauth/callback` — GHL OAuth code → token exchange, saves to `GhlIntegration`
- `/api/v1/billing/create-checkout` and `/buy-credits` — Stripe checkout session creation
- `/api/v1/ghl-campaign-webhook` — Proxies to `ghlWebhookHandler` Lambda Function URL

### Lambda Function URLs (Webhooks)

Several Lambda functions are exposed via Function URLs (not API Gateway):
- `ghlWebhookHandler` — GHL "Customer Replied" events → AI response generation
- `thanksIoWebhookHandler` — Direct mail delivery tracking
- `ghlFieldSyncHandler` — Syncs call dispositions across related contacts
- `facebookWebhookHandler` — Facebook/Instagram Messenger integration

### AI/LLM Usage

- **AWS Bedrock (Claude 3.5 Sonnet)** — Conversation analysis in `aiFollowUpAgent` Lambda
- **OpenAI GPT-4o-mini** — SMS and email content generation in outreach agents

### GHL Integration

GHL (GoHighLevel) is the CRM backbone. Key patterns:
- OAuth tokens stored in `GhlIntegration` table, auto-refreshed via `ghlTokenManager.ts`
- Rate limiting tracked in `GhlIntegration` (`dailyMessageCount`, `hourlyMessageCount`)
- Outreach uses a **7-touch cadence over 28 days** (every 4 days)
- Business hours enforced: Mon–Fri 9AM–7PM EST, Sat 9AM–12PM EST, no Sunday outreach
- Tags drive state: `app:synced`, `ai outreach`, `conversation:active`, `conversation:manual`, etc.

### Route Protection

`middleware.ts` guards all `/(protected)/*` routes using Cognito JWT tokens. Public routes: `/login`, `/signup`, `/pricing`, `/about`, `/contact`, `/docs`.

### Environment Variables

- `AMPLIFY_DATA_*_TABLE_NAME` — Auto-injected by Amplify for each DynamoDB table
- `NEXT_PUBLIC_*` — Client-accessible variables
- `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET` — GHL OAuth app credentials
- `BRIDGE_API_KEY` — Property valuation (Zestimate)
- `OPENAI_API_KEY` — SMS/email content generation
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Payment processing
