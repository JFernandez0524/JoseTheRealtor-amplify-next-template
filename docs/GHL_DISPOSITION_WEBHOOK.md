# GHL Call Disposition → Stop AI Outreach

> **Note:** There is **no separate `/api/v1/ghl-disposition-webhook` endpoint.** Disposition handling is built into the existing **field-sync webhook** (`ghlFieldSyncHandler`). You do **not** need to create any additional webhook or workflow for this to work.

## How it works

When you set a **Call Outcome** on a contact in GHL, the existing **"Helper: Sync Custom Fields to App"** workflow fires (it already triggers on "Call Outcome has changed") and POSTs the contact's standard payload to the field-sync Lambda:

```
https://xjiwzxgpa4nzpxdxjl5ib6xdom0gdtvx.lambda-url.us-east-1.on.aws/
```

`ghlFieldSyncHandler` reads `Call Outcome` from the standard payload (by field display name) and, if it is a **terminal disposition**, stops AI outreach for that contact:

1. Finds the contact's `OutreachQueue` item by `contactId`.
2. Sets `queueStatus = DND` and `emailStatus = OPTED_OUT`.
3. The `dailyEmailAgent` only sends to items in `OUTREACH` status, so the cadence stops on the next run.

This is non-fatal and idempotent: if there's no queue item, or the contact is already DND, nothing breaks and field sync still succeeds.

## Dispositions that STOP outreach (terminal → DND / opted-out)

- Sold Already
- Not Interested
- DNC
- Listed With Realtor
- Wrong Number / Disconnected / Invalid Number  *(the exact GHL Call Outcome option;
  aliases "Incorrect Number" / "Wrong Number" / "Disconnected" / "Invalid Number" also match)*

## Dispositions that PAUSE outreach (engaged → not opted out)

- **Appointment Set** — the lead booked, so cold email pauses (`queueStatus=CONVERSATION`),
  but they are NOT marked opted-out.

## Dispositions that KEEP the cadence (non-terminal)

- No Answer
- Voicemail / Left Voicemail
- Spoke - Follow Up
- Timeline / Not Ready Yet
- DEAD / Max Attempts  *(calls are exhausted, but the dialer workflow hands off to
  email/direct mail, so email keeps running)*

Matching is case- and whitespace-insensitive against the exact GHL Call Outcome field
options. The logic lives in
[`amplify/functions/shared/dispositions.ts`](../amplify/functions/shared/dispositions.ts)
(`dispositionAction` → `STOP` | `ENGAGED` | `NONE`), covered by
`__tests__/shared/dispositions.test.ts`.

## GHL-side actions still belong in your workflows

The webhook only stops **app-side** outreach. Moving opportunities through pipeline
stages, adding tags, DNC-list handling, and KVCORE sync remain the job of your
`Disposition: *` workflows in GHL.

## Testing

1. On a contact currently in `OUTREACH`, set Call Outcome = "Sold Already".
2. CloudWatch (`ghlFieldSyncHandler`) should log `🛑 [FIELD_SYNC] Stopped outreach for <contactId>`.
3. Verify the `OutreachQueue` item is now `queueStatus=DND`, `emailStatus=OPTED_OUT`.
4. Set Call Outcome = "No Answer" on another contact → it stays `OUTREACH` (no stop).
