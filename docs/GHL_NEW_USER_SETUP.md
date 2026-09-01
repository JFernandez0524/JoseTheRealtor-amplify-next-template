# GHL Account Setup Guide for New Users

This guide covers everything a new user must configure in their GoHighLevel sub-account to work with DealFinder. Some things are created automatically when you connect; everything else requires a one-time manual setup.

---

## 1. Connect Your GHL Account

You can connect your GoHighLevel sub-account to DealFinder in two ways:

### Method A: Private Integration Token (PIT) — *Recommended for Instant Setup*
Bypasses marketplace approval and uses a permanent token:
1. In GoHighLevel, go to **Settings → Integrations → Private Integrations**.
2. Click **+ Create Token** (Name: `DealFinder`).
3. Select scopes: **Contacts, Conversations, Calendars, Locations, Opportunities, Custom Fields, Tags**.
4. Copy your **Location ID** (from *Settings → Business Profile*) and your **PIT Token** (`pit-...`).
5. In DealFinder → **Profile → Launch AI Connection**, click **"Connect PIT"**, enter both values, and click **Connect**.

### Method B: 1-Click OAuth / Test Draft Link
1. In DealFinder, go to **Profile → Launch AI Connection**.
2. Click **Connect Launch AI** (or enter your Sub-Account ID under *"Have a Sub-Account ID? Connect test draft link"*).
3. Authorize on the GoHighLevel consent screen.

---

### What Gets Created Automatically Upon Connection:

When you connect (via either method), the system automatically provisions in your GHL account:

| What gets created | Details |
|---|---|
| **41 Contact Custom Fields** | Full property info, mailing info, AI state, counters, sentiment, and outcomes |
| **1 Opportunity Custom Field** | Disposition (single-select with deal stages) |
| **45 System Tags** | All workflow, sentiment, cadence, and state tags |

You do **not** need to create those manually.

---

### Complete Reference: Contact Custom Fields (41 Fields)

| Field Name | Key | Data Type | Picklist Options / Values |
|:---|:---|:---|:---|
| **Property Address** | `property_address` | TEXT | Property street address |
| **Property City** | `property_city` | TEXT | Property city |
| **Property State** | `property_state` | TEXT | Property state (2-letter abbreviation) |
| **Property Zip** | `property_zip` | TEXT | Property ZIP code |
| **property_county** | `property_county` | TEXT | Validated county name |
| **Mailing Address** | `mailing_address` | TEXT | Owner mailing street address |
| **Mailing City** | `mailing_city` | TEXT | Owner mailing city |
| **Mailing State** | `mailing_state` | TEXT | Owner mailing state |
| **Mailing Zipcode** | `mailing_zipcode` | TEXT | Owner mailing ZIP |
| **Out of State Admin** | `is_out_of_state_admin` | SINGLE_OPTIONS | `YES`, `NO` |
| **Lead Type** | `lead_type` | SINGLE_OPTIONS | `Probate`, `Preforeclosure`, `Sell As Is`, `General Inquiry` |
| **Contact Type** | `contact_type` | SINGLE_OPTIONS | `Phone Contact`, `Direct Mail`, `Probate Landing Page`, `Foreclosure Landing Page`, `Sell As-Is Landing Page` |
| **SkipTraceStatus** | `skiptracestatus` | SINGLE_OPTIONS | `COMPLETED`, `NO_MATCH`, `FAILED`, `NO_QUALITY_CONTACTS`, `PENDING` |
| **Listing Status** | `listing_status` | SINGLE_OPTIONS | `off market`, `active`, `sold`, `pending`, `fsbo`, `auction`, `skip`, `door knock` |
| **Zestimate** | `zestimate` | NUMERICAL | Automated property valuation estimate |
| **cash offer** | `cash_offer` | TEXT | Formatted instant cash offer range |
| **Call Attempt or Text Counter** | `call_attempt_counter` | NUMERICAL | Total phone/SMS attempts counter |
| **email attempt counter** | `email_attempt_counter` | NUMERICAL | Total email touches sent |
| **Mail Sent Count** | `mail_sent_count` | NUMERICAL | Total direct mailers delivered/sent |
| **Mail Sent With Thanks** | `mail_sent_with_thanks` | SINGLE_OPTIONS | `true`, `false` |
| **QR Scan Count** | `qr_scan_count` | NUMERICAL | Number of QR code scans from mailers |
| **Last Call Date** | `last_call_date` | DATE | Date of most recent call/SMS touch |
| **last email date** | `last_email_date` | DATE | Date of most recent email outreach |
| **Last Mail Date** | `last_mail_date` | DATE | Date of most recent mail drop |
| **Mail Delivery Date** | `mail_delivery_date` | DATE | USPS confirmed delivery date |
| **Phone 2** | `phone_2` | PHONE | Secondary phone number |
| **Phone 3** | `phone_3` | PHONE | Third phone number |
| **Phone 4** | `phone_4` | PHONE | Fourth phone number |
| **Phone 5** | `phone_5` | TEXT | Additional contact phone number |
| **Email 2** | `email_2` | TEXT | Secondary email address |
| **Email 3** | `email_3` | TEXT | Third email address |
| **App User ID** | `app_user_id` | TEXT | App internal account UUID |
| **App Plan** | `app_plan` | SINGLE_OPTIONS | `SYNC`, `AI` |
| **App Account Status** | `app_account_status` | SINGLE_OPTIONS | `active`, `past_due`, `canceled` |
| **App Lead ID** | `app_lead_id` | TEXT | App lead UUID |
| **AI State** | `ai_state` | SINGLE_OPTIONS | `not_started`, `running`, `paused`, `handoff` |
| **Lead Source Id** | `lead_source_id` | TEXT | Original upload file / batch ID |
| **Conversation Sentiment** | `conversation_sentiment` | SINGLE_OPTIONS | `POSITIVE`, `NEUTRAL`, `FRUSTRATED`, `URGENT`, `DISENGAGING` |
| **Property Tier** | `property_tier` | MULTIPLE_OPTIONS | `luxury`, `mid_range`, `entry_level` |
| **Zillow Link** | `zillow_link` | TEXT | Direct URL to property on Zillow |
| **Call Outcome** | `call_outcome` | SINGLE_OPTIONS | `No Answer`, `Left Voicemail`, `Spoke - Follow Up`, `Timeline / Not Ready Yet`, `Appointment Set`, `Not Interested`, `DNC`, `Listed With Realtor`, `Sold Already`, `Wrong Number / Disconnected / Invalid Number`, `DEAD / Max Attempts` |

---

### Opportunity Custom Field (1 Field)

| Field Name | Key | Data Type | Picklist Options |
|:---|:---|:---|:---|
| **Disposition** | `disposition` | SINGLE_OPTIONS | `Unanswered/Unreachable`, `Price Too High`, `Not Interested`, `Sold`, `Listed / For Sale`, `Wrong Number`, `Follow Up`, `Voicemail`, `Skiptrace Failed`, `Direct Mail Campaign` |

---

### Custom Phone Call Dispositions (9 Dispositions)

> **Custom phone Call Dispositions are NOT auto-created via API** — GHL has no public API for them.
> They are pre-loaded in the **GHL snapshot**, or can be added manually under **Settings → Phone → Call Dispositions**:

1. **No Answer**
2. **Voicemail**
3. **Follow Up**
4. **Requested Appointment**
5. **Not Interested**
6. **Incorrect Number**
7. **Listed With Realtor**
8. **Sold Already**
9. **DNC**

#### Automatic Call Outcome & Disposition Mapping
When a lead replies via SMS or email, the AI automatically categorizes their response into the exact matching choice for the **`Call Outcome`** custom field:
- *"not for sale"*, *"not selling"*, *"not interested"* $\rightarrow$ **`Not Interested`**
- *"sold"*, *"already sold"* $\rightarrow$ **`Sold Already`**
- *"listed"*, *"realtor"*, *"agent"* $\rightarrow$ **`Listed With Realtor`**
- *"wrong number"*, *"wrong person"* $\rightarrow$ **`Wrong Number / Disconnected / Invalid Number`**
- *"DNC"*, *"do not call"*, *"unsubscribe"* $\rightarrow$ **`DNC`**

*Note: Property status responses stop outreach (`queueStatus = 'DND'`) but do not mark the lead legal DNC/opted-out.*


---

## 2. Buy or Assign a Phone Number

A phone number is **required** — the app skip-traces and works leads by phone (SMS/email are secondary).

> **Prerequisite (agency step):** the sub-account's **phone system (LC Phone) must be enabled**
> before you can buy a number. New sub-accounts don't have it by default — if **Settings → Phone
> System → Phone Numbers** says *"Your phone system requires configuration… reach out to support,"*
> the **agency** must activate LC Phone for the sub-account first. A sub-account user can't do this.

Setup order: **agency enables LC Phone → buy number + A2P → connect the app + finish profile setup.**

1. (Agency) Enable the phone system (LC Phone) for the sub-account.
2. Go to **Settings → Phone Numbers** and purchase a local number in your market area.
3. Complete **A2P 10DLC** registration — SMS will be blocked without it.
4. Select that number as your **Campaign Phone** in the app's profile settings.

---

## 3. Set Up Your Sending Email Domain

The AI email agent sends from your GHL email.

1. Go to **Settings → Email Services → Sending Domains**
2. Add and verify your domain (requires DNS records at your registrar)
3. Go to **Settings → Email Services** and set a default From Name and From Email

---

## 4. Create Your Lead Pipeline

The system writes the **Disposition** custom field on opportunities. You need a pipeline for those opportunities to live in.

1. Go to **CRM → Pipelines → + Add Pipeline**
2. Name it: `Lead Manager`
3. Add these stages in order:

| Stage Name | Purpose |
|---|---|
| New Lead | Freshly synced, not yet contacted |
| Attempting Contact | AI outreach in progress |
| Contact Made | Lead has replied |
| Appointment Set | Lead agreed to a call/meeting |
| Offer Made | Verbal or written offer extended |
| Under Contract | Signed contract |
| Closed | Deal closed |
| Not Interested | Lead said no |
| Dead | No response after full cadence |

---

## 5. Required GHL Workflows

> **Fastest path:** load the **Lead Manager shareable snapshot link** — it installs the
> pipeline and all of the workflows below in one step. Ask your provider for the link
> (see [GHL_SNAPSHOT_SHARING.md](GHL_SNAPSHOT_SHARING.md)). The sections below document
> what the snapshot contains, so you can verify or rebuild manually if needed.

These are automations in **Automation → Workflows**. Each one triggers on a tag the system adds to contacts automatically.

---

### 5.1 Hot Lead Alert — `Ready-For-Human-Contact`

**Trigger:** Contact tag added = `Ready-For-Human-Contact`

**What it means:** The AI determined the lead is engaged and ready to speak with a human. This is your highest-priority alert.

**Suggested actions:**
- Send internal notification (email or SMS) to the assigned agent
- Move opportunity to **Appointment Set** stage
- Create a task: "Call this lead now"

---

### 5.2 AI Conversation Ended — `conversation_ended`

**Trigger:** Contact tag added = `conversation_ended`

**What it means:** The AI has completed its conversation with this lead (either they responded to completion or the AI reached a terminal outcome).

**Suggested actions:**
- Move opportunity to the appropriate closed stage
- Optionally send a follow-up task to review the conversation

---

### 5.3 Not For Sale — `not_for_sale`

**Trigger:** Contact tag added = `not_for_sale`

**What it means:** The lead told the AI their property is not for sale.

**Suggested actions:**
- Move opportunity to **Not Interested**
- Add a task to follow up in 6 months
- Optionally send a "stay in touch" email sequence

---

### 5.4 Wrong Contact — `wrong_contact`

**Trigger:** Contact tag added = `wrong_contact`

**What it means:** The AI determined this is the wrong person (wrong number, someone other than the owner).

**Suggested actions:**
- Tag with `needs_review` for manual cleanup
- Notify agent to verify contact info
- Stop any active sequences on the contact

---

### 5.5 Human Took Over — `conversation:manual`

**Trigger:** Contact tag added = `conversation:manual`

**What it means:** The system detected that a human agent replied to this contact. AI responses are automatically paused. The tag is automatically removed after 3 days if no further activity.

**Suggested actions:**
- Notify the assigned agent
- Optionally move opportunity to **Contact Made**

---

### 5.6 High Engagement — Mail QR Scanned — `high-engagement`

**Trigger:** Contact tag added = `high-engagement`

**What it means:** The lead scanned the QR code on your direct mail piece. This is a strong buying signal.

**Suggested actions:**
- Immediately notify agent (SMS preferred)
- Move opportunity to **Contact Made** or **Appointment Set**
- Create a call-back task with high priority

---

### 5.7 Direct Mail Delivered — `mail:delivered`

**Trigger:** Contact tag added = `mail:delivered`

**What it means:** ThanksIO confirmed the mailer reached the address.

**Suggested actions:**
- Start a follow-up call task 2–3 days after delivery
- No urgent action required

---

### 5.8 Email Bounced — `email:bounced`

**Trigger:** Contact tag added = `email:bounced`

**What it means:** The email address on file is invalid or rejected delivery.

**Suggested actions:**
- Create a task to find a correct email
- Optionally remove the contact from email sequences

---

### 5.9 Email Wrong Address — `email:wrong_address`

**Trigger:** Contact tag added = `email:wrong_address` and `needs_review`

**What it means:** An email reply indicated the address belongs to someone else.

**Suggested actions:**
- Notify agent to investigate
- Remove from email sequences

---

### 5.10 Billing Hold — `App:Billing-Hold`

**Trigger:** Contact tag added = `App:Billing-Hold`

**What it means:** The user's Lead Manager subscription has a billing issue. Outreach is paused for all their contacts.

**Suggested actions:** None required — outreach automatically resumes when billing is resolved.

---

## 6. Call Disposition Workflows (Phone System)

> **Note:** Stopping **app-side AI outreach** on terminal dispositions (Sold Already,
> Not Interested, DNC, Listed With Realtor, Incorrect Number) is now **automatic** via
> the Field Sync webhook — see [GHL_DISPOSITION_WEBHOOK.md](GHL_DISPOSITION_WEBHOOK.md).
> The workflows below only handle the **GHL-side** CRM actions (pipeline moves, tags,
> DND, cleanup tasks).

These trigger from your GHL phone system when an agent logs a call outcome. Go to **Automation → Workflows** and create one per disposition you want to act on.

| Disposition | Trigger | Suggested Action |
|---|---|---|
| **Requested Appointment** | Call disposition = Requested Appointment | Create calendar event task, notify agent |
| **DNC** | Call disposition = DNC | Enable DND on contact, stop all sequences |
| **Incorrect Number** | Call disposition = Incorrect Number | Tag `needs_review`, create cleanup task |
| **Not Interested** | Call disposition = Not Interested | Move opportunity to Not Interested stage |
| **Listed With Realtor** | Call disposition = Listed With Realtor | Move to Not Interested, note reason |
| **Sold Already** | Call disposition = Sold Already | Move to Not Interested, note reason |

---

## 7. Smart Lists (Optional but Recommended)

Smart lists let you quickly view contacts by their system state.

Go to **Contacts → + Add Smart List** and create the following:

| Smart List Name | Filter |
|---|---|
| AI Outreach Active | Tag = `ai outreach` |
| Ready for Human Contact | Tag = `Ready-For-Human-Contact` |
| Conversation Ended | Tag = `conversation_ended` |
| High Engagement | Tag = `high-engagement` |
| Direct Mail Only | Tag = `Direct-Mail-Only` |
| Needs Review | Tag = `needs_review` |
| Multi-Phone Leads | Tag = `Multi-Phone-Lead` |

---

## 8. System Tag Reference

Full reference of every tag the system applies and what it means.

### Tags Added at Sync Time

| Tag | When Added |
|---|---|
| `App:Synced` | Every contact synced from Lead Manager |
| `App:AI-Enabled` | User is on the AI plan |
| `App:Billing-Hold` | Billing issue on the account |
| `Multi-Phone-Lead` | Lead has 2+ phone numbers (multiple contacts created) |
| `Direct-Mail-Only` | No qualifying phone number found, direct mail only |
| `Primary_Contact` | The primary contact record when a lead has multiple phones |
| `ai outreach` | AI outreach is enabled for this contact |

### Tags Added During AI Outreach

| Tag | When Added |
|---|---|
| `conversation:manual` | Human agent replied — AI paused (auto-removed after 3 days) |
| `Ready-For-Human-Contact` | AI determined lead is ready to speak to a human |
| `conversation_ended` | AI conversation reached a terminal outcome |
| `not_for_sale` | Lead says property is not for sale |
| `wrong_contact` | Wrong person reached |
| `high-engagement` | Lead scanned QR code on mailer |

### Tags Added by Email Tracking

| Tag | When Added |
|---|---|
| `email:replied` | Lead replied to an outreach email |
| `email:bounced` | Email delivery failed |
| `email:wrong_address` | Email confirmed to belong to wrong person |
| `needs_review` | Contact needs manual agent review |

### Tags Added by Direct Mail (ThanksIO)

| Tag | When Added |
|---|---|
| `mail:delivered` | Mailer confirmed delivered by USPS |
| `mail:touch1`, `mail:touch2`, … | Which mail touch number was delivered |
| `mail:scanned` | QR code on mailer was scanned (same contact gets `high-engagement`) |

### Tags Added by Facebook Integration

| Tag | When Added |
|---|---|
| `facebook-lead` | Lead came in via Facebook/Instagram Messenger |
| `new-lead` | Newly created lead |

### Data Error Tags (added alongside `conversation_ended`)

| Tag | Meaning |
|---|---|
| `data_error:wrong_property` | Lead disputed the property address |
| `data_error:wrong_person` | Wrong person reached |
| `data_error:unclear` | Data mismatch could not be resolved |
| `data_error:persistent_dispute` | Lead repeatedly disputed property info |
| `ended_reason:{reason}` | Specific AI-determined reason for ending |

---

## 9. ThanksIO Setup (Direct Mail) — Optional

> **Direct mail is an optional add-on.** Skip this entire section (and the intake
> router's MAIL branch / Direct Mail Router) if you don't run direct mail. The app still
> tags mail-eligible contacts, but nothing is sent without ThanksIO configured here — the
> tags simply stay dormant.

If you are on a plan that includes direct mail:

1. Create a ThanksIO account at thanksio.com
2. In ThanksIO, go to Settings → Webhooks and add your webhook URL (provided by Lead Manager support)
3. In Lead Manager → Settings, enter your ThanksIO API key
4. Design your postcard template in ThanksIO — Lead Manager will send the lead's property address and mailing address automatically

---

## Checklist

- [ ] Connected GHL account (custom fields + system tags auto-created)
- [ ] Custom Call Dispositions present (from snapshot, or added manually — not auto-created)
- [ ] Purchased phone number + A2P 10DLC registered
- [ ] Email sending domain verified
- [ ] Lead Manager pipeline created with all stages
- [ ] Workflow: Ready-For-Human-Contact alert
- [ ] Workflow: conversation_ended close action
- [ ] Workflow: not_for_sale follow-up schedule
- [ ] Workflow: wrong_contact cleanup
- [ ] Workflow: high-engagement priority alert
- [ ] Workflow: DNC call disposition → enable DND
- [ ] Workflow: Requested Appointment → create task
- [ ] Smart lists created (optional)
- [ ] *(Optional — direct mail only)* ThanksIO configured + intake router MAIL branch / Direct Mail Router
