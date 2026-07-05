# Lead Lifecycle & GHL Sync — How the App Works

This is the authoritative reference for how a lead flows from import → skip trace → GoHighLevel (GHL),
what data we capture, how we sanitize it and stay compliant, how we pick only the **best** contact
info to sync, and what every tag and custom field we write actually does (and why it matters to the
dialer and outreach automations).

Audience: developers and power users configuring GHL workflows. A user-friendly summary lives in the
in-app **User Guide** (`/docs`).

---

## 1. The pipeline at a glance

```
CSV / manual upload → PropertyLead (DynamoDB)
        ↓ skip trace (BatchData)
capture phones + emails + mailing address + owner name
        ↓ compliance + quality filters   (DNC, mobile-only, score ≥90, Debounce)
        ↓ rank best-first                 (phones by score, emails by Debounce quality)
sync to GHL (manualGhlSync)               (1 Phone = 1 Contact; best email = primary)
        ↓ provision fields + tags         (ghlFieldProvisioner)
GHL dialer / AI email / direct-mail automations run off tags + custom fields
        ↑ field-sync webhook              (Call Outcome, counters, AI State → back to the app)
```

Key source files:
- `amplify/functions/skiptraceLeads/handler.ts` — skip trace + capture + quality filters
- `amplify/functions/shared/sanitize.ts` — `sanitizePhone`, `rankMobilePhones`
- `amplify/functions/shared/emailValidator.ts` — `filterValidEmails`, `debounceQualityRank`
- `amplify/functions/manualGhlSync/integrations/gohighlevel.ts` — GHL contact build + tag logic
- `amplify/functions/shared/ghlFieldProvisioner.ts` — the canonical field + tag definitions
- `amplify/functions/shared/outreachQueue.ts` — email cadence queue (one row per contact)
- `amplify/functions/ghlFieldSyncHandler/handler.ts` — GHL → app webhook (dispositions, counters)

---

## 2. Skip tracing — what we capture

Skip tracing calls **BatchData** for each selected lead. From the returned person we capture:

| Data | Source | Notes |
|---|---|---|
| **Cell phones** | `person.phoneNumbers` | Only **mobiles** kept (see filters below). Landlines are dropped. |
| **Emails** | `person.emails` | Only Debounce-deliverable kept (see §3). |
| **Mailing address** | `person.mailingAddress` → fallback `property.owner.mailingAddress` | Used for direct mail. |
| **Owner name** | `person.name` | Fills first/last when missing (non-probate). |

Leads marked **SOLD** or **SKIP** are excluded from skip tracing to avoid wasting credits. A skip trace
that finds no qualifying phone or email is stored as `NO_QUALITY_CONTACTS` (still valid — routed to
direct mail).

---

## 3. Compliance & quality filtering (why we drop data)

We deliberately **discard** low-quality or non-compliant contact info at ingest, to protect the dialer
and sender reputation and to respect consumer choice:

- **DNC (Do Not Call) is filtered out.** Phones flagged `dnc` by BatchData are never captured
  (`skiptraceLeads/handler.ts`). Leads/contacts tagged `dnc` / `not_interested` / `do_not_call` are
  excluded from the dialer campaign (see `isCallable`, §6).
- **Mobiles only, score ≥ 90.** We keep only `type === 'Mobile'` numbers with a BatchData quality
  `score >= 90`. Landlines and low-confidence numbers are dropped — the AI/dialer only ever works
  high-quality cell numbers.
- **Emails are Debounce-validated.** Every candidate email runs through Debounce.io; we keep only
  `send_transactional === "1"` (safe to send) addresses (`filterValidEmails`). Invalid/undeliverable
  addresses are removed at ingest to keep bounce rates low.
- **One best email per contact.** We email the single best address only (see §4). Emailing every address
  a person has 2–3×'d volume and bounces — a direct cause of prior sending suspensions.
- **Business hours are enforced** for automated email (Mon–Fri 9a–7p, Sat 9a–12p, no Sunday;
  `shared/businessHours.ts`).
- **Opt-out is honored end-to-end.** An unsubscribe click or a terminal **Call Outcome** (e.g. "Listed
  With Realtor", "DNC", "Not Interested", "Sold Already") stops outreach: it sets the contact's email
  **DND** in GHL and marks the outreach queue `OPTED_OUT`. Enforced at send time regardless of workflow
  state (`send-email-to-contact` guard + `dispositions.ts`).

---

## 4. Best-results selection — sync only the best

BatchData/Debounce return **multiple** phones and emails in arbitrary order. We rank them so the
**primary** contact info the dialer/outreach uses is the highest quality:

- **Phones — `rankMobilePhones()` (`shared/sanitize.ts`).** Keeps qualifying mobiles (Mobile, score ≥ 90,
  not DNC) and sorts them **highest-score first**. `lead.phones[0]` becomes the GHL **primary phone**.
  (Ranking only — we still create a contact per good mobile so the dialer can try them all; see §5.)
- **Emails — `filterValidEmails()` + `debounceQualityRank()` (`shared/emailValidator.ts`).** Keeps
  Debounce-safe emails and sorts them **best-first** (Deliverable > Accept-All > Role > unknown).
  `emails[0]` becomes the GHL **primary email** and the single address AI outreach uses.

Secondary phones/emails are still stored (in `Phone 2..5` / `Email 2..3` custom fields) for reference,
but only the best drives automation.

---

## 5. GHL sync — "1 Phone = 1 Contact"

`manualGhlSync` writes leads to GHL using a deliberate **one-contact-per-phone** model so the dialer can
work each number as its own contact:

- A lead with N qualifying mobiles → N GHL contacts. The first (best) phone is the **primary**
  (`Primary_Contact`); secondaries get `(2)`, `(3)`… appended to the last name and are tagged
  `Multi-Phone-Lead`.
- The **best email** attaches to the primary contact only (avoids duplicate emailing). Secondary emails
  live in `Email 2` / `Email 3`.
- Leads with no phone (email-only or `NO_QUALITY_CONTACTS`) become a single direct-mail / digital contact.

On first connect (and lazily on first sync), `ghlFieldProvisioner` creates all custom fields and system
tags in the user's GHL sub-account so tag-triggered workflows resolve immediately.

---

## 6. Dialer & outreach automations — how tags drive routing

The app **writes tags/fields**; the user's **GHL workflows** act on them. The important control tags:

- **`App:Synced`** — every synced contact. The GHL dialer/routing workflows key off this tag.
- **`ai outreach`** — added only to skip-traced contacts **with an email**, for AI-plan users. This is the
  master switch for automated AI **email** outreach (SMS is not automated). **Remove it to stop all AI
  automation** for that contact.
- **`isCallable` routing** (a contact is dialer-eligible when it has a phone **and** skip trace is
  `COMPLETED` **and** it is not `DNC`/`Not_Interested`/`Do_Not_Call`):
  - Callable → enters the dialer campaign (via `App:Synced` routing).
  - Not callable but has a phone, or no phone → routed to **`Direct-Mail-Only`** (property value
    $300k–$850k) or **`Digital-Only`** (outside that range).
- **`Thanks_IO_Eligible` + `Primary_Contact`** — the one contact eligible for the direct-mail (Thanks.io)
  7-touch cadence.
- **`App:AI-Enabled`** (AI plan) / **`App:Billing-Hold`** (past-due → outreach paused).

**Call dispositions feed back into the app.** When the dialer sets a contact's **Call Outcome** custom
field, the GHL workflow *"Helper: Sync Custom Fields to App"* posts it to `ghlFieldSyncHandler`, which
updates the app and — for terminal outcomes — stops email outreach. As a backstop, the app also re-checks
the live Call Outcome at email send time and refuses/opts-out on a terminal value, so compliance never
depends solely on the workflow. See `dispositions.ts` for the STOP/ENGAGED/NONE mapping.

---

## 7. Tag reference (complete)

All tags below are pre-created on connect (`SYSTEM_TAGS` in `ghlFieldProvisioner.ts`). GHL stores tags
lowercase. Dynamic tags (`ended_reason:{reason}`, `mail:touch{n}` beyond 7) auto-create when applied.

### Sync-time (written by `manualGhlSync`)
| Tag | Meaning / why it matters |
|---|---|
| `app:synced` | Contact came from the app. Dialer/routing workflows trigger on this. |
| `app:ai-enabled` | User is on the AI Outreach plan. |
| `app:billing-hold` | Account past-due → automations should pause. |
| `data:skiptraced` | Phone/email came from skip trace (vs original upload). |
| `data:originalupload` | Phone was in the original CSV upload. |
| `ai outreach` | Master switch for AI **email** outreach (skip-traced + has email + AI plan). Remove to stop AI. |
| `primary_contact` | The primary contact record for a multi-phone lead. |
| `multi-phone-lead` | Lead has 2+ phones → multiple contacts created. |
| `direct-mail-only` | Routed to mail only (property $300k–$850k, no callable phone). |
| `digital-only` | No direct mail (value outside $300k–$850k). |
| `thanks_io_eligible` | The one contact eligible for the Thanks.io direct-mail cadence. |

### Conversation / AI outreach (written by the AI + webhooks)
| Tag | Meaning |
|---|---|
| `conversation:active` | AI conversation in progress. |
| `conversation:manual` | Human agent replied → AI paused (auto-removed after ~3 days idle). |
| `ready-for-human-contact` | 🔥 Hot — AI says the lead is ready to talk. Act now. |
| `conversation_ended` | AI conversation complete; no further auto follow-ups. |
| `not_for_sale` / `wrong_contact` | Lead said not for sale / wrong person reached. |
| `high-engagement` | Strong engagement signal (e.g. QR scan). |
| `data_error:wrong_property` / `data_error:wrong_person` / `data_error:unclear` / `data_error:persistent_dispute` | Lead disputed property/identity during the AI conversation. |
| `sentiment:positive` / `neutral` / `frustrated` / `urgent` / `disengaging` | AI-scored conversation sentiment. |
| `needs_review` | Needs a human look (often with a wrong_* tag). |

### Email tracking
| Tag | Meaning |
|---|---|
| `email:replied` | Contact replied to an email. |
| `email:bounced` | Address bounced → no more emails to it. |
| `email:wrong_address` | Address confirmed to belong to the wrong person. |

### Direct mail (Thanks.io webhook)
| Tag | Meaning |
|---|---|
| `mail:delivered` | A mail piece was delivered. |
| `mail:touch1..7` | Nth mail piece delivered → move to the "Touch N - Delivered" stage. |
| `mail:scanned` | 🔥 QR code scanned — hot lead; move to Engaged and call. |

### Suppression / DNC
| Tag | Meaning |
|---|---|
| `dnc` / `do_not_call` / `not_interested` | Suppression labels; exclude from the dialer campaign. |

---

## 8. Custom field reference (complete)

Contact fields (`CONTACT_FIELDS` in `ghlFieldProvisioner.ts`). These carry the property/lead data the
outreach copy and workflows reference, plus the counters/state the app and GHL sync back and forth.

**Property & lead data:** `Property Address`, `Property City`, `Property State`, `Property Zip`,
`property_county`, `Mailing Address`/`City`/`State`/`Zipcode`, `Zestimate`, `cash offer` (70% of
Zestimate), `Zillow Link`, `Lead Type` (Probate/Preforeclosure/Sell As Is/General Inquiry),
`Contact Type` (Phone Contact/Direct Mail/landing pages), `Property Tier` (luxury/mid_range/entry_level).

**Extra contact info:** `Phone 2..5`, `Email 2`, `Email 3` — secondary numbers/addresses (the best ones
are the GHL primary phone/email; these are backups/reference).

**Outreach counters & dates (synced both ways):** `Call Attempt or Text Counter`, `email attempt counter`,
`Mail Sent Count`, `QR Scan Count`, `Last Call Date`, `last email date`, `Last Mail Date`,
`Mail Delivery Date`, `Mail Sent With Thanks`.

**State & control:** `SkipTraceStatus` (COMPLETED/NO_MATCH/FAILED/NO_QUALITY_CONTACTS/PENDING),
`Listing Status` (off market/active/sold/…/door knock), `AI State` (not_started/running/paused/handoff),
`Conversation Sentiment`, `App Plan` (SYNC/AI), `App Account Status` (active/past_due/canceled),
`App User ID`, `App Lead ID`, `Lead Source Id`.

**`Call Outcome`** (the dialer disposition — drives the stop/engage logic): `No Answer`,
`Left Voicemail`, `Spoke - Follow Up`, `Timeline / Not Ready Yet`, `Appointment Set`, `Not Interested`,
`DNC`, `Listed With Realtor`, `Sold Already`, `Wrong Number / Disconnected / Invalid Number`,
`DEAD / Max Attempts`. Terminal values (Not Interested, DNC, Listed With Realtor, Sold Already, wrong
number) → **STOP outreach + email DND**; `Appointment Set` → **pause cold email (engaged)**; the rest
leave the cadence running. Mapping lives in `dispositions.ts`.

Opportunity field (`OPPORTUNITY_FIELDS`): **`Disposition`** — pipeline-level outcome
(Unanswered/Unreachable, Price Too High, Not Interested, Sold, Listed / For Sale, Wrong Number,
Follow Up, Voicemail, Skiptrace Failed, Direct Mail Campaign).

---

## 9. Notes & guarantees

- **One outreach-queue row per contact** (`${userId}_${contactId}`), using the best email. This keeps the
  every-4-day, 7-touch email cadence correct and ensures a stop/unsubscribe reliably halts the contact.
- **Multi-tenant safe:** webhooks resolve the owning account from our own records before acting; a
  contact is never attributed to the wrong tenant (`shared/tenantResolver.ts`).
- **Provisioning is idempotent:** fields/tags are created only if missing, so re-syncs and re-connects are
  safe.
