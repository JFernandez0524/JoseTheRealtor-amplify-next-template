# Phase 2: Direct Mail Integration (Simplified)

## What Phase 2 Actually Does

Phase 2 is **NOT** about generating letters in the app. It's about:

1. **Pass Zestimate data to GHL** when syncing leads
2. **Calculate 70% cash offer** (as-is value)
3. **Tag leads appropriately** in GHL
4. **GHL automation handles everything else** (Click2Mail webhook + mail merge)

## Implementation Complete ✅

### What Was Added

**File**: `/amplify/functions/manualGhlSync/integrations/gohighlevel.ts`

**Changes**:
1. Added `cash_offer` to GHL custom field map
2. Calculate cash offer: `Math.round(zestimate * 0.70)`
3. Pass both values to GHL:
   - `zestimate`: Full market value (for listing option)
   - `cash_offer`: 70% value (for cash purchase option)

### GHL Custom Fields

Your GHL account needs these custom fields:

| Field Name | GHL Field ID | Value | Purpose |
|------------|--------------|-------|---------|
| `zestimate` | `7wIe1cRbZYXUnc3WOVb2` | Full property value | Listing option amount |
| `cash_offer` | **REPLACE_WITH_YOUR_ID** | 70% of zestimate | Cash purchase amount |

**Action Required**: 
1. Create `cash_offer` custom field in GHL
2. Get the field ID
3. Replace `REPLACE_WITH_YOUR_GHL_FIELD_ID` in the code

### How It Works

```
User syncs lead to GHL
  ↓
App calculates:
  - zestimate: $425,000 (full value)
  - cash_offer: $297,500 (70% of $425k)
  ↓
Both values sent to GHL custom fields
  ↓
Lead tagged as "Direct-Mail-Only" (if no phone)
  ↓
GHL automation triggers:
  - Webhook to Click2Mail
  - Mail merge with zestimate + cash_offer
  - Letter sent automatically
```

### GHL Automation Setup

Your GHL workflow should:

1. **Trigger**: When contact tagged with `Direct-Mail-Only` or `Direct_Mail_Eligible`
2. **Action**: Send webhook to Click2Mail with:
   ```json
   {
     "firstName": "{{contact.first_name}}",
     "lastName": "{{contact.last_name}}",
     "address": "{{custom_fields.property_address}}",
     "city": "{{custom_fields.property_city}}",
     "state": "{{custom_fields.property_state}}",
     "zip": "{{custom_fields.property_zip}}",
     "listingValue": "{{custom_fields.zestimate}}",
     "cashOffer": "{{custom_fields.cash_offer}}"
   }
   ```
3. **Click2Mail**: Mail merges these values into your letter template

### Letter Template in Click2Mail

Your Click2Mail template can use:

```
Dear {{firstName}} {{lastName}},

I recently learned about your property at {{address}}.

As both a licensed agent and investor, I can help you in TWO ways:

OPTION 1: TRADITIONAL LISTING
List your property for its full market value of approximately ${{listingValue}}.

OPTION 2: FAST CASH PURCHASE  
Quick cash offer of approximately ${{cashOffer}} with closing in 7-14 days.

The choice is yours...
```

## Tags Applied

When syncing to GHL, leads are automatically tagged:

- `Direct-Mail-Only` - No phone, route to mail campaign
- `Direct_Mail_Eligible` - Primary contact for mail (prevents duplicate mailings)
- `App:Synced` - Synced from your app
- `Data:SkipTraced` - Has skip trace data
- `Multi-Phone-Lead` - Has multiple phone numbers

## Testing

1. **Sync a lead** with Zestimate data
2. **Check GHL contact** - verify custom fields populated:
   - zestimate: Shows full value
   - cash_offer: Shows 70% value
3. **Verify tags** - Should have `Direct_Mail_Eligible`
4. **Trigger GHL automation** - Should send to Click2Mail
5. **Check Click2Mail** - Letter should have both values merged

## Cost

- **App**: $0 (just passes data)
- **GHL**: Included in your plan
- **Click2Mail**: ~$0.85-$1.00 per letter (via GHL webhook)

## What You DON'T Need

❌ No letter generation in app  
❌ No Click2Mail API integration in app  
❌ No PDF generation  
❌ No mailing logic  

✅ Just pass data to GHL  
✅ GHL handles everything  

## Next Steps

1. Create `cash_offer` custom field in GHL
2. Update the field ID in code
3. Set up GHL automation with Click2Mail webhook
4. Create letter template in Click2Mail with merge fields
5. Test with 1-2 leads

---

**Status**: Phase 2 Complete ✅  
**Complexity**: Minimal (just data passing)  
**Maintenance**: None (GHL handles mailing)
