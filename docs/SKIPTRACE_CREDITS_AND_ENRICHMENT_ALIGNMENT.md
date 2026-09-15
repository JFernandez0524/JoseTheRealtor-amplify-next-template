# Skip Trace Credit Resolution & Workflow Simplification

**Date**: September 14, 2026  
**Status**: Implemented & Verified

---

## 1. Executive Summary

A customer (`jcruz7589@yahoo.com`) reported two issues:
1. She purchased a $25 bundle for 250 skip tracing credits, but when attempting to skip trace leads from the lead details page, she received a "Skip Trace Complete" toast notification, yet the lead remained `PENDING` on the dashboard.
2. Confusion regarding whether to use Skip Trace vs. Property Enrichment for preforeclosure leads.

This document details the audit findings, the root causes, the code fixes implemented, and the strategic decision to standardize on **Skip Tracing** for all lead types.

---

## 2. Audit Findings & Credit Verification

### User Account Audit
* **Email**: `jcruz7589@yahoo.com`
* **Cognito Sub**: `84c8c418-b001-70b2-2b70-1d98fa16545c` (User Pool: `us-east-1_xD2qn9PAC`, Group: `PRO`)
* **Credits Purchased**: **250 credits** for $25.00
  * Purchased: `2026-09-14T13:54:40.839Z` (Stripe Webhook Request `ea7916f1-0669-4bce-9deb-1d534efeda49`)
* **Credits Used**: **0 credits**
  * Current Balance in DynamoDB (`UserAccount-ahlnflzdejd5jdrulwuqcuxm6i-NONE`): `credits = 250`
  * `totalSkipsPerformed = 0`
  * No BatchData API requests were made (the Lambda failed at the wallet check before calling BatchData).

---

## 3. Root Causes & Fixes

### A. Backend Owner ID Mismatch in Lambda (`skiptraceLeads/handler.ts`)
* **Problem**: In Amplify Gen 2, DynamoDB stores the `UserAccount.owner` attribute as a composite key (`sub::sub` or `sub::identityId`, e.g., `84c8c418-b001-70b2-2b70-1d98fa16545c::84c8c418-b001-70b2-2b70-1d98fa16545c`). The Lambda handler queried DynamoDB with exact equality: `#owner = :ownerId` where `:ownerId` was the bare Cognito `sub`. This resulted in `User account found: false`, defaulting credits to 0 and throwing `"Insufficient Credits: Need 1, have 0"`.
* **Fix**:
  1. Updated the DynamoDB scan filter in `amplify/functions/skiptraceLeads/handler.ts` to `#owner = :ownerId OR begins_with(#owner, :ownerIdPrefix)`.
  2. Added fallback matching by email if the owner ID match fails.
  3. Applied the same robust owner query in `amplify/functions/manualGhlSync/handler.ts` for GHL rate limiting and sync tracking.

### B. Frontend Error Swallowing (`LeadDetailClient.tsx`)
* **Problem**: `handleSkipTrace` bypassed the centralized DAL helper (`skipTraceLeads`) and called `client.mutations.skipTraceLeads` directly. AppSync returns `{ data: null, errors: [...] }` without throwing a JavaScript promise rejection. The function ignored `errors`, fetched the lead from DynamoDB (which was still `PENDING`), and showed a false success toast: *"Skip Trace Complete — Contact information has been updated"*.
* **Fix**:
  1. Routed skip tracing through `skipTraceLeads([lead.id])` from `app/utils/aws/data/lead.client.ts`, which verifies `errors` and throws when an error occurs.
  2. Added status-specific toast feedback (`COMPLETED`, `NO_MATCH`, `NO_QUALITY_CONTACTS`, `NOT_ELIGIBLE`).

---

## 4. UI Simplification: Skip Trace vs. Enrichment

### Rationale
* **Primary Objective**: Real estate agents want phone numbers and emails to contact homeowners.
* **Skip Trace**: Calls `https://api.batchdata.com/api/v1/property/skip-trace` for **1 credit ($0.10)** per match. Returns mobile phones, landlines, and verified emails for all lead types (Probate and Preforeclosure).
* **Property Enrichment**: Calls `https://api.batchdata.com/api/v1/property/lookup/all-attributes` for **3 credits ($0.30)** per match. Returns mortgage balances, open liens, equity %, and foreclosure details, but **no phone numbers or emails**.
* Having both options side-by-side on the dashboard caused confusion and risked users spending 3 credits without receiving contact numbers.

### Actions Taken
1. **Disabled "Enrich Leads" on Toolbar**:
   * In `app/components/dashboard/DashboardFilters.tsx`, the "🏦 Enrich Leads" button is hidden from the bulk action bar.
   * All backend enrichment routes (`/api/v1/enrich-leads`), processing logic (`enrichment.ts`), and reporting (`BatchDataJobsReport.tsx`) remain fully intact in the codebase.
2. **Standardized Confirmation Modal (`RouteExplanationModal.tsx`)**:
   * Updated the modal to evaluate the user's action (`action === 'skipTrace'`) rather than assuming preforeclosure leads must be enrichment.
   * Skip tracing now shows a clear **$0.10/lead (1 credit)** cost breakdown and contact lookup features for both Probate and Preforeclosure leads.
3. **Enabled Dashboard Skip Trace Button for All Lead Types (`DashboardFilters.tsx`)**:
   * Removed the restriction `(!selectedLeadType || selectedLeadType === 'PROBATE')` on the dashboard toolbar's "Skip Trace" button.
   * Selecting untraced preforeclosure leads now immediately exposes the "Skip Trace" button right on the dashboard, so users no longer have to open individual lead detail pages to skip trace.

---

## 5. How to Re-enable Enrichment in the Future

When ready to re-introduce property enrichment to users:
1. In `app/components/dashboard/DashboardFilters.tsx`, toggle the condition on the "Enrich Leads" button from `{false && ...}` to `{true && ...}` (or wire it to a user preference / role flag).
2. Consider introducing Enrichment on the **Lead Details page** as an "Unlock Equity & Mortgage Intel" card on individual qualified properties rather than a bulk cold-list action.
