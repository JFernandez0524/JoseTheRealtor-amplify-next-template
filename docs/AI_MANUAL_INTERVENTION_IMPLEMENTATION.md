# AI Manual Intervention Detection - Implementation Summary

**Date:** 2026-03-09  
**Status:** ✅ Complete - Ready for Testing

---

## Problem Solved

AI was responding to every message in active conversations, even when the agent was manually engaged with leads. This created confusion during real-time conversations (e.g., discussing meeting times, answering questions about traffic, writing haikus).

**Root Cause:** Previous implementation had:
- 5-minute detection window (too short for real conversations)
- Unreliable AI pattern matching
- No persistent state (tag-based)
- No auto-resume logic

---

## Solution Implemented

**Hybrid Auto-Detection System:**
1. **30-minute activity window** - Detects ANY outbound message in last 30 minutes
2. **Persistent state** - Uses `conversation:manual` tag for reliability
3. **Fast path check** - Checks tag first (no API calls if already in manual mode)
4. **Auto-resume** - Removes tag after 24 hours of complete inactivity
5. **Visibility** - Adds timestamped notes in GHL when mode changes

---

## Files Created

### 1. Conversation Activity Checker
**File:** `amplify/functions/shared/conversationActivity.ts`

**Functions:**
- `checkRecentActivity(conversationId, token, windowMinutes)` - Checks for recent outbound messages
- `activateManualMode(contactId, token, reason)` - Enables manual mode with tag and note

**Features:**
- Fetches last 20 messages from GHL
- Filters for outbound messages within time window
- Returns activity timestamps for decision making
- Updates OutreachQueue status to `MANUAL_HANDLING`

### 2. Auto-Resume Lambda
**File:** `amplify/functions/checkManualModeExpiry/handler.ts`  
**Resource:** `amplify/functions/checkManualModeExpiry/resource.ts`

**Schedule:** Runs every hour via EventBridge

**Workflow:**
1. Query all GHL integrations
2. For each integration, find contacts with `conversation:manual` tag
3. Check conversation history for activity in last 24 hours
4. If no activity, remove tag and add note
5. Reset OutreachQueue status to `CONVERSATION`

**Permissions:**
- Read/Write access to GhlIntegration table
- Read/Write access to OutreachQueue table

---

## Files Modified

### 1. Webhook Handler
**File:** `amplify/functions/ghlWebhookHandler/handler.ts`

**Changes:**
- Replaced lines 390-470 (old manual detection logic)
- Added fast path check for `conversation:manual` tag
- Added 30-minute activity window check
- Calls `activateManualMode()` when recent activity detected
- Returns early with 200 status (no AI response)

**Old Logic:**
```typescript
// 5-minute window + AI pattern matching
const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
const isFromAI = messageBody.includes('jose from re/max') || ...
```

**New Logic:**
```typescript
// Fast path: Check tag first
if (isManualHandling) { return early }

// Auto-detect: 30-minute window
const activity = await checkRecentActivity(conversationId, token, 30);
if (activity.hasRecentOutbound) {
  await activateManualMode(contactId, token);
  return early;
}
```

### 2. Backend Configuration
**File:** `amplify/backend.ts`

**Changes:**
- Added import for `checkManualModeExpiry`
- Added to backend definition
- Added DynamoDB permissions (GhlIntegration, OutreachQueue)
- Added environment variables

### 3. Data Schema
**File:** `amplify/data/resource.ts`

**Changes:**
- Added `MANUAL_HANDLING` to `queueStatus` enum
- New enum: `['OUTREACH', 'CONVERSATION', 'DND', 'WRONG_INFO', 'COMPLETED', 'MANUAL_HANDLING']`

### 4. Outreach Queue Utility
**File:** `amplify/functions/shared/outreachQueue.ts`

**Changes:**
- Updated `updateQueueStatus()` type signature to include `MANUAL_HANDLING`

---

## How It Works

### Scenario 1: Agent Starts Manual Conversation

1. **Lead sends message** → GHL webhook fires
2. **Webhook handler checks** for `conversation:manual` tag → Not found
3. **Activity check** runs → Finds agent's recent outbound message (within 30 min)
4. **Manual mode activated:**
   - Adds `conversation:manual` tag
   - Adds note: "🤖 AI paused - manual conversation detected at [timestamp]"
   - Updates OutreachQueue status to `MANUAL_HANDLING`
5. **AI skips response** → Returns 200 status
6. **Agent continues conversation** without AI interference

### Scenario 2: Conversation Goes Cold

1. **24 hours pass** with no messages from either side
2. **Hourly Lambda runs** → Finds contact with `conversation:manual` tag
3. **Activity check** runs → No activity in last 24 hours
4. **Manual mode deactivated:**
   - Removes `conversation:manual` tag
   - Adds note: "🤖 AI resumed - no activity for 24 hours (timestamp)"
   - Updates OutreachQueue status to `CONVERSATION`
5. **AI can respond again** to future messages

### Scenario 3: Lead Replies During Manual Mode

1. **Lead sends message** → GHL webhook fires
2. **Webhook handler checks** for `conversation:manual` tag → Found!
3. **Fast path exit** → Returns 200 status immediately (no API calls)
4. **AI skips response** → Agent handles manually

---

## Testing Checklist

### Unit Tests (Manual)
- [ ] `checkRecentActivity()` correctly identifies outbound messages
- [ ] `checkRecentActivity()` respects time window (30 min)
- [ ] `activateManualMode()` adds tag and note
- [ ] `activateManualMode()` updates OutreachQueue status

### Integration Tests (Sandbox)
- [ ] Send manual message to lead → AI stops responding
- [ ] Check GHL for `conversation:manual` tag
- [ ] Check GHL for timestamped note
- [ ] Lead replies → AI still doesn't respond (fast path)
- [ ] Wait 24 hours (or manually trigger Lambda) → Tag removed
- [ ] Lead replies again → AI responds normally

### Production Tests
- [ ] Monitor CloudWatch logs for manual mode activations
- [ ] Verify no AI responses during active conversations
- [ ] Verify auto-resume after 24h inactivity
- [ ] Check OutreachQueue status changes

---

## Deployment Steps

### 1. Deploy to Sandbox
```bash
# Load environment variables
set -a && source .env.local && set +a

# Start sandbox
npx ampx sandbox
```

### 2. Test Manual Mode Activation
```bash
# Send a manual message to a test lead in GHL
# Then have the lead reply
# Check CloudWatch logs for:
# - "🔍 [ACTIVITY] Checking last 30 minutes..."
# - "📤 [ACTIVITY] Found recent outbound message..."
# - "🤚 [MANUAL_MODE] Activating for contact..."
# - "✅ [MANUAL_MODE] Added conversation:manual tag"
```

### 3. Test Auto-Resume
```bash
# Manually trigger the Lambda (or wait 1 hour)
aws lambda invoke \
  --function-name <checkManualModeExpiry-function-name> \
  --payload '{}' \
  response.json

# Check CloudWatch logs for:
# - "🔄 [EXPIRY_CHECK] Starting manual mode expiry check"
# - "✅ [EXPIRY_CHECK] Resuming AI for contact..."
```

### 4. Deploy to Production
```bash
git add .
git commit -m "feat: add AI manual intervention detection with 30-min window and auto-resume"
git push origin main
```

---

## Configuration

### Time Windows (Adjustable)

**Manual Detection Window:** 30 minutes
- Location: `ghlWebhookHandler/handler.ts` line ~410
- Change: `await checkRecentActivity(conversationId, token, 30)` → Adjust number

**Auto-Resume Window:** 24 hours
- Location: `checkManualModeExpiry/handler.ts` line ~120
- Change: `await checkRecentActivity(conversationId, token, 24 * 60)` → Adjust number

**Lambda Schedule:** Every 1 hour
- Location: `checkManualModeExpiry/resource.ts` line 9
- Change: `schedule: 'every 1h'` → Adjust schedule

### GHL Tags

**Manual Mode Tag:** `conversation:manual`
- Added when manual activity detected
- Removed after 24h inactivity
- Can be manually added/removed in GHL

---

## Monitoring

### CloudWatch Logs

**Webhook Handler:**
- Log Group: `/aws/lambda/ghlWebhookHandler`
- Search: `[ACTIVITY]` or `[MANUAL_MODE]`

**Auto-Resume Lambda:**
- Log Group: `/aws/lambda/checkManualModeExpiry`
- Search: `[EXPIRY_CHECK]`

### Key Metrics to Track

1. **Manual Mode Activations** - Count of `[MANUAL_MODE] Activating` logs
2. **Auto-Resumes** - Count of `[EXPIRY_CHECK] Resuming AI` logs
3. **Fast Path Hits** - Count of `conversation:manual tag - skipping` logs
4. **Activity Checks** - Count of `[ACTIVITY] Checking last` logs

---

## Future Enhancements

### Potential Improvements

1. **Dashboard UI** (Task 5 - Not Yet Implemented)
   - Add `conversation:manual` tag filter
   - Show 🤚 icon for contacts in manual mode
   - Add "Resume AI" button to manually remove tag

2. **Configurable Time Windows**
   - Add settings in Profile page
   - Store in UserAccount table
   - Pass to Lambda via environment variables

3. **Manual Mode Analytics**
   - Track average manual conversation duration
   - Track auto-resume success rate
   - Dashboard widget showing manual mode contacts

4. **Smart Resume Logic**
   - Resume only during business hours
   - Resume with gentle re-engagement message
   - Resume based on conversation sentiment

---

## Rollback Plan

If issues occur in production:

### Quick Rollback
```bash
# Revert to previous commit
git revert HEAD
git push origin main
```

### Manual Cleanup
```bash
# Remove all conversation:manual tags in GHL
# (Use GHL bulk tag removal feature)

# Disable Lambda schedule temporarily
aws events disable-rule --name <rule-name>
```

### Emergency Fix
```bash
# Disable manual detection entirely
# Comment out lines 390-420 in ghlWebhookHandler/handler.ts
# Deploy hotfix
```

---

## Success Criteria

✅ **Primary Goal:** AI stops responding during active manual conversations  
✅ **Secondary Goal:** AI auto-resumes after conversations go cold  
✅ **Tertiary Goal:** No breaking changes to existing AI functionality

**Metrics:**
- Zero AI responses during active manual conversations (100% success rate)
- Auto-resume within 1 hour of 24h inactivity threshold
- No increase in webhook errors or timeouts

---

## Notes

- Manual mode is per-contact, not per-conversation
- Tag persists across all channels (SMS, email, Facebook, Instagram, WhatsApp)
- Agent can manually add/remove `conversation:manual` tag in GHL anytime
- OutreachQueue status prevents daily agents from targeting manual mode contacts
- Fast path check (tag-based) prevents unnecessary API calls

---

## Contact

For questions or issues:
- Check CloudWatch logs first
- Review this document for configuration options
- Test in sandbox before production changes
