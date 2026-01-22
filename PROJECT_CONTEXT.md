# Project Context - JoseTheRealtor Platform

**Last Updated:** 2026-01-22 10:37 AM EST

## Current Status

### Recent Deployments (Today)
1. **Automated Email Outreach System** - DEPLOYED ✅
   - Daily email agent runs hourly during business hours
   - Uses AMMO framework (Hook-Relate-Bridge-Ask)
   - Sends to contacts with "ai outreach" tag
   - Email: jose.fernandez@JoseTheRealtor.com (HARDCODED - temporary)

2. **Business Hours Compliance** - DEPLOYED ✅
   - Mon-Fri: 9 AM - 7 PM EST
   - Saturday: 9 AM - 12 PM EST
   - Sunday: Closed
   - Both SMS and email agents respect these hours

3. **Dial Tracking Disabled** - DEPLOYED ✅
   - Removed 5-business-day waiting period
   - Messages send immediately
   - Still respects max 8 attempts per contact

4. **Hardcoded Contact Info** - DEPLOYED ✅ (TEMPORARY)
   - Phone: +17328100182
   - Email: jose.fernandez@JoseTheRealtor.com
   - Reason: GHL phone/email scopes not approved yet
   - TODO: Remove hardcoded values once GHL approves scopes

5. **UI Fixes** - DEPLOYED ✅
   - Skip trace now shows actual success/failure counts
   - GHL sync shows real counts instead of generic message
   - Both operations properly refresh dashboard

## Active Issues

### 1. SMS Outreach Not Sending Proper Message
**Status:** FIXED - Awaiting deployment (10 min)
**Problem:** 
- Lambda found 22 contacts with "ai outreach" tag
- All showing "not ready yet (1-2/5 business days)"
- Dial tracking was preventing immediate sending
- Contacts receiving fallback message instead of prospecting script

**Solution Deployed:**
- Disabled dial tracking wait period
- Hardcoded phone number
- Next Lambda run (top of hour) will send to all 22 contacts

**Expected Message:**
```
Hi [Name], this is Jose Fernandez from RE/MAX Homeland Realtors. I saw the public notice about [Property Address] and wanted to see if I could make you a firm cash offer of $[Cash Offer] to buy it directly, or help you list it for maximum value around $[Zestimate]. I work with families in these situations because having both a 'speed' option and a 'top-dollar' option gives you the most control. I just need 10 minutes to see the condition. Are you open to meeting with me to discuss your options?
```

### 2. GHL Scope Approval Pending
**Status:** WAITING ON GHL
**Missing Scopes:**
- Phone numbers read/write
- Email settings read/write

**Current Workaround:**
- Hardcoded phone: +17328100182
- Hardcoded email: jose.fernandez@JoseTheRealtor.com

**When Approved:**
- Remove hardcoded values from:
  - `amplify/functions/dailyOutreachAgent/handler.ts`
  - `amplify/functions/dailyEmailAgent/handler.ts`
- Re-enable GHL Settings UI in Profile page

## System Architecture

### Lambda Functions

#### 1. dailyOutreachAgent (SMS)
- **Schedule:** Every hour (EventBridge)
- **Business Hours Check:** Yes
- **Target:** Contacts with "ai outreach" tag
- **Filter:** call_attempt_counter < 8
- **Phone:** +17328100182 (hardcoded)
- **Rate Limit:** 2 seconds between messages
- **Logs:** `/aws/lambda/amplify-d127hbsjypuuhr-ma-dailyOutreachAgentlambda-Gj7BbO4nINK8`

#### 2. dailyEmailAgent (Email)
- **Schedule:** Every hour (EventBridge)
- **Business Hours Check:** Yes
- **Target:** Contacts with "ai outreach" tag, email_attempt_counter = 0
- **Email:** jose.fernandez@JoseTheRealtor.com (hardcoded)
- **Rate Limit:** 2 seconds between emails
- **Logs:** `/aws/lambda/amplify-d127hbsjypuuhr-ma-dailyEmailAgentlambdaBB2-D2aBOdoR4MQK`

#### 3. bulkEmailCampaign (Manual)
- **Trigger:** Dashboard button
- **Target:** Contacts with "app:synced" tag
- **Purpose:** One-time bulk email campaign
- **Not currently used** (using dailyEmailAgent instead)

### API Routes

#### SMS Outreach
- `POST /api/v1/send-message-to-contact` - Production SMS sending
- `POST /api/v1/ghl-webhook` - Handle SMS replies (AI responses)
- `POST /api/v1/test-ai-response` - Test AI without sending

#### Email Outreach
- `POST /api/v1/send-email-to-contact` - Production email sending
- `POST /api/v1/ghl-email-webhook` - Handle email replies (AI responses)

#### Other
- `POST /api/v1/start-email-campaign` - Trigger bulk email campaign
- `GET /api/v1/ghl-phone-numbers` - Get available GHL phone numbers
- `GET /api/v1/oauth/callback` - GHL OAuth callback
- `POST /api/v1/oauth/refresh` - Refresh GHL OAuth token

### Key Files

#### AI Conversation Handlers
- `app/utils/ai/conversationHandler.ts` - SMS AI (5-step script)
- `app/utils/ai/emailConversationHandler.ts` - Email AI (AMMO framework)

#### Shared Utilities
- `amplify/functions/shared/businessHours.ts` - Business hours checker
- `amplify/functions/shared/dialTracking.ts` - Dial tracking (DISABLED)
- `amplify/functions/shared/ghlTokenManager.ts` - OAuth token refresh

#### Data Layer
- `app/utils/aws/data/lead.client.ts` - Client-side lead operations
- `app/utils/aws/data/lead.server.ts` - Server-side lead operations

## GHL Custom Fields

### Contact Fields
- `0MD4Pp2LCyOSCbCjA5qF` - call_attempt_counter (SMS tracking)
- `wWlrXoXeMXcM6kUexf2L` - email_attempt_counter (Email tracking)
- `dWNGeSckpRoVUxXLgxMj` - last_call_date
- `1NxQW2kKMVgozjSUuu7s` - AI state (not_started, running, handoff)
- `p3NOYiInAERYbe0VsLHB` - Property address
- `h4UIjKQvFu7oRW4SAY8W` - Property city
- `9r9OpQaxYPxqbA6Hvtx7` - Property state
- `hgbjsTVwcyID7umdhm2o` - Property zip
- `oaf4wCuM3Ub9eGpiddrO` - Lead type (Probate/PREFORECLOSURE)
- `pGfgxcdFaYAkdq0Vp53j` - Contact type

### Opportunity Fields
- `5PTlyH0ahrPVzYTKicYn` - Disposition (set to "Direct Mail Campaign" after 8 attempts)

## Tags Used

### Automation Tags
- `ai outreach` - Triggers automated SMS/email outreach
- `app:synced` - Contact synced from our platform

### Status Tags
- `email:replied` - Contact replied to email
- `email:bounced` - Email bounced
- `Ready-For-Human-Contact` - AI detected handoff keywords

### Lead Type Tags
- `probate` - Probate lead
- `preforeclosure` - Preforeclosure lead

## Environment Variables

### Production (Amplify Console)
```
GOOGLE_MAPS_API_KEY=<set in Amplify>
GHL_CLIENT_ID=<set in Amplify>
GHL_CLIENT_SECRET=<set in Amplify>
OPENAI_API_KEY=<set in Amplify>
BRIDGE_API_KEY=<set in Amplify>
APP_URL=https://leads.josetherealtor.com
```

### Lambda-Specific
- `GHL_INTEGRATION_TABLE_NAME` - DynamoDB table for GHL integrations
- `AMPLIFY_DATA_PropertyLead_TABLE_NAME` - Leads table
- `AMPLIFY_DATA_UserAccount_TABLE_NAME` - Users table
- `API_ENDPOINT` - Base URL for API calls

## Recent Fixes

### 1. GHL Token Refresh Issue (Jan 21)
- Old token expired, required manual reconnection
- `campaignPhone` field lost during reconnection
- Manually restored: +17328100182

### 2. GHL Contacts Search API (Jan 21)
- Fixed incorrect query format
- Changed from `query: { tags: [...] }` to `filters: [{ field, operator, value }]`

### 3. Conversation Creation 404 (Jan 22)
- OAuth token missing `conversations.write` scope
- Solution: Use contact-based message endpoint (auto-creates conversation)

### 4. Skip Trace Results Not Showing (Jan 22)
- JSON response not being parsed
- Fixed: Parse JSON string if needed

### 5. GHL Sync Not Showing Counts (Jan 22)
- Used `Promise.all` which failed on any error
- Fixed: Use `Promise.allSettled` and return success/failure counts

## TODO List

### High Priority
1. **Remove hardcoded contact info** once GHL approves scopes
   - Files: `dailyOutreachAgent/handler.ts`, `dailyEmailAgent/handler.ts`
   - Re-enable GHL Settings UI

2. **Monitor first outreach batch** (next hour)
   - Check CloudWatch logs
   - Verify messages sent to all 22 contacts
   - Confirm proper message content

### Medium Priority
3. **Test email outreach** once contacts have email addresses
4. **Test AI reply handling** for both SMS and email
5. **Verify handoff detection** and tagging

### Low Priority
6. **Add email scope** to GHL OAuth once approved
7. **Add phone scope** to GHL OAuth once approved
8. **Update README** with final configuration steps

## Monitoring

### CloudWatch Logs
```bash
# SMS Outreach
aws logs tail /aws/lambda/amplify-d127hbsjypuuhr-ma-dailyOutreachAgentlambda-Gj7BbO4nINK8 --follow

# Email Outreach
aws logs tail /aws/lambda/amplify-d127hbsjypuuhr-ma-dailyEmailAgentlambdaBB2-D2aBOdoR4MQK --follow
```

### Manual Lambda Invocation
```bash
# SMS
aws lambda invoke --function-name amplify-d127hbsjypuuhr-ma-dailyOutreachAgentlambda-Gj7BbO4nINK8 --payload '{}' /tmp/response.json

# Email
aws lambda invoke --function-name amplify-d127hbsjypuuhr-ma-dailyEmailAgentlambdaBB2-D2aBOdoR4MQK --payload '{}' /tmp/response.json
```

## Known Limitations

1. **GHL Rate Limits**
   - 100 requests/hour per location
   - 1000 requests/day per location
   - Both agents respect 2-second delays

2. **Max Outreach Attempts**
   - 8 messages per contact (SMS)
   - After 8 attempts, disposition set to "Direct Mail Campaign"

3. **Business Hours Only**
   - No messages sent outside business hours
   - No messages on Sundays

4. **Hardcoded Contact Info** (Temporary)
   - Single phone number for all SMS
   - Single email for all emails
   - Will be dynamic once GHL approves scopes

## Documentation

### Updated Files
- `README.md` - Complete user guide with email automation
- All Lambda handlers - Comprehensive JSDoc comments
- All API routes - Detailed documentation headers
- Utility functions - Usage examples and related files

### Key Documentation Sections
- AI Email Bot features
- Business hours compliance
- AMMO framework explanation
- Hook-Relate-Bridge-Ask structure
- Multi-channel outreach workflow

## Next Session Checklist

When starting a new chat session, review:
1. This context file
2. Recent CloudWatch logs for both agents
3. GHL contact tags to verify outreach status
4. Any new error messages or issues
5. GHL scope approval status

## Contact Information

**Owner:** Jose Fernandez
**Email:** jose.fernandez@JoseTheRealtor.com
**Phone:** +17328100182
**Company:** RE/MAX Homeland Realtors
**Platform:** https://leads.josetherealtor.com
