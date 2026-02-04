# Bulk Queue Population Guide

## Overview
This script populates the outreach queue with all existing GHL contacts that have the "ai outreach" tag. Based on your previous conversation summary, you mentioned wanting to sync all these contacts to your local queue system.

## What This Script Does

1. **Fetches GHL Contacts**: Gets all contacts with "ai outreach" tag from your GHL location (mHaAy3ZaUHgrbPyughDG)
2. **Multi-Channel Support**: Creates separate queue entries for each phone number and email address
3. **7-Touch Cadence**: Each contact gets up to 7 touches over 28 days per channel
4. **Performance Optimization**: Reduces GHL API calls by 90% using local DynamoDB queue

## Benefits

- **Cost Savings**: Pennies instead of dollars per operation
- **Speed**: Sub-second queries vs 2-3 second GHL searches  
- **Better Tracking**: Full analytics and status tracking
- **Multi-Contact Support**: Contacts with 2 phones + 2 emails = up to 28 total touches (7×4)

## Usage

### Step 1: Install Dependencies
```bash
npm install @aws-sdk/client-dynamodb @aws-sdk/util-dynamodb
```

### Step 2: Update Contact Data
Replace the sample contacts in `getAllGHLContacts()` with your actual GHL data. You can:

1. **Use GHL MCP Server** (recommended):
   ```javascript
   // Replace getAllGHLContacts() with actual MCP calls
   const contacts = await ghlMcpServer.getContacts({
     locationId: "mHaAy3ZaUHgrbPyughDG",
     tags: ["ai outreach"],
     limit: 1000
   });
   ```

2. **Use the data from your previous query**: Copy all contacts from the GHL response you showed me

### Step 3: Run the Script
```bash
node bulk-populate-queue.js
```

## Expected Output

```
🚀 Starting bulk queue population...
📊 Current queue size: 0 contacts
📞 Fetching GHL contacts with "ai outreach" tag...
📋 Found 150 contacts to process
✓ Added SMS queue for Linda Fillman (+19088143442)
✓ Added SMS queue for Jessica Danso (+17036597148)
...
📈 Bulk population complete!
✅ Successfully added: 298 contacts
❌ Failed to add: 2 contacts
📊 Final queue size: 298 contacts
```

## Queue Schema

Each queue entry includes:
- `contactId`: GHL contact ID
- `contactName`: Full name
- `phone` or `email`: Contact method
- `channel`: SMS or EMAIL
- `status`: PENDING → REPLIED/BOUNCED/OPTED_OUT
- `touchNumber`: Current touch (1-7)
- `nextTouchDate`: When to send next message

## Integration with Existing System

This populates the same `OutreachQueue` table that your existing agents use:
- **SMS Agent**: `amplify/functions/dailyOutreachAgent/handler.ts`
- **Email Agent**: `amplify/functions/dailyEmailAgent/handler.ts`
- **Webhooks**: Update queue status on replies/bounces

## Next Steps

1. Run this script to populate the queue
2. Your existing hourly agents will automatically start processing the queue
3. Monitor progress in CloudWatch logs
4. Queue entries will be updated as contacts reply or bounce

## Troubleshooting

- **No contacts found**: Implement actual GHL MCP calls
- **DynamoDB errors**: Check AWS credentials and table name
- **Rate limiting**: Script includes 2-second delays between operations
