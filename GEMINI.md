# GEMINI.md - Workspace Rules & Instructions

## Workflow & User Approval Guidelines (Mandatory)

1. **User Approval Required Before Code Edits**:
   - **ALWAYS** explain clearly what changes you plan to make and why before editing any files or running commands that alter the codebase.
   - Wait for explicit user confirmation/approval before modifying files.

## Code Standards & Testing Guidelines

1. **Centralized Data Access Layer (DAL)**:
   - All database, auth, and user operations in server routes must use the centralized helper modules under `app/utils/aws/data/` (`lead.server.ts`, `userAccount.server.ts`, `ghlIntegration.server.ts`) instead of writing duplicate inline queries.
2. **Backend Shared Logic**:
   - Shared Lambda logic must be placed in `amplify/functions/shared/` (e.g. `dispositions.ts`, `outreachQueue.ts`, `ghlFieldProvisioner.ts`, `businessHours.ts`).
3. **Verification Routine**:
   - After modifying any backend files, always run strict backend type checking (`npx tsc --noEmit --strict ...`) and unit tests (`npm test`) to verify zero errors before declaring completion.

## Lead Response & Call Outcome Handling

1. **Terminal Disposition vs. Opt-Out**:
   - Responses indicating property status (e.g., *"not for sale"*, *"not selling"*, *"sold"*, *"already listed"*, *"wrong number"*) are **terminal business dispositions**.
   - These terminal outcomes **stop all automated AI outreach** in the app's internal queue (`queueStatus = 'DND'`), but they do **NOT** set `emailStatus = 'OPTED_OUT'` (which is reserved for legal DNC / unsubscribe requests).
   - These dispositions do **NOT** toggle the contact-level DND setting in GoHighLevel (GHL).

2. **Automatic Call Outcome Custom Field Updates**:
   - When an incoming text or email reply is received from a lead, automatically map their response to the exact matching choice for the **`Call Outcome`** custom field in GHL:
     - *"not for sale"*, *"not selling"*, *"not interested"* $\rightarrow$ **`Not Interested`**
     - *"sold"*, *"already sold"* $\rightarrow$ **`Sold Already`**
     - *"listed"*, *"realtor"*, *"agent"* $\rightarrow$ **`Listed With Realtor`**
     - *"wrong number"*, *"wrong person"* $\rightarrow$ **`Wrong Number / Disconnected / Invalid Number`**
     - *"DNC"*, *"do not call"*, *"unsubscribe"* $\rightarrow$ **`DNC`**

## Outreach Cadence & Compliance Rules

1. **Business Hours Enforcement**:
   - Automated outreach is strictly limited to **Mon–Fri 9 AM–7 PM EST** and **Sat 9 AM–12 PM EST**.
   - No automated outreach is permitted on Sundays.
2. **Cadence & Rate Limits**:
   - Cold email outreach uses a 7-touch cadence over 28 days (every 4 days).
   - Hourly email sending is capped at 50 emails per hour per integration with bounce circuit-breaker protection.

## AI Persona & Compliance Boundaries

1. **Identity & Representation**:
   - The AI operates on behalf of Jose Fernandez (RE/MAX Homeland Realtors).
   - Identify as an AI assistant only if directly asked ("Are you a bot?", "Is this automated?").
2. **No Legal or Financial Advice**:
   - Never provide tax, legal, or financial advice.
3. **Human Handoff**:
   - Complex questions, custom negotiations, or requests to speak to a real person must trigger an immediate handoff to Jose.
