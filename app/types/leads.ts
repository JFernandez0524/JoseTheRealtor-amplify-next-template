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
  // UI Helpers
  contacts: any[]; // Using 'any[]' to support both LazyLoader and local Array updates
  enrichments: Schema['Enrichment']['type'][];
  activities: Schema['Activity']['type'][];

  // 🟢 NEW: Mailing Address (Absentee / Probate)
  mailingAddress?: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
  mailingZip?: string | null;
  isAbsenteeOwner?: boolean | null;

  // 🟢 NEW: Building Data (Type safety for the UI)
  yearBuilt?: number | null;
  squareFeet?: number | null;
  bedrooms?: number | null;
  baths?: number | null; // Note: Schema calls this 'bathrooms', UI might use 'baths'
  bathrooms?: number | null;
  lotSize?: number | null;
  propertyType?: string | null;

  // 🟢 NEW: Financials
  estimatedValue?: number | null;
  estimatedEquity?: number | null;
  mortgageBalance?: number | null;
  lastSaleDate?: string | null;
  lastSaleAmount?: number | null;

  // 🟢 NEW: Foreclosure
  foreclosureStatus?: string | null;
  foreclosureRecordingDate?: string | null;
  foreclosureAuctionDate?: string | null;
  foreclosureAmount?: number | null;
  foreclosureTrustee?: string | null;
};

export type LeadApiResponse = {
  success: boolean;
  lead: LeadWithDetails;
  marketAnalysis: BridgeData | null;
};
