# GHL Custom Field Sync Webhook Setup

This webhook syncs manual changes to GHL custom fields back to your app in real-time.

## Webhook URL

```
https://your-app-domain.com/api/v1/ghl-field-sync-webhook
```

## GHL Workflow Setup

### 1. Create New Workflow

1. Go to **Automations** → **Workflows**
2. Click **Create Workflow**
3. Name it: "Sync Custom Fields to App"

### 2. Add Trigger

**Trigger:** Contact Custom Field Updated

**Filter by these fields:**
- `call_attempt_counter` (ID: 0MD4Pp2LCyOSCbCjA5qF)
- `email_attempt_counter` (ID: wWlrXoXeMXcM6kUexf2L)
- `last_call_date` (ID: dWNGeSckpRoVUxXLgxMj)
- `AI state` (ID: 1NxQW2kKMVgozjSUuu7s)
- `mail_sent_count` (ID: DTEW0PLqxp35WHOiDLWR)

### 3. Add Webhook Action

**Action:** Send Outbound Webhook

**Webhook URL:**
```
https://your-app-domain.com/api/v1/ghl-field-sync-webhook
```

**Method:** POST

**Request Body (JSON):**
```json
{
  "contactId": "{{contact.id}}",
  "0MD4Pp2LCyOSCbCjA5qF": "{{contact.call_attempt_counter}}",
  "wWlrXoXeMXcM6kUexf2L": "{{contact.email_attempt_counter}}",
  "dWNGeSckpRoVUxXLgxMj": "{{contact.last_call_date}}",
  "1NxQW2kKMVgozjSUuu7s": "{{contact.AI_state}}",
  "DTEW0PLqxp35WHOiDLWR": "{{contact.mail_sent_count}}"
}
```

**Headers:**
```
Content-Type: application/json
```

### 4. Save & Publish

Click **Save** and **Publish** the workflow.

## What Gets Synced

| GHL Field | Field ID | App Field |
|-----------|----------|-----------|
| call_attempt_counter | 0MD4Pp2LCyOSCbCjA5qF | ghlOutreachData.smsAttempts |
| email_attempt_counter | wWlrXoXeMXcM6kUexf2L | ghlOutreachData.emailAttempts |
| last_call_date | dWNGeSckpRoVUxXLgxMj | ghlOutreachData.lastSmsSent |
| AI state | 1NxQW2kKMVgozjSUuu7s | ghlOutreachData.aiState |
| mail_sent_count | DTEW0PLqxp35WHOiDLWR | ghlOutreachData.mailSentCount |

## Testing

1. Manually update any of these fields on a contact in GHL
2. Check your app's lead details page - the OutreachStatus component should show the updated value
3. Check CloudWatch logs for webhook activity:
   ```
   🔄 [FIELD_SYNC] Received webhook
   ✅ [FIELD_SYNC] Updated PropertyLead
   ```

## Troubleshooting

**Webhook not firing:**
- Verify workflow is published
- Check that the trigger includes all 5 custom fields
- Ensure contact has a matching PropertyLead in the app (by ghlContactId)

**Values not updating:**
- Check webhook payload in GHL workflow logs
- Verify field IDs match exactly (case-sensitive)
- Check CloudWatch logs for errors
