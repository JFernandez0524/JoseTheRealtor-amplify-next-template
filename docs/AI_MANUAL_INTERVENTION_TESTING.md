# AI Manual Intervention - Testing Guide

## Quick Test Scenarios

### Scenario 1: Manual Mode Activation

**Setup:**
1. Find a test lead in GHL with "ai outreach" tag
2. Open conversation in GHL

**Test Steps:**
1. Send a manual message from GHL (e.g., "Hey, are you available for a call?")
2. Wait 10 seconds
3. Have the lead reply (or simulate reply from another phone)
4. Check CloudWatch logs for webhook handler

**Expected Results:**
- ✅ CloudWatch shows: `🔍 [ACTIVITY] Checking last 30 minutes...`
- ✅ CloudWatch shows: `📤 [ACTIVITY] Found recent outbound message...`
- ✅ CloudWatch shows: `🤚 [MANUAL_MODE] Activating for contact...`
- ✅ CloudWatch shows: `✅ [MANUAL_MODE] Added conversation:manual tag`
- ✅ GHL contact has `conversation:manual` tag
- ✅ GHL contact has note: "🤖 AI paused - manual conversation detected at [timestamp]"
- ✅ AI does NOT send a response

**CloudWatch Query:**
```
fields @timestamp, @message
| filter @message like /ACTIVITY|MANUAL_MODE/
| sort @timestamp desc
| limit 20
```

---

### Scenario 2: Fast Path (Already in Manual Mode)

**Setup:**
1. Use same contact from Scenario 1 (should have `conversation:manual` tag)

**Test Steps:**
1. Have the lead send another message
2. Check CloudWatch logs

**Expected Results:**
- ✅ CloudWatch shows: `🚫 [WEBHOOK_LAMBDA] Contact has conversation:manual tag - skipping AI response`
- ✅ No activity check performed (fast path)
- ✅ AI does NOT send a response
- ✅ Response time < 200ms (no API calls)

---

### Scenario 3: Auto-Resume After 24h

**Setup:**
1. Contact with `conversation:manual` tag
2. No messages for 24+ hours

**Test Steps (Manual Trigger):**
```bash
# Get Lambda function name
aws lambda list-functions --query "Functions[?contains(FunctionName, 'checkManualModeExpiry')].FunctionName" --output text

# Invoke Lambda
aws lambda invoke \
  --function-name <function-name-from-above> \
  --payload '{}' \
  response.json

# Check response
cat response.json
```

**Expected Results:**
- ✅ CloudWatch shows: `🔄 [EXPIRY_CHECK] Starting manual mode expiry check`
- ✅ CloudWatch shows: `✅ [EXPIRY_CHECK] Resuming AI for contact...`
- ✅ GHL contact NO LONGER has `conversation:manual` tag
- ✅ GHL contact has note: "🤖 AI resumed - no activity for 24 hours (timestamp)"
- ✅ Next lead message triggers AI response

**CloudWatch Query:**
```
fields @timestamp, @message
| filter @message like /EXPIRY_CHECK/
| sort @timestamp desc
| limit 20
```

---

### Scenario 4: AI Resumes Normally

**Setup:**
1. Contact from Scenario 3 (tag removed)

**Test Steps:**
1. Have the lead send a message
2. Check CloudWatch logs
3. Check GHL conversation

**Expected Results:**
- ✅ No manual mode detection (no recent outbound)
- ✅ AI generates and sends response
- ✅ Response appears in GHL conversation

---

## Edge Cases to Test

### Edge Case 1: Multiple Rapid Messages

**Test:**
1. Agent sends message
2. Lead replies immediately (< 5 seconds)
3. Agent sends another message
4. Lead replies again

**Expected:**
- Manual mode activated on first lead reply
- All subsequent lead replies skip AI (fast path)

---

### Edge Case 2: 29-Minute Gap

**Test:**
1. Agent sends message
2. Wait 29 minutes
3. Lead replies

**Expected:**
- Manual mode activated (within 30-minute window)

---

### Edge Case 3: 31-Minute Gap

**Test:**
1. Agent sends message
2. Wait 31 minutes
3. Lead replies

**Expected:**
- Manual mode NOT activated (outside 30-minute window)
- AI responds normally

---

### Edge Case 4: Manual Tag Removal

**Test:**
1. Contact in manual mode
2. Manually remove `conversation:manual` tag in GHL
3. Lead sends message

**Expected:**
- AI responds normally (no tag = no manual mode)

---

## Performance Benchmarks

### Webhook Response Times

**Without Manual Mode:**
- Average: 2-3 seconds (includes AI generation)

**With Manual Mode (Fast Path):**
- Average: < 200ms (tag check only)

**With Manual Mode (Activity Check):**
- Average: 500-800ms (includes GHL API call)

---

## Monitoring Queries

### Count Manual Mode Activations (Last 24h)
```
fields @timestamp
| filter @message like /MANUAL_MODE.*Activating/
| stats count() as activations by bin(1h)
```

### Count Auto-Resumes (Last 7 days)
```
fields @timestamp
| filter @message like /EXPIRY_CHECK.*Resuming/
| stats count() as resumes by bin(1d)
```

### Fast Path Hit Rate
```
fields @timestamp
| filter @message like /conversation:manual tag - skipping/
| stats count() as fast_path_hits by bin(1h)
```

### Average Activity Check Time
```
fields @timestamp, @message
| filter @message like /ACTIVITY.*Checking/
| parse @message /duration: (?<duration>\d+)ms/
| stats avg(duration) as avg_duration_ms
```

---

## Troubleshooting

### Issue: Manual mode not activating

**Check:**
1. Is there an outbound message in last 30 minutes?
2. Is the conversation ID valid?
3. Are GHL API credentials valid?
4. Check CloudWatch for errors

**Debug:**
```bash
# Check recent messages in conversation
curl -X GET "https://services.leadconnectorhq.com/conversations/{conversationId}/messages?limit=20" \
  -H "Authorization: Bearer {token}" \
  -H "Version: 2021-07-28"
```

---

### Issue: Auto-resume not working

**Check:**
1. Is Lambda running on schedule? (Check EventBridge rules)
2. Are there any Lambda errors? (Check CloudWatch)
3. Is the contact actually inactive for 24h?
4. Does Lambda have DynamoDB permissions?

**Debug:**
```bash
# Check Lambda schedule
aws events list-rules --query "Rules[?contains(Name, 'checkManualModeExpiry')]"

# Check Lambda logs
aws logs tail /aws/lambda/checkManualModeExpiry --follow
```

---

### Issue: AI still responding during manual mode

**Check:**
1. Does contact have `conversation:manual` tag?
2. Is webhook handler using latest code?
3. Check CloudWatch for fast path logs

**Debug:**
```bash
# Check contact tags
curl -X GET "https://services.leadconnectorhq.com/contacts/{contactId}" \
  -H "Authorization: Bearer {token}" \
  -H "Version: 2021-07-28" \
  | jq '.contact.tags'
```

---

## Success Criteria

✅ **Manual mode activates** when agent sends message within 30 minutes  
✅ **Fast path works** - subsequent messages skip activity check  
✅ **Auto-resume works** - tag removed after 24h inactivity  
✅ **No breaking changes** - existing AI functionality unchanged  
✅ **Performance acceptable** - webhook response time < 1 second

---

## Rollback Procedure

If critical issues occur:

```bash
# 1. Revert code
git revert HEAD
git push origin main

# 2. Remove all manual tags (in GHL)
# Use bulk tag removal feature

# 3. Disable Lambda schedule
aws events disable-rule --name <rule-name>

# 4. Monitor for 1 hour
# Verify AI responding normally
```
