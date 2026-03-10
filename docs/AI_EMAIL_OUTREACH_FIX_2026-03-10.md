# AI Email Outreach Fix - Enable for All Leads

**Date:** 2026-03-10  
**Issue:** Contact `b7UCMwtBKmZewpODX0Gv` synced to GHL with email but never received AI outreach email  
**Root Cause:** "ai outreach" tag only added to email-only leads (no phone), excluding leads with phones  
**Status:** ✅ Implemented

---

## Problem Summary

**Symptom:** Leads synced to GHL with emails don't receive AI outreach emails if they also have phone numbers

**Example:** Contact `b7UCMwtBKmZewpODX0Gv`
- Synced from app with email address
- Has phone number
- Did NOT get "ai outreach" tag
- Was NOT added to OutreachQueue
- Never received email from dailyEmailAgent

**Impact:** Missing email outreach opportunities for leads with both phone and email

---

## Changes Applied

### Change 1: Remove Phone Restriction (Line 206)
**Before:**
```typescript
if (isAllowedUser && !specificPhone) {
  tags.push('ai outreach');
}
```

**After:**
```typescript
if (isAllowedUser) {
  tags.push('ai outreach'); // Enable AI email outreach (EMAIL ONLY - no SMS)
}
```

### Change 2: Remove SMS Queue Addition (Lines 367-382)
**Removed:**
- SMS queue item creation for phone numbers
- `contactPhone` entries in OutreachQueue

**Kept:**
- Email queue item creation (lines 384-407)
- All email addresses added to queue

---

## Result

**For ALL skip traced leads (AI plan users):**
- ✅ Get "ai outreach" tag in GHL (with or without phones)
- ✅ Email addresses added to OutreachQueue
- ✅ Phone numbers NOT added to OutreachQueue
- ✅ dailyEmailAgent sends emails (7-touch cadence)
- ✅ Chatbot responds to email replies only
- ✅ No SMS messages sent by chatbot

---

## Testing

### Test Case 1: Lead with Phone + Email
1. Sync lead with both phone and email
2. Verify "ai outreach" tag in GHL
3. Check OutreachQueue has email entry (no SMS)
4. Wait for dailyEmailAgent (runs hourly)
5. Verify email sent

### Test Case 2: Existing Contact Fix
For contact `b7UCMwtBKmZewpODX0Gv`:
1. Manually add "ai outreach" tag in GHL
2. Manually add to OutreachQueue (email only)
3. Wait for dailyEmailAgent
4. Verify email sent

---

## Deployment

```bash
git add amplify/functions/manualGhlSync/integrations/gohighlevel.ts docs/
git commit -m "fix: enable AI email outreach for all leads (disable SMS)

- Remove phone restriction from ai outreach tag
- All skip traced leads now get ai outreach tag
- Only emails added to OutreachQueue (no SMS)
- Chatbot will only email, never text
- Fixes missing email outreach for leads with phones"

git push origin main
```

---

## Monitoring

**CloudWatch Logs - Look for:**
```
✅ Added email user@example.com to outreach queue
```

**Should NOT see:**
```
✅ Added phone (XXX) XXX-XXXX to outreach queue
```

---

**Status:** ✅ Changes applied, ready for testing  
**Next:** Deploy to sandbox and verify behavior

---

## Backfilling Existing Contacts

### Problem
Contacts synced BEFORE this fix won't have:
- "ai outreach" tag in GHL
- Email entries in OutreachQueue

### Solution
Run the backfill script to update existing contacts:

```bash
# Install dependencies if needed
npm install

# Set environment variables
export AMPLIFY_DATA_OutreachQueue_TABLE_NAME="OutreachQueue-<your-suffix>"
export GHL_API_KEY="pit-a975757c-04a0-446d-a23b-3ef1050ae32a"

# Run backfill script
npx tsx scripts/backfill-ai-outreach.ts
```

### What the Script Does
1. Scans PropertyLead table for leads with `ghlContactId` + emails
2. Checks each GHL contact for "ai outreach" tag
3. If missing:
   - Adds "ai outreach" tag to GHL contact
   - Adds email entries to OutreachQueue
4. Rate limited: 2 seconds between contacts

### Expected Output
```
🔍 Scanning for leads with ghlContactId + emails...
📊 Found 150 synced leads with emails
✅ Added "ai outreach" tag to b7UCMwtBKmZewpODX0Gv
✅ Added user@example.com to OutreachQueue
...
📊 Backfill Complete:
   Processed: 150 leads
   Tagged: 120 contacts
   Queued: 180 emails
```

### Manual Alternative (Single Contact)
For contact `b7UCMwtBKmZewpODX0Gv`:

1. **Add tag in GHL:**
   - Go to contact in GHL
   - Add tag: `ai outreach`

2. **Add to OutreachQueue manually:**
   ```bash
   aws dynamodb put-item \
     --table-name OutreachQueue-<suffix> \
     --item '{
       "id": {"S": "manual_b7UCMwtBKmZewpODX0Gv_email"},
       "userId": {"S": "44d8f4c8-10c1-7038-744b-271103170819"},
       "locationId": {"S": "mHaAy3ZaUHgrbPyughDG"},
       "contactId": {"S": "b7UCMwtBKmZewpODX0Gv"},
       "contactEmail": {"S": "contact-email@example.com"},
       "queueStatus": {"S": "OUTREACH"},
       "emailStatus": {"S": "PENDING"},
       "emailAttempts": {"N": "0"},
       "nextEmailDate": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"},
       "createdAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"},
       "updatedAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
     }'
   ```

---
