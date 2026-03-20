# Session Context - March 20, 2026

## Critical Issues Fixed Today

### 1. DynamoDB Index Name Mismatches (Root Cause) 🔧
**Problem:** Email outreach not working + call outcome sync failing for all leads

**Root Cause:** Schema defines index names differently than code uses them:
- Schema: `byUserAndSmsStatus`, `byUserAndEmailStatus`, `byLeadId`
- Code was using: `outreachQueuesByUserIdAndSmsStatus`, `outreachQueuesByUserIdAndEmailStatus`, `outreachQueuesByLeadId`

**Files Fixed:**
1. `amplify/functions/shared/outreachQueue.ts` (lines 134, 212)
   - Changed SMS index: `'outreachQueuesByUserIdAndSmsStatus'` → `'byUserAndSmsStatus'`
   - Changed Email index: `'outreachQueuesByUserIdAndEmailStatus'` → `'byUserAndEmailStatus'`

2. `amplify/functions/ghlFieldSyncHandler/handler.ts` (line 178)
   - Changed leadId index: `'outreachQueuesByLeadId'` → `'byLeadId'`

**Impact:**
- ✅ Email outreach queries will now find pending contacts
- ✅ Call outcome changes in GHL will sync to all related contacts
- ✅ Webhook response should show `updatedContacts > 0` instead of `0`

### 2. Test Case: Lead a0a5bda1-9aac-4ff6-bab8-c67131e0eb3b
**Symptoms:**
- Not receiving emails despite meeting all criteria
- Call outcome "Wrong Number" in GHL not reflecting in app

**GHL Contact ID:** `ZzYNIx5LDw0yQtmsF8DP`

**Webhook Response (before fix):**
```json
{
  "success": true,
  "message": "Disposition synced to all contacts",
  "contactId": "ZzYNIx5LDw0yQtmsF8DP",
  "disposition": "Wrong Number / Disconnected / Invalid Number",
  "updatedContacts": 0  // ❌ Should be > 0
}
```

**Webhook URL (confirmed correct):**
`https://xjiwzxgpa4nzpxdxjl5ib6xdom0gdtvx.lambda-url.us-east-1.on.aws/`

---

## Debug Endpoints Created

### 1. Check Lead in OutreachQueue
```
GET /api/v1/debug-lead-outreach?leadId=a0a5bda1-9aac-4ff6-bab8-c67131e0eb3b
```
Returns:
- Lead data from Lead table
- All OutreachQueue entries for this lead
- Email/SMS status for each entry

### 2. Check GHL Contact in OutreachQueue
```
GET /api/v1/debug-contact-queue?contactId=ZzYNIx5LDw0yQtmsF8DP
```
Returns:
- Whether contact exists in queue
- All queue entries for this contact
- leadId linkage

---

## Next Steps (After Deployment)

### 1. Deploy Fixes
```bash
git add .
git commit -m "Fix DynamoDB index name mismatches for outreach and field sync"
git push
```

### 2. Verify Email Outreach
- Wait for next business hour (Mon-Fri 9AM-7PM, Sat 9AM-12PM EST)
- Check CloudWatch logs for `dailyEmailAgent`
- Verify lead `a0a5bda1-9aac-4ff6-bab8-c67131e0eb3b` receives emails
- Use debug endpoint to confirm contact is in queue

### 3. Test Call Outcome Sync
- Change Call Outcome in GHL for contact `ZzYNIx5LDw0yQtmsF8DP`
- Check webhook response: `updatedContacts` should be > 0
- Verify change reflects in app UI
- Check CloudWatch logs for `ghlFieldSyncHandler`

### 4. Monitor Production
- Check for any DynamoDB query errors in CloudWatch
- Verify email agent finds contacts successfully
- Confirm call outcomes sync across related contacts

---

## Technical Context

### Schema Definition (amplify/data/resource.ts lines 64-67)
```typescript
.secondaryIndexes((index) => [
  index('userId').sortKeys(['smsStatus']).queryField('byUserAndSmsStatus'),
  index('userId').sortKeys(['emailStatus']).queryField('byUserAndEmailStatus'),
  index('userId').sortKeys(['queueStatus']).queryField('byUserAndQueueStatus'),
  index('leadId').queryField('byLeadId'),
])
```

### Affected Functions
- `getPendingSmsContacts()` - SMS outreach queries (FIXED)
- `getPendingEmailContacts()` - Email outreach queries (FIXED)
- `handleDisposition()` - Call outcome syncing (FIXED)

### User Context
- User has ADMINS group
- Admin ID: `44d8f4c8-10c1-7038-744b-271103170819`
- Lead meets all criteria: skip traced, has emails, proper access

---

## Files Modified

### Core Fixes
- `amplify/functions/shared/outreachQueue.ts` - Fixed 2 index names
- `amplify/functions/ghlFieldSyncHandler/handler.ts` - Fixed 1 index name

### Debug Tools
- `app/api/v1/debug-lead-outreach/route.ts` - NEW: Check lead in queue
- `app/api/v1/debug-contact-queue/route.ts` - NEW: Check GHL contact in queue
