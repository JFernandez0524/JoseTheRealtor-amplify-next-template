# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code Standards (read first — applies to every change)

These are non-negotiable for all work in this repo:

- **Keep it clean.** Prefer small, single-responsibility functions and clear names over cleverness. Match the style, naming, and structure of the surrounding code. Remove dead/commented-out code rather than leaving it behind.
- **Document thoroughly.** Every exported function, API route, and Lambda handler gets a doc block explaining what it does, its inputs/outputs, and who calls it (follow the existing `/** ... */` blocks in `app/api/v1/**/route.ts` and `amplify/functions/shared/**`). Use inline comments to explain *why*, not *what*. Update the doc block whenever you change behavior.
- **Be modular — no repeated code (DRY).** Before writing new logic, search for an existing helper and reuse it. If the same logic appears twice, extract it into a shared module:
  - Backend/Lambda shared logic → `amplify/functions/shared/` (e.g. `outreachQueue.ts`, `ghlFieldProvisioner.ts`, `dispositions.ts`).
  - Frontend/server-route logic → `app/utils/**` (e.g. `app/utils/leadValidation.ts` is shared by the client form and the API route).
  - One source of truth: client and server must call the *same* helper so they can't drift.
- **Extract pure logic and test it.** Pull pure functions out of handlers/components into shared modules and add Vitest coverage in `__tests__/shared/` (e.g. `isTerminalDisposition`, `formatPhoneE164`, `tagsToCreate`).
- **Verify types correctly.** The root `tsc`/`tsconfig.json` does **not** type-check `amplify/functions/**` (Amplify bundles the backend with its own strict config). After changing backend code, run a strict check on the changed files, e.g.:
  `npx tsc --noEmit --strict --skipLibCheck --moduleResolution bundler --module es2022 --target es2022 --esModuleInterop <changed backend files>`
  and run `npm test` before committing.

## Commands

```bash
npm run dev        # Start Next.js dev server
npm run build      # Production build
npm run lint       # ESLint check
npm run fix-syncs  # Fix failed GHL sync jobs (runs tsx scripts/fix-failed-syncs.ts)
npm test           # Run unit tests (Vitest)
npm run test:watch # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

Tests live in `__tests__/shared/` and cover pure utility functions in `amplify/functions/shared/`.
Add new tests there when adding logic to shared utilities. Avoid testing Lambda handlers that require AWS SDK mocks.

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
