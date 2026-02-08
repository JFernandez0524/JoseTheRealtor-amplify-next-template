# Wrong Email Address Management

## Overview

When leads reply saying "that's not my email" or "wrong email address", the system automatically:
1. **Stops all emails** to that address (queue status → BOUNCED)
2. **Tags contact** in GHL with `email:wrong_address` and `needs_review`
3. **Adds a note** to the contact record for manual review

## Automatic Detection

The webhook (`/api/v1/ghl-email-webhook`) detects these phrases in email replies:
- "wrong email"
- "incorrect email"
- "not my email"
- "not the right email"
- "wrong address"
- "wrong person"
- "not me"
- "i am not"
- "this is not"
- "you have the wrong"

## What Happens Automatically

### 1. Queue Update
```
emailStatus: PENDING → BOUNCED
```
This stops all future automated emails to this address.

### 2. GHL Tags Added
- `email:wrong_address` - Identifies the issue
- `needs_review` - Flags for manual follow-up

### 3. Note Added to Contact
```
⚠️ WRONG EMAIL ADDRESS: Recipient reported that [email] is incorrect. 
Please verify and update contact information.
```

## Finding Contacts with Wrong Emails

### Check Queue Status
```bash
npx tsx scripts/check-wrong-emails.ts
```

This shows all contacts with `emailStatus: BOUNCED` including:
- Contact name
- Contact ID
- Email address
- Property address
- Number of attempts made

### Check GHL
Filter contacts by tag: `email:wrong_address` or `needs_review`

## Fixing Wrong Emails

### Option 1: Manual Fix in GHL
1. Go to contact in GHL
2. Update email address
3. Remove tags: `email:wrong_address`, `needs_review`
4. Add tag: `email:corrected`
5. Run fix script to update queue

### Option 2: Automated Fix Script
```bash
npx tsx scripts/fix-email.ts <contactId> <newEmail> <accessToken>
```

**Example:**
```bash
npx tsx scripts/fix-email.ts abc123 correct@email.com eyJhbGc...
```

**What it does:**
1. Updates email in GHL contact
2. Removes error tags (`email:wrong_address`, `needs_review`)
3. Adds `email:corrected` tag
4. Finds queue entry by contactId
5. Updates queue with new email
6. Resets `emailStatus` to PENDING
7. Resets `emailAttempts` to 0

**Result:** Contact will start receiving emails again with the corrected address.

## Workflow

### When Wrong Email Detected
```
1. Lead replies: "This is the wrong email"
   ↓
2. Webhook detects phrase
   ↓
3. Queue status → BOUNCED (stops emails)
   ↓
4. GHL tags added: email:wrong_address, needs_review
   ↓
5. Note added to contact
   ↓
6. Manual review required
```

### Manual Correction Process
```
1. Check wrong emails: npx tsx scripts/check-wrong-emails.ts
   ↓
2. Research correct email (skip trace, public records, etc.)
   ↓
3. Fix email: npx tsx scripts/fix-email.ts <contactId> <newEmail> <token>
   ↓
4. Contact re-enters outreach queue
   ↓
5. Emails resume with correct address
```

## Monitoring

### Daily Check
Run this daily to see if any new wrong emails were reported:
```bash
npx tsx scripts/check-wrong-emails.ts
```

### GHL Dashboard
Create a saved filter in GHL:
- Tag contains: `needs_review`
- Sort by: Date added (newest first)

This shows all contacts needing manual attention.

## Prevention

### Data Quality at Import
- Validate email format before syncing to GHL
- Use email verification service (optional)
- Skip trace for better contact data

### Multi-Email Strategy
The system sends to all available emails:
- Primary email
- email2 (custom field: JY5nf3NzRwfCGvN5u00E)
- email3 (custom field: 1oy6TLKItn5RkebjI7kD)

If one bounces, others may still work.

## Technical Details

### Queue Schema
```typescript
{
  id: string,              // userId_contactId
  contactId: string,
  contactEmail: string,    // Email being used
  emailStatus: 'PENDING' | 'REPLIED' | 'BOUNCED' | 'FAILED' | 'OPTED_OUT',
  emailAttempts: number,   // 0-7
  lastEmailSent: string,   // ISO timestamp
  updatedAt: string
}
```

### GHL Custom Fields
- `CNoGugInWOC59hAPptxY` - userId (for queue lookup)
- `wWlrXoXeMXcM6kUexf2L` - email_attempt_counter
- `JY5nf3NzRwfCGvN5u00E` - email2
- `1oy6TLKItn5RkebjI7kD` - email3

### Related Files
- `/app/api/v1/ghl-email-webhook/route.ts` - Webhook handler
- `/scripts/check-wrong-emails.ts` - Check bounced emails
- `/scripts/fix-email.ts` - Fix wrong email
- `/amplify/functions/shared/outreachQueue.ts` - Queue manager

## Best Practices

1. **Check daily** for new wrong emails
2. **Research before fixing** - verify the correct email
3. **Document changes** - add note in GHL when correcting
4. **Monitor bounce rate** - high rate indicates data quality issues
5. **Use skip trace** - get better contact data upfront

## Support

If you need to bulk fix emails or have questions:
1. Check CloudWatch logs: `/aws/lambda/ghlWebhookHandler`
2. Review queue status: `npx tsx scripts/check-queue.ts`
3. Test webhook: Send test email to GHL contact
