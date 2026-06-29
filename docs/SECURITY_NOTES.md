# Security Notes

Developer-facing invariants. Read before changing entitlement, plan, or billing logic.

## Plan / entitlement integrity — GHL custom fields are NOT a source of truth

A user's plan and access are governed **exclusively by Cognito group membership** in the
signed JWT (`ADMINS`, `PRO`, `AI_PLAN`, `FREE`):

- Server / Lambda: groups come from `identity.claims['cognito:groups']`
  (e.g. [manualGhlSync/handler.ts:235](../amplify/functions/manualGhlSync/handler.ts#L235)).
- Client: [AccessContext.tsx:104-107](../app/context/AccessContext.tsx#L104) reads the same
  claim.
- Groups are added/removed **server-side, only by the Stripe billing flow**
  ([subscriptionManager.ts](../app/utils/billing/subscriptionManager.ts) —
  `grantSubscriptionAccess` / `revokeSubscriptionAccess`).

The GHL contact custom fields **`App Plan` (`app_plan`)** and **`App Account Status`
(`app_account_status`)** are **write-only display mirrors** — the app *pushes* them out
during sync ([gohighlevel.ts:96-97](../amplify/functions/manualGhlSync/integrations/gohighlevel.ts#L96))
and **never reads them back** to make an access decision. (The only read-back snippet, in
`conversationHandler.ts`, is intentionally commented out.)

**Consequence:** a user editing `App Plan`/`App Account Status` in their own GHL account
**cannot** change their app entitlements or billing. It only changes the displayed value.

### Rules to keep this true
1. **Never read `app_plan` / `app_account_status` from GHL as an entitlement input.** Plan
   decisions must come from Cognito groups (or the billing record). Do not re-enable the
   commented-out read in `conversationHandler.ts`.
2. **GHL-side workflows that gate on plan** should branch on **app-applied tags** (e.g.
   `app:ai-enabled`), which the app sets from Cognito groups — not on the editable field.
   Even so, GHL-side branching only affects the user's own automations, never app billing.
3. AI outreach is gated by the app-controlled **OutreachQueue** (a contact is enrolled only
   when the app applies the `ai outreach` tag during sync, which requires `AI_PLAN`/`ADMINS`).
   Manually adding the `ai outreach` tag in GHL does **not** enroll a contact in app outreach.

## Known TODO (not a current vulnerability)
`app_account_status` is currently hardcoded to `'active'`
([gohighlevel.ts:29](../amplify/functions/manualGhlSync/integrations/gohighlevel.ts#L29)).
When real billing-status gating is added, source it from the billing record / Cognito,
**not** from the GHL field.
