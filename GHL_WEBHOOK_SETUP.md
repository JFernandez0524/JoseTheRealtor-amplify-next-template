# GHL Webhook Configuration

## Single Lambda Webhook for ALL Message Types

**Lambda Function URL:**
```
https://dpw6qwhfwor3hucpbsitt7skzq0itemx.lambda-url.us-east-1.on.aws/
```

## GHL Webhook Setup

**Location:** Settings → Integrations → Webhooks

### Create ONE Webhook

**Event Types to Enable:**
- ✅ `InboundMessage` (catches ALL message types)
- ✅ `EmailBounced` (email delivery failures)

**URL:** `https://dpw6qwhfwor3hucpbsitt7skzq0itemx.lambda-url.us-east-1.on.aws/`

**Method:** POST

---

## Message Types Handled

The Lambda automatically detects message type and routes accordingly:

| Type | Message Channel | Handler |
|------|----------------|---------|
| `EmailBounced` | Email bounce event | `handleEmailBounce()` |
| `1` | Email reply | `handleEmailReply()` |
| `2` | SMS | Main conversation handler |
| `3` | Facebook Messenger | Main conversation handler |
| `4` | Instagram DM | Main conversation handler |
| `5` | WhatsApp | Main conversation handler |
| `18` | Instagram Story Reply | Main conversation handler |

---

## Custom Data Fields (For GHL Workflow)

When setting up the GHL workflow trigger, add these custom data fields:

| Key | Value |
|-----|-------|
| `userId` | `{{contact.custom_fields.app_user_id}}` |
| `contactId` | `{{contact.id}}` |
| `messageBody` | `{{message.body}}` |
| `type` | `InboundMessage` |
| `conversationId` | `{{conversation.id}}` |
| `locationId` | `{{location.id}}` |
| `body` | `{{message.body}}` |

**Screenshot of Custom Data Configuration:**
```
Custom Data
These custom key-value pairs will be included along with the standard data

userId: {{contact.custom_fields.app_user_id}}
contactId: {{contact.id}}
messageBody: {{message.body}}
type: InboundMessage
conversationId: {{conversation.id}}
locationId: {{location.id}}
body: {{message.body}}
```

**Note:** The Lambda extracts data from both `customData` and root level, so it works with both workflow webhooks and system webhooks.

---

## Email Handling

### Email Reply Payload
```json
{
  "type": "InboundMessage",
  "message": {
    "type": 1
  },
  "contactId": "abc123",
  "locationId": "xyz789",
  "body": "Email message content",
  "from": "sender@email.com"
}
```

### Email Bounce Payload
```json
{
  "type": "EmailBounced",
  "contactId": "abc123",
  "locationId": "xyz789",
  "bounceReason": "Invalid email address"
}
```

---

## What the Lambda Does

### For Email Replies (type 1)
1. Detects "wrong email" phrases
2. Updates queue status to REPLIED or BOUNCED
3. Tags contact appropriately
4. Generates AI response (if AI active)

### For Email Bounces
1. Updates queue status to BOUNCED
2. Tags contact with `email:bounced`
3. Stops future emails

### For SMS/Social (types 2-5, 18)
1. Fetches contact from GHL
2. Generates AI response
3. Updates queue status
4. Sends reply via appropriate channel

---

## Queue Integration

All message types update the OutreachQueue:

**Email Status Updates:**
- Reply → `emailStatus: REPLIED`
- Bounce → `emailStatus: BOUNCED`
- Wrong email → `emailStatus: BOUNCED` + tags

**SMS Status Updates:**
- Reply → `smsStatus: REPLIED`
- Opt-out → `smsStatus: OPTED_OUT`

---

## Testing

### Test Email Reply
```bash
curl -X POST https://dpw6qwhfwor3hucpbsitt7skzq0itemx.lambda-url.us-east-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d '{
    "type": "InboundMessage",
    "message": { "type": 1 },
    "contactId": "test123",
    "locationId": "loc123",
    "body": "This is a test reply",
    "from": "test@email.com"
  }'
```

### Test Email Bounce
```bash
curl -X POST https://dpw6qwhfwor3hucpbsitt7skzq0itemx.lambda-url.us-east-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d '{
    "type": "EmailBounced",
    "contactId": "test123",
    "locationId": "loc123",
    "bounceReason": "Invalid email"
  }'
```

### Check Logs
```bash
aws logs tail /aws/lambda/ghlWebhookHandler --follow
```

---

## Summary

✅ **One webhook URL** handles everything  
✅ **No custom data needed** for emails  
✅ **Automatic message type detection**  
✅ **Queue updates** for all channels  
✅ **Wrong email detection** built-in  
✅ **Bounce handling** automatic  

Just configure the webhook in GHL and you're done! 🚀
