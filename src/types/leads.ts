// src/types/leads.ts
import { z } from 'zod';

/* =====================================================================================
   1️⃣ BASE INTERFACES
   ===================================================================================== */

// ✅ Shared fields across all leads
export interface BaseLead {
  id?: string;
  type: 'probate' | 'preforeclosure'; // ✅ Added to match Amplify schema
  address: string;
  city: string;
  state: string;
  zip: string;
  standardizedAddress?: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  };
  phone?: string | null;
  email?: string | null;
  createdAt?: string;
  propertyLookupRaw?: any; // Full BatchData property lookup object (JSON)
  skipTraceDetails?: SkipTraceDetails;
}

// ✅ Enriched contact details from BatchData Skip Trace (for Probate leads)
export interface SkipTraceDetails {
  lastEnriched: string; // timestamp
  statusText: string;
  requestId: string;
  executor: {
    firstName: string;
    lastName: string;
    emails?: string[];
    phones?: Array<{
      number: string;
      carrier?: string;
      type?: string;
      tested?: boolean;
      reachable?: boolean;
      score?: number;
    }>;
    mailingAddress?: {
      street: string;
      city: string;
      state: string;
      zip: string;
      county?: string;
    };
  };
}

/* =====================================================================================
   2️⃣ PROBATE LEADS
   ===================================================================================== */

// ✅ Probate-specific interface
export interface ProbateLead extends BaseLead {
  type: 'probate';
  ownerName: string;
  executorFirstName: string;
  executorLastName: string;
  mailingAddress: string;
  mailingCity: string;
  mailingState: string;
  mailingZip: string;
}

// ✅ Zod schema for Probate CSV validation
export const ProbateLeadSchema = z.object({
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  ownerName: z.string().min(2),
  executorFirstName: z.string().min(2),
  executorLastName: z.string().min(2),

  // ✅ Align with Amplify backend (required)
  mailingAddress: z.string().min(5),
  mailingCity: z.string().min(2),
  mailingState: z.string().length(2),
  mailingZip: z.string().regex(/^\d{5}(-\d{4})?$/),

  phone: z
    .string()
    .regex(/^\d{10}$/)
    .optional()
    .nullable(),
  email: z.string().email().optional().nullable(),
});

export type ProbateLeadInput = z.infer<typeof ProbateLeadSchema> &
  Pick<ProbateLead, 'type'>;

/* =====================================================================================
   3️⃣ PRE-FORECLOSURE LEADS
   ===================================================================================== */

// ✅ Preforeclosure-specific interface
export interface PreforeclosureLead extends BaseLead {
  type: 'preforeclosure';
  borrowerFirstName: string;
  borrowerLastName: string;
  caseNumber: string;
  loanAmount?: number;
  lenderName?: string;
  trusteeName?: string;
  recordingDate?: string;
  propertyLookupRaw?: any; // full BatchData property lookup result
}

// ✅ Zod schema for Preforeclosure CSV validation
export const PreforeclosureLeadSchema = z.object({
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}$/),
  borrowerFirstName: z.string().min(2),
  borrowerLastName: z.string().min(2),
  caseNumber: z.string().min(2),
  loanAmount: z.coerce.number().optional(),
  lenderName: z.string().optional(),
  trusteeName: z.string().optional(),
  recordingDate: z.string().optional(),

  phone: z
    .string()
    .regex(/^\d{10}$/)
    .optional()
    .nullable(),
  email: z.string().email().optional().nullable(),
});

export type PreforeclosureLeadInput = z.infer<typeof PreforeclosureLeadSchema> &
  Pick<PreforeclosureLead, 'type'>;

/* =====================================================================================
   4️⃣ UNIFIED TYPES (for discriminated union safety)
   ===================================================================================== */

// ✅ Unified Lead Input type (for route or Lambda)
export type LeadInput =
  | (ProbateLead & { type: 'probate' })
  | (PreforeclosureLead & { type: 'preforeclosure' });

// ✅ Unified Lead interface (when working with Amplify models)
export type Lead = ProbateLead | PreforeclosureLead;
