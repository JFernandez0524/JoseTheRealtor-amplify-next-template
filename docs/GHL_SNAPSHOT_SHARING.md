# Sharing Lead Manager Workflows with New Users (GHL Snapshot)

This guide explains how to package the Lead Manager GHL setup (pipeline + workflows)
into a **snapshot** so every new user gets a working account, and how a new user
loads it.

> **Who can do this:** Creating a snapshot and a shareable link is an **agency-level**
> action in GHL. A sub-account user **cannot** create one. This must be done by the
> **agency owner** of the working sub-account. (GHL has no API to create workflows,
> so this can't be automated from the app.) This is a one-time setup; the resulting
> **shareable link** then works for any new user, even under a different agency.

---

## Why a snapshot works cleanly for this app

The Lead Manager backend is multi-tenant with a **single shared backend**, so almost
nothing in a workflow is account-specific:

- **Webhook URLs are global.** Every account posts to the same Lambda URLs (below).
  The app identifies the tenant from the contact in the payload, so the URLs need no
  per-account changes.
- **No per-account field IDs in workflows.** Workflows reference custom fields by
  name/merge tag. Inbound webhooks read GHL's standard payload by field **display
  name**; outbound writes resolve each tenant's field IDs at runtime. (If any webhook
  action still has hard-coded "custom data" field-ID rows, delete them — the standard
  payload already carries every field by name.)
- **Custom fields auto-map.** The app creates any missing custom fields by name on the
  user's first sync, reusing whatever the snapshot already created — no duplicates.

---

## Global webhook URLs (must be present in the snapshot's workflows)

| Webhook | URL | Used by |
|---|---|---|
| Multi-Channel Message (Customer Replied: SMS/FB/IG/WhatsApp) | `https://dpw6qwhfwor3hucpbsitt7skzq0itemx.lambda-url.us-east-1.on.aws/` | AI reply handler |
| Field Sync (Custom Field Updated incl. Call Outcome) | `https://xjiwzxgpa4nzpxdxjl5ib6xdom0gdtvx.lambda-url.us-east-1.on.aws/` | Field sync + **disposition stop** |
| Thanks.io Direct Mail (delivery + QR scans) — **optional, mail add-on only** | `https://turhumn37zo2ksb5pfckwbyi7m0hssnq.lambda-url.us-east-1.on.aws/` | Mail tracking |

---

## What the snapshot must contain

### 1. Pipeline — `Lead Manager`
Stages, in order: New Lead → Attempting Contact → Contact Made → Appointment Set →
Offer Made → Under Contract → Closed → Not Interested → Dead.

### 2. Workflows

> **Direct mail is optional.** The workflows below are split into a **Core bundle**
> (every user) and an **Optional: Direct Mail add-on** (only users who run ThanksIO
> direct mail). The app always *tags* mail-eligible contacts, but those tags are inert
> without the add-on — so a snapshot for a non-mail user can safely omit the add-on.

#### Core bundle (always include)

**Helper / sync**
- **Helper: Sync Custom Fields to App** — triggers: Contact Changed on Call Attempt or
  Text Counter, email attempt counter, Last Call Date, AI State, Mail Sent Count, **Call
  Outcome**. Action: Send Webhook (POST) to the **Field Sync** URL. *Leave the custom-data
  section empty* — the standard payload carries everything.
  *(This single webhook is also the app's source of disposition events: on a Call Outcome
  change it sends the full payload, and the field-sync handler stops/pauses AI email
  outreach on terminal/engaged dispositions — see
  [GHL_DISPOSITION_WEBHOOK.md](GHL_DISPOSITION_WEBHOOK.md).)*
  > **One webhook per Call Outcome change.** This is the **only** workflow that should POST
  > to the Field Sync URL. Do **not** add a Send Webhook action to the disposition/pipeline
  > workflow below — that would double-fire the handler (harmless but redundant). Keep this
  > workflow **Published** with its `Call Outcome` trigger; it is the single app notifier.

**Intake router** (trigger: tag added = `app:synced`)
- Create/Update Opportunity → check valid phone →
  - **CALL branch (core):** add to dialer loop. *(No "Assign to user" step needed — the app
    assigns each synced contact to the GHL user the account picks in Profile settings, so
    leads arrive pre-assigned. The old "remove Start Dialing Campaign tag" step is also
    vestigial — routing is driven by `app:synced`. Both are safe to delete.)*
  - **MAIL branch:** *(part of the Direct Mail add-on below — omit for non-mail users; the
    router can simply end the no-phone path, or you keep the branch but it does nothing
    without ThanksIO.)*

**Helper: Call Outcome - Pipeline (GHL-side CRM actions only)** — per-disposition routing:
update the opportunity stage, update contact fields, and remove the lead from the 8x dialer.
**Ship it WITHOUT a Send Webhook action** — "Sync Custom Fields to App" already notifies the
app on Call Outcome change (see the one-webhook rule above), so the app-side stop/pause is
automatic. *(Any `Disposition`→mail step belongs to the add-on.)*

**Tag-driven helper workflows** — the alert/handoff workflows in
[GHL_NEW_USER_SETUP.md](GHL_NEW_USER_SETUP.md) §5 (Ready-For-Human-Contact,
conversation_ended, not_for_sale, wrong_contact, conversation:manual, high-engagement,
email:bounced).

**Disposition → Call Outcome bridge workflows (one per call disposition)** — each is triggered
by *Call details* filtered to one Custom Disposition and does a single thing: `Update contact
field: Call Outcome = <label>`. (Keep them single-action — no `Assign to user` step; the app
assigns via the profile picker — and let "Call Outcome - Pipeline" own all opportunity moves.)

> **The app keys off the Call Outcome *label*, not the value.** GHL sends the dropdown **label**
> (e.g. `Sold Already`) in the standard payload, so each bridge must write a valid Call Outcome
> **label**. Several dispositions are named differently from their Call Outcome label — write the
> label, not the disposition name:

| Custom Disposition | → write Call Outcome label | App action ([dispositions.ts](../amplify/functions/shared/dispositions.ts)) |
|---|---|---|
| No Answer | No Answer | keep cadence |
| **Voicemail** | **Left Voicemail** | keep |
| **Follow Up** | **Spoke - Follow Up** | keep |
| **Requested Appointment** | **Appointment Set** | pause (ENGAGED) |
| Not Interested | Not Interested | STOP (DND/opt-out) |
| **Incorrect Number** | **Wrong Number / Disconnected / Invalid Number** | STOP |
| Listed With Realtor | Listed With Realtor | STOP |
| Sold Already | Sold Already | STOP |
| DNC | DNC | STOP |

- The **bold** rows are the name mismatches — easiest to get wrong.
- `Requested Appointment → Appointment Set` **pauses email as engaged** (not opted-out) — a conscious choice; remap if "requested" ≠ "booked" for you.
- The `Call Outcome` field must also include **`DEAD / Max Attempts`** (set by the dialer's max-attempts path) and **`Timeline / Not Ready Yet`** — these two have no matching disposition (set by other flows), so they aren't bridged here.
- Canonical source of truth for STOP / ENGAGED / NONE is `dispositionAction()` in [dispositions.ts](../amplify/functions/shared/dispositions.ts) — keep these labels in lockstep with it.

#### Optional: Direct Mail add-on (only if the user runs ThanksIO mail)

- Intake router **MAIL branch** — update opportunity to Mail-Only, add to **Direct Mail
  Router**. *(Recommended alignment with the app: route to mail only when property value
  is $300k–$850k, i.e. branch on the app's `Thanks_IO_Eligible` / `direct-mail-only` tag
  rather than "no phone".)*
- **Direct Mail Router** + any `Disposition`→mail steps.
- **ThanksIO delivery / QR** workflow (uses the Thanks.io webhook URL; drives `mail:delivered`,
  `mail:scanned`, `high-engagement`).
- Related tags (`Direct-Mail-Only`, `Thanks_IO_Eligible`, `mail:*`) — the app still
  provisions these (harmless/dormant), so no manual work even when the add-on is skipped.

### 3. Custom fields
Include the contact + opportunity custom fields. (Even if omitted, the app re-creates
missing ones by name on first sync — but including them makes the workflows valid
immediately on load.)

### 4. Tags
**No need to hand-build tags.** On the user's first sync, the app auto-provisions all
system tags (`SYSTEM_TAGS` in
[`amplify/functions/shared/ghlFieldProvisioner.ts`](../amplify/functions/shared/ghlFieldProvisioner.ts))
— so tag-triggered workflows and smart lists resolve even before any leads flow. Including
tags in the snapshot is optional/harmless (the app de-dupes by name).

### 5. Custom Call Dispositions (MUST be in the snapshot)
The app **cannot** auto-create custom call dispositions — GHL has no public API for them
(the endpoint 404s). So the snapshot **must include** the 9 dispositions, or the new user
adds them manually (Settings → Phone → Call Dispositions): **No Answer, Voicemail, Follow
Up, Requested Appointment, Not Interested, Incorrect Number, Listed With Realtor, Sold
Already, DNC**. These are what agents pick on a call; the bridge workflows map them to the
`Call Outcome` field labels (see the mapping table above).

---

## Steps for the agency owner

1. In the agency view, open the working sub-account and verify the pipeline + workflows
   above are present and **Published**.
2. Agency settings → **Snapshots** → **Create Snapshot** → select that sub-account →
   include CRM (pipeline), Automations (workflows), and Custom Fields.
3. Open the snapshot → **Share** → **Create Share Link** (allow import to any account).
4. Send the link to new users (and add it to onboarding).

> To update later: edit the source sub-account, refresh the snapshot, and re-share /
> push updates.

---

## Steps for a new user

1. Open the **shareable snapshot link** and load it into your GHL sub-account.
2. Connect Lead Manager (Settings → GHL Integration → Connect) — this provisions/reuses
   custom fields automatically.
3. Complete the per-user items the snapshot can't set: **phone system activation +
   phone number / A2P 10DLC**, **sending email domain (DNS)**, and **calendar selection**. See
   [GHL_NEW_USER_SETUP.md](GHL_NEW_USER_SETUP.md).

> **Agency prerequisite — LC Phone.** The snapshot does **not** enable the sub-account's
> phone system. A new sub-account can't buy a number until the **agency activates LC Phone**
> for it (otherwise the Phone Numbers screen shows *"requires configuration"*). Do this per
> sub-account before the user completes setup — same class of agency step as this snapshot.
