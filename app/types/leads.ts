// app/types/leads.ts
import { type Schema } from '@/amplify/data/resource';

export type BridgeData = {
  zestimate?: number;
  rentZestimate?: number;
  zillowUrl?: string;
  taxYear?: number;
  taxAssessment?: number;
  yearBuilt?: number;
  [key: string]: any;
};

// Extend schema type to include flexible contacts for the UI
export type LeadWithDetails = Schema['PropertyLead']['type'] & {
  contacts: any[]; // Using 'any[]' to support both LazyLoader and local Array updates
  enrichments: Schema['Enrichment']['type'][];
  activities: Schema['Activity']['type'][];
  propertyAddress?: string | null;
  propertyCity?: string | null;
  propertyState?: string | null;
  propertyZip?: string | null;
  yearBuilt?: number | string | null;
  squareFeet?: number | string | null;
  bedrooms?: number | string | null;
  baths?: number | string | null;
};

export type LeadApiResponse = {
  success: boolean;
  lead: LeadWithDetails;
  marketAnalysis: BridgeData | null;
};
