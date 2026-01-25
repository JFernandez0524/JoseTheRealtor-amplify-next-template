# kvCORE API Integration

## Setup

### 1. Get API Token

**Option A: Request from kvCORE**
Email: developersupport@insiderealestate.com
Subject: "API Access Request for RE/MAX Agent"

**Option B: Check Dashboard**
- Log into kvCORE/BoldTrail
- Settings → Integrations → API
- Generate or copy your API token

### 2. Add to Environment Variables

```bash
# .env.local (development)
KVCORE_API_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Amplify Console (production)
# Add KVCORE_API_TOKEN in Environment Variables section
```

### 3. Test Connection

```bash
# Test API connection
curl "https://api.kvcore.com/v2/public/contacts" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

## Available Functions

### Search MLS Listings
```typescript
import { searchMLSListings } from '@/app/utils/kvcore.server';

const listings = await searchMLSListings({
  city: 'Miami',
  state: 'FL',
  minPrice: 300000,
  maxPrice: 400000,
  beds: 3,
  baths: 2,
  status: 'Active',
  limit: 20
});
```

### Get Listing Details
```typescript
import { getListingDetails } from '@/app/utils/kvcore.server';

const listing = await getListingDetails('listing-id-123');
```

### Create Contact
```typescript
import { createContact } from '@/app/utils/kvcore.server';

const contact = await createContact({
  firstName: 'John',
  lastName: 'Smith',
  email: 'john@example.com',
  phone: '+1234567890',
  dealType: 'buyer',
  source: 'AI Chat',
  notes: 'Interested in 3BR homes in Miami'
});
```

### Get Sold Comps (for CMA)
```typescript
import { getSoldComps } from '@/app/utils/kvcore.server';

const comps = await getSoldComps({
  address: '123 Main St',
  city: 'Miami',
  state: 'FL',
  radius: 0.5, // miles
  soldWithinDays: 90,
  limit: 10
});
```

### Schedule Showing
```typescript
import { scheduleShowing } from '@/app/utils/kvcore.server';

const showing = await scheduleShowing({
  listingId: 'listing-123',
  contactId: 'contact-456',
  preferredDate: '2024-02-01',
  preferredTime: '3:00 PM',
  notes: 'Buyer is pre-approved'
});
```

### Get Open Houses
```typescript
import { getOpenHouses } from '@/app/utils/kvcore.server';

const openHouses = await getOpenHouses({
  city: 'Miami',
  state: 'FL',
  startDate: '2024-02-01',
  endDate: '2024-02-07'
});
```

## API Response Format

### Listings Response
```json
{
  "current_page": 1,
  "data": [
    {
      "id": "listing-123",
      "mls_number": "A12345678",
      "address": "123 Main St",
      "city": "Miami",
      "state": "FL",
      "zip": "33101",
      "price": 385000,
      "bedrooms": 3,
      "bathrooms": 2,
      "sqft": 1800,
      "property_type": "Single Family",
      "status": "Active",
      "photos": ["url1", "url2"],
      "description": "Beautiful home...",
      "listed_date": "2024-01-15",
      "days_on_market": 5
    }
  ],
  "total": 12,
  "per_page": 20,
  "last_page": 1
}
```

### Contact Response
```json
{
  "id": "contact-456",
  "first_name": "John",
  "last_name": "Smith",
  "email": "john@example.com",
  "phone": "+1234567890",
  "deal_type": "buyer",
  "source": "AI Chat",
  "status": "active",
  "created_at": "2024-01-25T12:00:00Z"
}
```

## Rate Limits

- **Production**: Check with kvCORE support
- **Sandbox**: Typically 100 requests/minute

## Error Handling

All functions return `null` on error and log to console:
```typescript
const listings = await searchMLSListings({ city: 'Miami' });
if (!listings) {
  console.error('Failed to fetch listings');
  // Handle error
}
```

## Next Steps

1. Get your API token from kvCORE
2. Add to environment variables
3. Test with a simple search
4. Integrate with AI conversation handler
5. Add AI tools for MLS search

## Support

- kvCORE API Docs: https://api.kvcore.com/docs
- Developer Support: developersupport@insiderealestate.com
- RE/MAX Tech Support: Contact your broker
