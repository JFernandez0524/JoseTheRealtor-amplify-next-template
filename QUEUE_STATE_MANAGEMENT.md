# Queue State Management System

## Overview

The outreach queue now includes **lifecycle state management** to prevent duplicate messages, respect daily limits, and automatically handle lead responses.

## Queue Lifecycle States

| State | Description | Automated Drip | Manual Contact |
|-------|-------------|----------------|----------------|
| `OUTREACH` | Active outreach - receiving automated touches | ✅ Yes | ❌ No |
| `CONVERSATION` | Lead replied - AI is handling conversation | ❌ No | ❌ No |
| `DND` | Do Not Disturb - lead opted out | ❌ No | ❌ No |
| `WRONG_INFO` | Wrong number/email | ❌ No | ❌ No |
| `COMPLETED` | Deal closed or manually completed | ❌ No | ✅ Yes |

## Database Schema

### New Fields

```typescript
{
  // Lifecycle status
  queueStatus: 'OUTREACH' | 'CONVERSATION' | 'DND' | 'WRONG_INFO' | 'COMPLETED',
  
  // Tracking timestamps
  lastContactDate: datetime,    // Last time WE contacted them (any channel)
  lastLeadReplyDate: datetime,  // Last time THEY replied to us
  
  // Existing fields
  smsStatus: 'PENDING' | 'SENT' | 'REPLIED' | 'FAILED' | 'OPTED_OUT',
  emailStatus: 'PENDING' | 'SENT' | 'REPLIED' | 'BOUNCED' | 'FAILED' | 'OPTED_OUT',
  smsAttempts: number,
  emailAttempts: number,
  lastSmsSent: datetime,
  lastEmailSent: datetime,
}
```

## Webhook Decision Flow

### Phase 1: Identify Event Type

```
Parse webhook payload
  ↓
Check event type:
  ├─ EmailBounced? → handleEmailBounce()
  ├─ Message type 1 (Email)? → handleEmailReply()
  └─ Message types 2-5,18 (SMS/Social)? → Continue to Phase 2
```

### Phase 2: INBOUND Handling (Lead Replied)

```
1. IMMEDIATE ACTION: Update Database
   ├─ Set queueStatus = CONVERSATION
   ├─ Set lastLeadReplyDate = NOW()
   └─ This STOPS automated drip immediately
   
2. AI SENTIMENT ANALYSIS
   ├─ Analyze message intent
   └─ Classify as: STOP, WRONG_INFO, or CONVERSATION
   
3. Branch Based on Intent:
   
   A. Intent = STOP
      ├─ Update queueStatus = DND
      ├─ Log reason: "Lead requested to stop"
      └─ EXIT (no AI response)
   
   B. Intent = WRONG_INFO
      ├─ Update queueStatus = WRONG_INFO
      ├─ Log reason: "Wrong contact information"
      └─ EXIT (no AI response)
   
   C. Intent = CONVERSATION
      ├─ Keep queueStatus = CONVERSATION
      ├─ Generate AI response
      └─ Continue to Phase 3
```

### Phase 3: OUTBOUND Logging (We Sent Message)

```
After AI sends response:
  ├─ Update lastContactDate = NOW()
  └─ This prevents same-day duplicates
```

## Outreach Scheduler Logic

The daily/hourly outreach agents check these conditions **before** sending:

```typescript
For each lead in queue:
  
  1. Check Queue Status
     If (queueStatus != 'OUTREACH') {
       SKIP; // They're in conversation, DND, or wrong info
     }
  
  2. Check Daily Limit
     If (lastContactDate == TODAY) {
       SKIP; // We already contacted them today
     }
  
  3. Check Touch Limit
     If (smsAttempts >= 7 OR emailAttempts >= 7) {
       SKIP; // Reached max touches
     }
  
  4. Check Cadence
     If (daysSince(lastSmsSent) < 4 OR daysSince(lastEmailSent) < 4) {
       SKIP; // Not enough time since last touch
     }
  
  5. If All Checks Pass:
     ├─ Send message
     ├─ Update lastContactDate = NOW()
     ├─ Increment smsAttempts or emailAttempts
     └─ Update lastSmsSent or lastEmailSent
```

## AI Sentiment Analysis

### Intent Classification

The AI analyzes every inbound message and classifies intent:

**STOP Intent:**
- Keywords: "stop", "unsubscribe", "don't contact", "not interested", "remove me", "leave me alone"
- Action: Set `queueStatus = DND`
- Result: No more automated messages, no AI response

**WRONG_INFO Intent:**
- Keywords: "wrong number", "not me", "you have the wrong person", "incorrect email"
- Action: Set `queueStatus = WRONG_INFO`
- Result: No more automated messages, no AI response

**CONVERSATION Intent:**
- Everything else (questions, interest, neutral responses)
- Action: Keep `queueStatus = CONVERSATION`
- Result: Generate AI response, continue conversation

### Fallback Logic

If AI sentiment analysis fails, the system uses keyword matching:
- Detects "stop" keywords → STOP intent
- Detects "wrong" keywords → WRONG_INFO intent
- No negative keywords → CONVERSATION intent (default)

## State Transitions

```
OUTREACH
  ├─ Lead replies → CONVERSATION
  ├─ Lead says "stop" → DND
  ├─ Lead says "wrong number" → WRONG_INFO
  └─ 7 touches completed → Stays OUTREACH (but excluded from queue)

CONVERSATION
  ├─ Lead says "stop" → DND
  ├─ Lead says "wrong number" → WRONG_INFO
  └─ Manual completion → COMPLETED

DND
  └─ Terminal state (no transitions)

WRONG_INFO
  └─ Terminal state (no transitions)

COMPLETED
  └─ Terminal state (no transitions)
```

## Daily Limit Protection

### How It Works

1. **lastContactDate** tracks the last time we sent ANY message (SMS, email, social)
2. **Scheduler checks** if `lastContactDate == TODAY`
3. **If true**, contact is skipped for that day
4. **Next day**, contact becomes eligible again (if still in OUTREACH status)

### Example Timeline

```
Monday 9 AM:    Send Touch 1 → lastContactDate = Monday
Monday 10 AM:   Scheduler runs → SKIP (already contacted today)
Monday 11 AM:   Scheduler runs → SKIP (already contacted today)
...
Tuesday 9 AM:   Scheduler runs → ELIGIBLE (new day)
Tuesday 9 AM:   Send Touch 2 → lastContactDate = Tuesday
Tuesday 10 AM:  Scheduler runs → SKIP (already contacted today)
```

## Key Decision Points Table

| Check | Action if True | Action if False |
|-------|---------------|-----------------|
| Event == EmailBounced | Handle bounce | Continue |
| Message type == 1 | Handle email reply | Continue to SMS/Social |
| queueStatus != OUTREACH | Skip (not in outreach) | Continue |
| lastContactDate == TODAY | Skip (daily limit) | Continue |
| smsAttempts >= 7 | Skip (max touches) | Continue |
| AI Intent == STOP | Set DND, Exit | Continue |
| AI Intent == WRONG_INFO | Set WRONG_INFO, Exit | Continue |
| AI Intent == CONVERSATION | Generate AI response | N/A |
| Manual tag exists | Skip (manual mode) | Continue |

## Functions

### Queue Status Management

```typescript
// Move contact to CONVERSATION (stops drip)
await logInboundReply(queueId);

// Update queue status manually
await updateQueueStatus(queueId, 'DND', 'Lead requested to stop');

// Log outbound contact (daily limit)
await logOutboundContact(queueId);
```

### Sentiment Analysis

```typescript
const { analyzeLeadIntent } = await import('../shared/sentimentAnalysis');
const sentiment = await analyzeLeadIntent(messageBody);

if (sentiment.intent === 'STOP') {
  // Handle opt-out
}
```

## Monitoring

### Check Queue Status

```bash
npx tsx scripts/check-queue.ts
```

Shows breakdown by:
- Queue status (OUTREACH, CONVERSATION, DND, etc.)
- SMS status (PENDING, REPLIED, etc.)
- Email status (PENDING, REPLIED, BOUNCED, etc.)

### CloudWatch Logs

```bash
aws logs tail /aws/lambda/ghlWebhookHandler --follow
```

Look for:
- `[INBOUND]` - Lead replied
- `[OUTBOUND]` - We sent message
- `[SENTIMENT]` - AI intent classification
- `⏹️` - Contact skipped (with reason)

## Best Practices

1. **Never manually set queueStatus to OUTREACH** - Let the system manage it
2. **Check CloudWatch logs** to verify sentiment analysis is working
3. **Monitor DND rate** - High rate indicates messaging issues
4. **Review WRONG_INFO contacts** - May indicate data quality problems
5. **Use COMPLETED status** for closed deals to prevent re-outreach

## Migration

Existing queue items will default to `queueStatus = OUTREACH` automatically.

No data migration needed - new fields are optional and will be populated as contacts interact with the system.
