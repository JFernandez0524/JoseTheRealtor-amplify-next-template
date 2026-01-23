# GHL Manual Disposition Integration

## Overview
When you manually call a lead in GHL and set a call disposition (e.g., "Sold Already"), this webhook stops AI outreach and lets GHL workflows take over.

## Webhook Endpoint
```
POST https://leads.josetherealtor.com/api/v1/ghl-disposition-webhook
```

## GHL Workflow Setup

### 1. Create Workflow Trigger
- **Trigger:** Contact Custom Field Updated
- **Field:** Call Outcome (ID: `LNyfm5JDal955puZGbu3`)

### 2. Add Webhook Action
- **URL:** `https://leads.josetherealtor.com/api/v1/ghl-disposition-webhook`
- **Method:** POST
- **Body:** Use standard GHL webhook data (no custom configuration needed)

GHL automatically sends all contact data including custom fields. The webhook will extract the Call Outcome field automatically.

### 3. Add Conditional Branches
Based on the Call Outcome value, trigger different workflows:

**Branch 1: Sold Already**
- Add tag: `sold-already`
- Remove tag: `ai outreach`
- Move to pipeline stage: "Closed - Sold"

**Branch 2: Not Interested**
- Add tag: `not-interested`
- Remove tag: `ai outreach`
- Move to pipeline stage: "Dead"

**Branch 3: DNC**
- Add tag: `dnc`
- Remove tag: `ai outreach`
- Add to DNC list

## Dispositions That Stop AI Outreach
- Sold Already
- Not Interested
- DNC
- Listed With Realtor
- Wrong Number / Disconnected / Invalid Number

## What Happens
1. You set Call Outcome in GHL
2. Webhook fires to our app
3. OutreachQueue status → OPTED_OUT (both SMS and email)
4. AI agents skip this contact
5. GHL workflow continues based on disposition

## Testing
1. Manually call a test contact
2. Set Call Outcome to "Sold Already"
3. Check CloudWatch logs for webhook confirmation
4. Verify contact no longer receives AI messages
