# ✅ GHL Sync Fix - Ready for Testing

## 🎯 Status
- ✅ Code changes applied to `amplify/functions/manualGhlSync/handler.ts`
- ✅ Sandbox already running (PID 1350609) with function logs streaming
- ✅ Changes will auto-deploy when sandbox detects file changes

## 📋 What Changed

### Phone Sync (Lines 105-135)
- Saves `ghlContactId` IMMEDIATELY after first phone syncs successfully
- Graceful degradation: Returns SUCCESS even if additional phones fail
- New log: `✅ Saved primary contactId {id} to database`

### Email-Only Sync (Lines 137-160)  
- Added explicit logging after database save
- New log: `✅ Saved contactId {id} to database`

## 🧪 How to Test

### Option 1: Use Dashboard (Recommended)
1. Open http://localhost:3000
2. Go to dashboard
3. Find any lead with phone number(s)
4. Click "Sync to GHL" button
5. Watch terminal for logs (already streaming)
6. Look for: `✅ Saved primary contactId`

### Option 2: Check Existing Leads
```bash
# Production table (has real data)
aws dynamodb scan \
  --table-name "PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE" \
  --filter-expression "attribute_exists(ownerPhone1)" \
  --limit 5 \
  --query 'Items[*].{id:id.S,name:ownerFirstName.S,phone:ownerPhone1.S,status:ghlSyncStatus.S}'
```

### Option 3: Manual Test Lead
```bash
# Find the Colangelo lead we fixed earlier
aws dynamodb get-item \
  --table-name "PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE" \
  --key '{"id": {"S": "ec12df25-ebaf-4b84-b053-4e156de7414e"}}' \
  --query 'Item.{id:id.S,name:ownerFirstName.S,status:ghlSyncStatus.S,contactId:ghlContactId.S}'
```

## 🔍 What to Look For

### In Terminal (Function Logs)
```
✅ Saved primary contactId CtyLHzNgvFa1k59esUlR to database (before processing remaining phones)
```

### In Database (After Sync)
```json
{
  "id": "lead-id",
  "status": "SUCCESS",
  "contactId": "GHL_CONTACT_ID"
}
```

### If Multi-Phone Fails
```
⚠️ Error syncing additional phones, but primary contact CtyLHzNgvFa1k59esUlR was saved
```

## 📊 Available Tables

1. **PropertyLead-agvn6x56rbhuxguajdscu5acju-NONE** (sandbox)
2. **PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE** (production - has real data)
3. **PropertyLead-ibfu72amlnckpljyinorjdhofi-NONE** (unknown)

## ⏭️ Next Steps

1. **Test in dashboard** - Sync a lead and verify logs
2. **Check database** - Confirm contactId is saved
3. **Deploy to production** - If tests pass:
   ```bash
   git add amplify/functions/manualGhlSync/handler.ts docs/
   git commit -m "fix: save ghlContactId immediately after GHL contact creation"
   git push origin main
   ```

## 📝 Testing Checklist

- [ ] Single phone lead syncs successfully
- [ ] Multi-phone lead saves primary contactId before processing additional phones
- [ ] Email-only lead syncs successfully
- [ ] CloudWatch logs show "Saved contactId" messages
- [ ] Database has contactId even if queue operations fail
- [ ] No FAILED status when contact exists in GHL

## 🚨 Monitoring

Sandbox is already streaming function logs. Watch for:
- `✅ Saved primary contactId` - Success!
- `⚠️ Error syncing additional phones, but primary contact X was saved` - Graceful degradation working
- Any errors during sync

## 📚 Documentation

- Full implementation: `docs/GHL_SYNC_FIX_2026-03-09.md`
- Testing guide: `./test-ghl-sync.sh`
