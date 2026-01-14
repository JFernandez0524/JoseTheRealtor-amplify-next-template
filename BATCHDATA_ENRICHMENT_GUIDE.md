# BatchData Enrichment Implementation Guide

## Overview

BatchData enrichment is now implemented for **PREFORECLOSURE leads only**. This provides real equity data, contact information, and property flags to help you focus on the best deals.

## What You Get

For each preforeclosure lead enriched, you receive:

### Financial Data
- **Real Equity %** - Actual equity percentage from valuation
- **Estimated Value** - Current property value
- **Mortgage Balance** - Total open lien balance
- **LTV** - Loan-to-value ratio

### Contact Information (Built-in Skip Trace)
- **Owner Emails** - Up to 3 email addresses
- **Owner Phone Numbers** - **Filtered for quality:**
  - ✅ Mobile phones only
  - ✅ Score 90+ (high confidence)
  - ✅ Not on DNC registry
  - ✅ Reachable/active
- **Best Phone Selected** - Automatically picks highest quality number

### Property Flags
- **Owner Occupied** - Lives in property vs investor
- **Free & Clear** - No mortgage
- **High Equity** - 50%+ equity
- **Inherited** - Probate property
- **Senior Owner** - Elderly homeowner

### Foreclosure Details
- **Auction Date** - Updated foreclosure auction date
- **Lender Name** - Current lender information
- **Unpaid Balance** - Foreclosure amount

## Cost

**$0.29 per preforeclosure lead**

Includes:
- Contact Enrichment ($0.07) - Emails + phones
- Valuation ($0.06) - Equity %, property value, LTV
- Mortgage + Liens ($0.10) - Real mortgage balances
- Pre-Foreclosure ($0.06) - Foreclosure status, auction dates

**We calculate these ourselves (no extra cost):**
- Owner Occupied - Compare property vs mailing address
- High Equity - Check if equity % > 50%
- Free & Clear - Check if mortgage balance = 0

## How to Use

### 1. Setup

Add your BatchData API key to `.env.local`:

```bash
BATCHDATA_API_KEY=your_api_key_here
```

### 2. Enrich Leads

1. Go to Dashboard
2. Select preforeclosure leads (checkbox)
3. Click **🏦 Enrich Leads** button
4. Confirm cost and proceed
5. Wait for enrichment to complete

### 3. View Results

Enriched data appears in:
- **Lead Details** - Equity %, mortgage balance, contact info
- **Notes Section** - Full enrichment summary with flags
- **Contact Fields** - Updated emails and phones

### 4. Filter by Enrichment

Use filters to find:
- **Owner Occupied** - Homeowners (not investors)
- **High Equity** - 50%+ equity deals
- **Free & Clear** - No mortgage properties

## Workflow Example

**For 100 preforeclosure leads:**

1. **Upload** - Import 100 preforeclosure leads
2. **Enrich** - Select all, click Enrich ($29)
3. **Filter** - Filter to Owner Occupied + High Equity (~30 leads)
4. **Contact** - Use built-in emails/phones (no skip trace needed!)
5. **Result** - 30 qualified homeowners with contact info for $29

**vs Traditional Workflow:**
- Skip trace all 100: $10
- Call 100 leads: 20+ hours
- Find 30 qualified: Same result, more time/money

## API Endpoint

```typescript
POST /api/v1/enrich-leads
{
  "leadIds": ["lead-id-1", "lead-id-2"]
}
```

**Response:**
```json
{
  "enriched": 25,
  "skipped": 5,
  "failed": 0,
  "cost": 7.50
}
```

## Schema Fields

New fields added to `PropertyLead`:

```typescript
{
  equityPercent: number;           // Real equity %
  ownerOccupied: boolean;          // Lives in property
  freeAndClear: boolean;           // No mortgage
  batchDataEnriched: boolean;      // Has been enriched
  batchDataEnrichedAt: string;     // When enriched
  ownerEmail: string;              // Updated from enrichment
  ownerPhone: string;              // Updated from enrichment
  mortgageBalance: number;         // Total liens
  estimatedValue: number;          // Property value
}
```

## Notes

- **Probate leads** - NOT enriched (use AI scoring only)
- **Already enriched** - Skipped automatically (no duplicate charges)
- **Failed enrichment** - No charge for failed lookups
- **Contact info** - May eliminate need for separate skip trace

## Support

If enrichment fails:
1. Check API key in `.env.local`
2. Verify lead has complete address
3. Check BatchData API status
4. Review error logs in console

## Next Steps

After enrichment:
1. Filter to HIGH equity + owner occupied
2. Use built-in contact info to reach out
3. Focus on best deals first
4. Track conversion rates
