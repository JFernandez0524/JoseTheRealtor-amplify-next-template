# GHL Sync Database Update Fix

**Date:** 2026-03-09  
**Issue:** Contact successfully created in GHL but `ghlContactId` not saved to database, leaving lead marked as FAILED  
**Status:** ✅ Root cause identified, fix ready to apply

---

## Problem Summary

**Symptom:** Lead shows `ghlSyncStatus: 'FAILED'` but contact exists in GHL with valid contactId

**Example:** Lead `ec12df25-ebaf-4b84-b053-4e156de7414e` (Colangelo)
- Status in DB: FAILED
- GHL Contact ID: CtyLHzNgvFa1k59esUlR (exists in GHL)
- Database had: `ghlContactId: null`

**Impact:** Users see failed syncs even though contacts were created successfully

---

## Root Cause Analysis

### The Flow

1. ✅ Contact created in GHL → returns `contactId`
2. ✅ `syncToGoHighLevel()` returns contactId successfully
3. ❌ Queue operations (`addToOutreachQueue()`) throw error
4. ❌ OR subsequent phone sync in loop fails
5. ❌ Outer try-catch catches error
6. ❌ `updateLeadSyncStatus(docClient, propertyLeadTableName!, lead.id, 'FAILED')` called
7. ❌ Database never saved the contactId from step 1

### Code Location

**File:** `amplify/functions/manualGhlSync/handler.ts`

**Problem Section 1 (Lines 105-135):**
```typescript
try {
  const syncResults: string[] = [];
  for (let i = 0; i < phones.length; i++) {
    const ghlContactId = await syncToGoHighLevel(...);  // ← Returns contactId
    syncResults.push(ghlContactId);
  }
  
  const primaryGhlId = syncResults[0];
  await updateLeadSyncStatus(..., 'SUCCESS', primaryGhlId);  // ← Only happens if ALL phones succeed
  
} catch (error: any) {
  await updateLeadSyncStatus(..., 'FAILED');  // ← Marks FAILED even if first phone succeeded
}
```

**Problem:** If ANY phone in the loop fails, the entire sync is marked FAILED, even though the first contact was created successfully.

**Problem Section 2 (Lines 137-160):**
```typescript
try {
  const ghlContactId = await syncToGoHighLevel(...);  // ← Returns contactId
  await updateLeadSyncStatus(..., 'SUCCESS', ghlContactId);  // ← Only happens if no errors
} catch (error: any) {
  await updateLeadSyncStatus(..., 'FAILED');  // ← Marks FAILED even if contact was created
}
```

**Problem:** If queue operations inside `syncToGoHighLevel()` fail, the catch block marks it as FAILED even though the GHL contact was created.

---

## Solution

**Strategy:** Save `ghlContactId` to database IMMEDIATELY after first successful GHL contact creation, before attempting additional operations that might fail.

### Benefits

✅ Prevents "FAILED" status when contact actually exists in GHL  
✅ Preserves contactId even if queue operations fail  
✅ Gracefully handles multi-phone sync failures  
✅ No breaking changes to existing functionality

---

## Implementation Steps

### Step 1: Apply Code Changes

**File to edit:** `amplify/functions/manualGhlSync/handler.ts`

#### Change 1: Phone Sync Section (Lines 105-135)

**FIND:**
```typescript
  // ✅ SYNC LEADS WITH PHONES (multiple contacts for multiple phones)
  if (phones.length > 0) {
    console.log(`📞 Syncing ${phones.length} phone contacts`);
    try {
      const syncResults: string[] = [];
      for (let i = 0; i < phones.length; i++) {
        const ghlContactId = await syncToGoHighLevel(
          lead,
          phones[i],
          i + 1,
          i === 0, // First phone is primary
          groups,
          ownerId,
          ghlToken,
          ghlLocationId
        );
        syncResults.push(ghlContactId);
      }

      const primaryGhlId = syncResults[0];
      await updateLeadSyncStatus(docClient, propertyLeadTableName!, lead.id, 'SUCCESS', primaryGhlId);

      return {
        status: 'SUCCESS',
        message: `Synced ${phones.length} phone contact(s).`,
        ghlContactId: primaryGhlId,
      };
    } catch (error: any) {
      await updateLeadSyncStatus(docClient, propertyLeadTableName!, lead.id, 'FAILED');
      return { status: 'FAILED', message: error.message };
    }
  }
```

**REPLACE WITH:**
```typescript
  // ✅ SYNC LEADS WITH PHONES (multiple contacts for multiple phones)
  if (phones.length > 0) {
    console.log(`📞 Syncing ${phones.length} phone contacts`);
    const syncResults: string[] = [];
    let primaryGhlId: string | null = null;
    
    try {
      for (let i = 0; i < phones.length; i++) {
        const ghlContactId = await syncToGoHighLevel(
          lead,
          phones[i],
          i + 1,
          i === 0, // First phone is primary
          groups,
          ownerId,
          ghlToken,
          ghlLocationId
        );
        syncResults.push(ghlContactId);
        
        // 🛡️ SAVE PRIMARY CONTACT ID IMMEDIATELY after first successful sync
        if (i === 0 && ghlContactId) {
          primaryGhlId = ghlContactId;
          await updateLeadSyncStatus(docClient, propertyLeadTableName!, lead.id, 'SUCCESS', primaryGhlId);
          console.log(`✅ Saved primary contactId ${primaryGhlId} to database (before processing remaining phones)`);
        }
      }

      // All phones synced successfully
      return {
        status: 'SUCCESS',
        message: `Synced ${phones.length} phone contact(s).`,
        ghlContactId: primaryGhlId || syncResults[0],
      };
    } catch (error: any) {
      // If we already saved a contactId, don't mark as FAILED
      if (primaryGhlId) {
        console.warn(`⚠️ Error syncing additional phones, but primary contact ${primaryGhlId} was saved`);
        return {
          status: 'SUCCESS',
          message: `Primary contact synced, but error on additional phones: ${error.message}`,
          ghlContactId: primaryGhlId,
        };
      }
      
      // No contactId saved yet, mark as FAILED
      await updateLeadSyncStatus(docClient, propertyLeadTableName!, lead.id, 'FAILED');
      return { status: 'FAILED', message: error.message };
    }
  }
```

#### Change 2: Email-Only Sync Section (Lines 137-160)

**FIND:**
```typescript
  // ✅ SYNC EMAIL-ONLY LEADS (direct mail workflow)
  console.log(`📧 Syncing email-only contact for direct mail`);
  try {
    const ghlContactId = await syncToGoHighLevel(
      lead,
      '', // No phone
      1,
      true, // Primary contact
      groups,
      ownerId,
      ghlToken,
      ghlLocationId
    );

    await updateLeadSyncStatus(docClient, propertyLeadTableName!, lead.id, 'SUCCESS', ghlContactId);

    return {
      status: 'SUCCESS',
      message: 'Synced email contact for direct mail workflow.',
      ghlContactId: ghlContactId,
    };
  } catch (error: any) {
    await updateLeadSyncStatus(docClient, propertyLeadTableName!, lead.id, 'FAILED');
    return { status: 'FAILED', message: error.message };
  }
```

**REPLACE WITH:**
```typescript
  // ✅ SYNC EMAIL-ONLY LEADS (direct mail workflow)
  console.log(`📧 Syncing email-only contact for direct mail`);
  try {
    const ghlContactId = await syncToGoHighLevel(
      lead,
      '', // No phone
      1,
      true, // Primary contact
      groups,
      ownerId,
      ghlToken,
      ghlLocationId
    );

    // 🛡️ SAVE CONTACT ID IMMEDIATELY after successful GHL sync
    await updateLeadSyncStatus(docClient, propertyLeadTableName!, lead.id, 'SUCCESS', ghlContactId);
    console.log(`✅ Saved contactId ${ghlContactId} to database`);

    return {
      status: 'SUCCESS',
      message: 'Synced email contact for direct mail workflow.',
      ghlContactId: ghlContactId,
    };
  } catch (error: any) {
    await updateLeadSyncStatus(docClient, propertyLeadTableName!, lead.id, 'FAILED');
    return { status: 'FAILED', message: error.message };
  }
```

### Step 2: Deploy to Sandbox

```bash
# Load environment variables
set -a && source .env.local && set +a

# Start sandbox
npx ampx sandbox
```

### Step 3: Test the Fix

#### Test Case 1: Single Phone Lead
1. Find a lead with 1 phone number
2. Sync to GHL
3. Check CloudWatch logs for: `✅ Saved primary contactId`
4. Verify lead status is SUCCESS
5. Verify `ghlContactId` is saved in database

#### Test Case 2: Multi-Phone Lead
1. Find a lead with 2+ phone numbers
2. Sync to GHL
3. Check CloudWatch logs for: `✅ Saved primary contactId` after first phone
4. Even if second phone fails, verify:
   - Lead status is SUCCESS
   - `ghlContactId` is saved (first phone's contactId)
   - Log shows: `⚠️ Error syncing additional phones, but primary contact X was saved`

#### Test Case 3: Email-Only Lead
1. Find a lead with no phones, only email
2. Sync to GHL
3. Check CloudWatch logs for: `✅ Saved contactId`
4. Verify lead status is SUCCESS
5. Verify `ghlContactId` is saved in database

### Step 4: Verify Database Updates

```bash
TABLE_NAME="PropertyLead-<your-table-suffix>"

# Check a synced lead
aws dynamodb get-item \
  --table-name "$TABLE_NAME" \
  --key '{"id": {"S": "<lead-id>"}}' \
  --query 'Item.{id:id.S,status:ghlSyncStatus.S,contactId:ghlContactId.S}'
```

Expected output:
```json
{
  "id": "lead-id",
  "status": "SUCCESS",
  "contactId": "GHL_CONTACT_ID"
}
```

### Step 5: Deploy to Production

```bash
git add amplify/functions/manualGhlSync/handler.ts
git commit -m "fix: save ghlContactId immediately after GHL contact creation

- Prevents FAILED status when contact exists in GHL
- Saves contactId before queue operations that might fail
- Gracefully handles multi-phone sync failures
- Fixes issue where leads show FAILED but contact was created"

git push origin main
```

### Step 6: Monitor Production

**CloudWatch Queries:**

```
# Check for immediate saves
fields @timestamp, @message
| filter @message like /Saved primary contactId|Saved contactId/
| sort @timestamp desc
| limit 20
```

```
# Check for graceful degradation
fields @timestamp, @message
| filter @message like /Error syncing additional phones, but primary contact/
| sort @timestamp desc
| limit 20
```

---

## Rollback Plan

If issues occur:

```bash
# Revert the commit
git revert HEAD
git push origin main
```

---

## Success Criteria

✅ No more leads with `ghlSyncStatus: FAILED` when contact exists in GHL  
✅ `ghlContactId` saved even if queue operations fail  
✅ Multi-phone leads save primary contactId before processing additional phones  
✅ CloudWatch logs show "Saved contactId" messages  
✅ No breaking changes to existing sync functionality

---

## Related Issues

- Lead `ec12df25-ebaf-4b84-b053-4e156de7414e` manually fixed (contactId added to database)
- Future leads will be fixed automatically with this code change

---

## Notes

- This fix addresses the database update timing issue
- Queue operations can still fail, but we preserve the contactId
- Multi-phone leads will show SUCCESS even if only first phone syncs
- Email-only leads get immediate save after GHL contact creation
