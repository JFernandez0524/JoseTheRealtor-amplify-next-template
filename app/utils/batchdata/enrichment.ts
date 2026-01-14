/**
 * BatchData Property Enrichment
 * Enriches preforeclosure leads with real equity data, contact info, and property details
 */

import type { DBLead } from '../aws/data/lead.server';

// BatchData API Configuration
const BATCHDATA_API_URL = 'https://api.batchdata.com/api/v1/property/lookup/all-attributes';
const BATCHDATA_API_KEY = process.env.BATCHDATA_API_KEY;

// BatchData Response Types (based on your sample data)
interface BatchDataAddress {
  houseNumber: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  zipPlus4?: string;
}

interface BatchDataValuation {
  estimatedValue: number;
  equityPercent: number;
  ltv: number;
  equityCurrentEstimatedBalance: number;
}

interface BatchDataMortgage {
  recordingDate: string;
  loanAmount: number;
  lenderName: string;
  currentEstimatedBalance?: number;
  ltv?: number;
}

interface BatchDataOpenLien {
  totalOpenLienCount: number;
  totalOpenLienBalance: number;
  mortgages: BatchDataMortgage[];
}

interface BatchDataPhoneNumber {
  number: string;
  type: string;
  carrier?: string;
  reachable?: boolean;
  dnc?: boolean;
  score?: number;
}

interface BatchDataOwner {
  fullName: string;
  ownerOccupied: boolean;
  emails?: string[];
  phoneNumbers?: BatchDataPhoneNumber[];
  mailingAddress?: BatchDataOwnerMailingAddress;
}

interface BatchDataQuickLists {
  ownerOccupied: boolean;
  freeAndClear: boolean;
  highEquity: boolean;
  inherited: boolean;
  preforeclosure: boolean;
  absenteeOwner: boolean;
  corporateOwned: boolean;
  seniorOwner: boolean;
}

interface BatchDataOwnerMailingAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface BatchDataForeclosure {
  status?: string;
  auctionDate?: string;
  unpaidBalance?: number;
  currentLenderName?: string;
}

interface BatchDataProperty {
  address: BatchDataAddress;
  valuation: BatchDataValuation;
  openLien: BatchDataOpenLien;
  owner: BatchDataOwner;
  quickLists: BatchDataQuickLists;
  foreclosure?: BatchDataForeclosure;
}

interface BatchDataResponse {
  results: Array<{
    property: BatchDataProperty;
    status: string;
  }>;
}

/**
 * Enrich a single preforeclosure lead with BatchData
 */
export async function enrichPreforeclosureLead(lead: DBLead): Promise<Partial<DBLead>> {
  if (!BATCHDATA_API_KEY) {
    throw new Error('BATCHDATA_API_KEY not configured');
  }

  if (lead.type !== 'PREFORECLOSURE') {
    throw new Error('BatchData enrichment only for PREFORECLOSURE leads');
  }

  // Build BatchData request with custom projection (only fields we need)
  const request = {
    requests: [
      {
        address: {
          houseNumber: extractHouseNumber(lead.ownerAddress),
          street: extractStreet(lead.ownerAddress),
          city: lead.ownerCity,
          state: lead.ownerState,
          zip: lead.ownerZip,
        },
      },
    ],
    options: {
      projection: 'custom',
      customProjection: [
        // Valuation data
        'valuation.estimatedValue',
        'valuation.equityPercent',
        'valuation.ltv',
        'valuation.equityCurrentEstimatedBalance',
        
        // Mortgage data
        'openLien.totalOpenLienCount',
        'openLien.totalOpenLienBalance',
        'openLien.mortgages',
        
        // Contact enrichment
        'owner.fullName',
        'owner.emails',
        'owner.phoneNumbers',
        'owner.mailingAddress',
        
        // Foreclosure data
        'foreclosure.status',
        'foreclosure.auctionDate',
        'foreclosure.unpaidBalance',
        'foreclosure.currentLenderName',
        
        // Address for comparison
        'address.street',
        'address.city',
        'address.state',
        'address.zip',
      ],
    },
  };

  // Call BatchData API
  const response = await fetch(BATCHDATA_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BATCHDATA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`BatchData API error: ${response.status} ${response.statusText}`);
  }

  const data: BatchDataResponse = await response.json();
  const result = data.results[0];

  if (!result || result.status !== 'Valid') {
    throw new Error(`BatchData returned invalid status: ${result?.status || 'unknown'}`);
  }

  const property = result.property;

  // Calculate flags ourselves (no Quick Lists needed)
  const ownerOccupied = isOwnerOccupied(property, lead);
  const freeAndClear = property.openLien.totalOpenLienBalance === 0;
  const highEquity = property.valuation.equityPercent >= 50;

  // Filter phones: Mobile only, score 90+, not DNC
  const bestPhone = getBestPhone(property.owner.phoneNumbers);

  // Extract enrichment data
  const enrichment: Partial<DBLead> = {
    // Real equity data
    equityPercent: property.valuation.equityPercent,
    estimatedValue: property.valuation.estimatedValue,
    mortgageBalance: property.openLien.totalOpenLienBalance,
    
    // Contact information (filtered for quality)
    ownerEmail: property.owner.emails?.[0] || lead.ownerEmail,
    ownerPhone: bestPhone || lead.ownerPhone,
    
    // Calculated property flags
    ownerOccupied,
    freeAndClear,
    
    // Foreclosure details
    foreclosureAuctionDate: property.foreclosure?.auctionDate 
      ? new Date(property.foreclosure.auctionDate).toISOString()
      : lead.foreclosureAuctionDate,
    
    // Enrichment metadata
    batchDataEnriched: true,
    batchDataEnrichedAt: new Date().toISOString(),
  };

  // Store additional enrichment data in notes for reference
  const enrichmentNotes = buildEnrichmentNotes(property, ownerOccupied, freeAndClear, highEquity);
  if (enrichmentNotes) {
    enrichment.notes = lead.notes 
      ? `${lead.notes}\n\n${enrichmentNotes}`
      : enrichmentNotes;
  }

  return enrichment;
}

/**
 * Enrich multiple preforeclosure leads in batch
 */
export async function enrichPreforeclosureLeads(leads: DBLead[]): Promise<Map<string, Partial<DBLead>>> {
  const results = new Map<string, Partial<DBLead>>();
  
  // Filter to only preforeclosure leads that haven't been enriched
  const leadsToEnrich = leads.filter(
    lead => lead.type === 'PREFORECLOSURE' && !lead.batchDataEnriched
  );

  if (leadsToEnrich.length === 0) {
    return results;
  }

  // Process in batches of 10 (BatchData limit)
  const batchSize = 10;
  for (let i = 0; i < leadsToEnrich.length; i += batchSize) {
    const batch = leadsToEnrich.slice(i, i + batchSize);
    
    // Build batch request with custom projection
    const request = {
      requests: batch.map(lead => ({
        address: {
          houseNumber: extractHouseNumber(lead.ownerAddress),
          street: extractStreet(lead.ownerAddress),
          city: lead.ownerCity,
          state: lead.ownerState,
          zip: lead.ownerZip,
        },
      })),
      options: {
        projection: 'custom',
        customProjection: [
          'valuation.estimatedValue',
          'valuation.equityPercent',
          'valuation.ltv',
          'valuation.equityCurrentEstimatedBalance',
          'openLien.totalOpenLienCount',
          'openLien.totalOpenLienBalance',
          'openLien.mortgages',
          'owner.fullName',
          'owner.emails',
          'owner.phoneNumbers',
          'owner.mailingAddress',
          'foreclosure.status',
          'foreclosure.auctionDate',
          'foreclosure.unpaidBalance',
          'foreclosure.currentLenderName',
          'address.street',
          'address.city',
          'address.state',
          'address.zip',
        ],
      },
    };

    try {
      const response = await fetch(BATCHDATA_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BATCHDATA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        console.error(`BatchData API error for batch ${i}: ${response.status}`);
        continue;
      }

      const data: BatchDataResponse = await response.json();

      // Process each result
      data.results.forEach((result, index) => {
        const lead = batch[index];
        if (!lead) return;

        if (result.status === 'Valid' && result.property) {
          const property = result.property;
          
          // Calculate flags ourselves
          const ownerOccupied = isOwnerOccupied(property, lead);
          const freeAndClear = property.openLien.totalOpenLienBalance === 0;
          const highEquity = property.valuation.equityPercent >= 50;
          
          // Filter phones for quality
          const bestPhone = getBestPhone(property.owner.phoneNumbers);
          
          const enrichment: Partial<DBLead> = {
            equityPercent: property.valuation.equityPercent,
            estimatedValue: property.valuation.estimatedValue,
            mortgageBalance: property.openLien.totalOpenLienBalance,
            ownerEmail: property.owner.emails?.[0] || lead.ownerEmail,
            ownerPhone: bestPhone || lead.ownerPhone,
            ownerOccupied,
            freeAndClear,
            foreclosureAuctionDate: property.foreclosure?.auctionDate 
              ? new Date(property.foreclosure.auctionDate).toISOString()
              : lead.foreclosureAuctionDate,
            batchDataEnriched: true,
            batchDataEnrichedAt: new Date().toISOString(),
          };

          const enrichmentNotes = buildEnrichmentNotes(property, ownerOccupied, freeAndClear, highEquity);
          if (enrichmentNotes) {
            enrichment.notes = lead.notes 
              ? `${lead.notes}\n\n${enrichmentNotes}`
              : enrichmentNotes;
          }

          results.set(lead.id, enrichment);
        }
      });
    } catch (error) {
      console.error(`Error enriching batch ${i}:`, error);
    }
  }

  return results;
}

/**
 * Helper: Extract house number from address
 */
function extractHouseNumber(address: string): string {
  const match = address.match(/^(\d+)/);
  return match ? match[1] : '';
}

/**
 * Helper: Extract street name from address
 */
function extractStreet(address: string): string {
  return address.replace(/^\d+\s*/, '').trim();
}

/**
 * Helper: Format phone number to E.164 format
 */
function formatPhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Add +1 if not present
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  return phone;
}

/**
 * Helper: Get best phone number (Mobile, score 90+, not DNC)
 */
function getBestPhone(phoneNumbers?: BatchDataPhoneNumber[]): string | undefined {
  if (!phoneNumbers || phoneNumbers.length === 0) return undefined;
  
  // Filter: Mobile only, score 90+, not DNC, reachable
  const qualityPhones = phoneNumbers.filter(phone => 
    phone.type === 'Mobile' &&
    phone.score && phone.score >= 90 &&
    phone.dnc === false &&
    phone.reachable === true
  );
  
  // Sort by score (highest first)
  qualityPhones.sort((a, b) => (b.score || 0) - (a.score || 0));
  
  // Return best phone formatted
  return qualityPhones.length > 0 
    ? formatPhone(qualityPhones[0].number)
    : undefined;
}

/**
 * Helper: Check if owner occupied by comparing addresses
 */
function isOwnerOccupied(property: BatchDataProperty, lead: DBLead): boolean {
  const mailingAddress = property.owner.mailingAddress;
  if (!mailingAddress) return false;
  
  // Normalize addresses for comparison
  const propertyStreet = property.address.street?.toLowerCase().trim();
  const mailingStreet = mailingAddress.street?.toLowerCase().trim();
  const propertyCity = property.address.city?.toLowerCase().trim();
  const mailingCity = mailingAddress.city?.toLowerCase().trim();
  const propertyZip = property.address.zip?.trim();
  const mailingZip = mailingAddress.zip?.trim();
  
  // Match if street, city, and zip all match
  return (
    propertyStreet === mailingStreet &&
    propertyCity === mailingCity &&
    propertyZip === mailingZip
  );
}

/**
 * Helper: Build enrichment notes from BatchData property
 */
function buildEnrichmentNotes(
  property: BatchDataProperty,
  ownerOccupied: boolean,
  freeAndClear: boolean,
  highEquity: boolean
): string {
  const notes: string[] = ['=== BatchData Enrichment ==='];
  
  // Equity info
  notes.push(`Equity: ${property.valuation.equityPercent}% ($${property.valuation.equityCurrentEstimatedBalance.toLocaleString()})`);
  notes.push(`LTV: ${property.valuation.ltv}%`);
  notes.push(`Estimated Value: $${property.valuation.estimatedValue.toLocaleString()}`);
  
  // Mortgage info
  if (property.openLien.totalOpenLienBalance > 0) {
    notes.push(`Total Liens: $${property.openLien.totalOpenLienBalance.toLocaleString()}`);
    notes.push(`Lien Count: ${property.openLien.totalOpenLienCount}`);
    
    if (property.openLien.mortgages.length > 0) {
      const primary = property.openLien.mortgages[0];
      notes.push(`Primary Lender: ${primary.lenderName}`);
      notes.push(`Primary Balance: $${(primary.currentEstimatedBalance || primary.loanAmount).toLocaleString()}`);
    }
  }
  
  // Property flags (calculated)
  const flags: string[] = [];
  if (ownerOccupied) flags.push('Owner Occupied');
  if (freeAndClear) flags.push('Free & Clear');
  if (highEquity) flags.push('High Equity (50%+)');
  if (flags.length > 0) {
    notes.push(`Flags: ${flags.join(', ')}`);
  }
  
  // Contact info
  const contactInfo: string[] = [];
  if (property.owner.emails && property.owner.emails.length > 0) {
    contactInfo.push(`Emails: ${property.owner.emails.length}`);
  }
  if (property.owner.phoneNumbers && property.owner.phoneNumbers.length > 0) {
    const mobile = property.owner.phoneNumbers.filter(p => p.type === 'Mobile').length;
    const highScore = property.owner.phoneNumbers.filter(p => p.score && p.score >= 90).length;
    const noDnc = property.owner.phoneNumbers.filter(p => p.dnc === false).length;
    contactInfo.push(`Phones: ${property.owner.phoneNumbers.length} total (${mobile} mobile, ${highScore} score 90+, ${noDnc} not DNC)`);
  }
  if (contactInfo.length > 0) {
    notes.push(contactInfo.join(', '));
  }
  
  return notes.join('\n');
}
