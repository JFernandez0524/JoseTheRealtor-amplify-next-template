/**
 * BatchData Property Enrichment (preforeclosure)
 *
 * Enriches PREFORECLOSURE leads with property/equity/foreclosure data from BatchData's
 * `property/lookup/all-attributes` endpoint (v6). This is NOT a skip trace and does NOT return
 * contacts — the property `owner` object carries name + mailing address + ownerOccupied +
 * hasLandline, but no emails/phones. Phones/emails come from the separate skip-trace pipeline
 * (which applies mobile/score/DNC + Debounce + ranking). So enrichment here never touches
 * `lead.phones` / `lead.emails`.
 *
 * Response shape (v6): `{ status: { code }, results: { properties: [ {property fields...} ], meta } }`.
 * Types below are a defensive SUBSET (all optional) — the account is not subscribed to every
 * module, so we parse leniently and also store the entire raw response in `rawEnrichmentData`.
 *
 * Priority captured objects: `foreclosure`, `openLien` (mortgages), `valuation`, `owner`/`building`.
 *
 * USED BY: app/api/v1/enrich-leads/route.ts (calls enrichPreforeclosureLeads).
 */
import type { DBLead } from '../aws/data/lead.server';

const BATCHDATA_API_URL = 'https://api.batchdata.com/api/v1/property/lookup/all-attributes';
const BATCHDATA_API_KEY = process.env.BATCH_DATA_SERVER_TOKEN;

// ---- BatchData v6 response types (defensive subset — every field optional) ----

interface EnrichAddress {
  houseNumber?: string;
  street?: string;
  streetNoUnit?: string;
  city?: string;
  state?: string;
  zip?: string;
  zipPlus4?: string;
}

interface EnrichValuation {
  estimatedValue?: number;
  equityPercent?: number;
  equityCurrentEstimatedBalance?: number;
  ltv?: number;
  confidenceScore?: number;
  priceRangeMin?: number;
  priceRangeMax?: number;
}

interface EnrichMortgage {
  lenderName?: string;
  lenderNameBeneficiary?: string;
  loanType?: string;
  loanAmount?: number;
  currentEstimatedBalance?: number;
  estimatedPaymentAmount?: number;
  interestRate?: number | string;
  ltv?: number;
  loanTermMonths?: number;
  recordingDate?: string;
  dueDate?: string;
  equityFlag?: boolean;
  helocFlag?: boolean;
  subordinateLoanFlag?: boolean;
  preforeclosureStatus?: string;
  preforeclosureAuctionDate?: string;
  preforeclosureCaseTrusteeSaleNumber?: string;
}

interface EnrichOpenLien {
  allLoanTypes?: string[];
  juniorLoanTypes?: string[];
  totalOpenLienCount?: number;
  totalOpenLienBalance?: number;
  firstLoanRecordingDate?: string;
  lastLoanRecordingDate?: string;
  mortgages?: EnrichMortgage[];
}

/** The priority object for preforeclosure — Notice of Default / Lis Pendens, auction, trustee. */
interface EnrichForeclosure {
  statusCode?: string;
  status?: string;
  recordingDate?: string;
  filingDate?: string;
  caseNumber?: string;
  auctionDate?: string;
  auctionTime?: string;
  auctionLocation?: string;
  auctionCity?: string;
  auctionMinimumBidAmount?: number;
  documentNumber?: string;
  documentType?: string;
  loanNumber?: string;
  defaultDate?: string;
  unpaidBalance?: number;
  pastDueAmount?: number;
  dueDate?: string;
  currentLenderName?: string;
  auctionContactName?: string;
  borrowerName?: string;
  releaseDate?: string;
  trusteeSaleNumber?: string;
  trusteeName?: string;
  trusteePhone?: string;
  trusteeAddress?: string;
  originalLoanAmount?: number;
  flag?: string;
}

interface EnrichOwnerName {
  first?: string;
  middle?: string;
  last?: string;
  full?: string;
}

interface EnrichOwner {
  fullName?: string;
  names?: EnrichOwnerName[];
  mailingAddress?: EnrichAddress;
  ownerOccupied?: boolean;
  hasLandline?: boolean;
}

interface EnrichBuilding {
  bedroomCount?: number;
  bathroomCount?: number;
  fullBathroomCount?: number;
  roomCount?: number;
  livingAreaSquareFeet?: number;
  yearBuilt?: number;
  features?: string[];
}

interface EnrichAssessment {
  totalMarketValue?: number;
  totalAssessedValue?: number;
}

interface EnrichProperty {
  address?: EnrichAddress;
  valuation?: EnrichValuation;
  openLien?: EnrichOpenLien;
  foreclosure?: EnrichForeclosure;
  owner?: EnrichOwner;
  building?: EnrichBuilding;
  assessment?: EnrichAssessment;
  quickLists?: Record<string, unknown>;
  tax?: Record<string, unknown>;
  [key: string]: unknown; // preserve any unmodeled sections
}

interface BatchDataResponse {
  status?: { code?: number; text?: string };
  results?: {
    properties?: EnrichProperty[];
    // Authoritative match accounting from BatchData — the source of truth for billing. Same nesting
    // the skip-trace handler reads (results.meta.results.matchCount + results.meta.requestId).
    meta?: {
      requestId?: string;
      results?: { requestCount?: number; matchCount?: number; noMatchCount?: number; errorCount?: number };
    };
  };
}

/** BatchData's authoritative match accounting for a run, aggregated across batches. */
export interface EnrichmentMeta {
  matchCount: number; // properties BatchData matched (and billed us for)
  noMatchCount: number; // BatchData found nothing — free
  requestIds: string[]; // one per batch — for reconciling against the BatchData invoice
}

/** Result of an enrichment run: the fields to persist per matched+mapped lead, plus BatchData's meta. */
export interface EnrichmentRunResult {
  results: Map<string, Partial<DBLead>>;
  meta: EnrichmentMeta;
}

/**
 * Serialize a value for an `a.json()` (AWSJSON) field. The SSR Amplify Data client (aws-amplify 6.x)
 * rejects raw objects passed to AWSJSON fields ("Variable 'X' has an invalid value"), so we pass a JSON
 * string instead — the app's read path already tolerates either form (see LeadDetailClient's
 * `typeof … === 'string' ? JSON.parse(...) : …`). null/undefined → undefined (field left untouched).
 */
export function asJson(value: unknown): string | undefined {
  return value == null ? undefined : JSON.stringify(value);
}

/**
 * Convert a value to an AWSDate (`YYYY-MM-DD`) string, or undefined if absent/unparseable. BatchData
 * returns full ISO datetimes (e.g. "2026-04-06T00:00:00.000Z"); our `a.date()` schema fields (auction/
 * recording/default dates) reject the time component, so we strip it before persisting.
 */
export function toDateOnly(value?: string | null): string | undefined {
  if (!value) return undefined;
  // Fast path for ISO strings ("YYYY-MM-DD..."); fall back to Date parsing for other formats.
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(value);
  if (iso) return iso[0];
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

/**
 * Extract BatchData's authoritative match accounting from one response. The counts live at
 * `results.meta.results.{matchCount,noMatchCount}` and the id at `results.meta.requestId`. Pure +
 * tested so the (easy-to-get-wrong) nesting is verified without a live call.
 */
export function readBatchMeta(data: BatchDataResponse | null | undefined): {
  matchCount: number;
  noMatchCount: number;
  requestId: string | null;
} {
  const m = data?.results?.meta;
  return {
    matchCount: m?.results?.matchCount ?? 0,
    noMatchCount: m?.results?.noMatchCount ?? 0,
    requestId: m?.requestId ?? null,
  };
}

// Attribute groups we ask BatchData to return (unsubscribed groups simply come back empty).
const PROJECTION_GROUPS = [
  'address', 'valuation', 'openLien', 'foreclosure', 'owner', 'building', 'assessment', 'quickLists', 'tax',
];

// ---- Public API ----

/**
 * Enrich multiple preforeclosure leads. Returns the fields to persist per matched+mapped lead PLUS
 * BatchData's authoritative match accounting (meta) — billing is charged on meta.matchCount, not on how
 * many properties our address-join could map. Skips non-preforeclosure/already-enriched. Never sets
 * phones/emails.
 */
export async function enrichPreforeclosureLeads(leads: DBLead[]): Promise<EnrichmentRunResult> {
  const results = new Map<string, Partial<DBLead>>();
  const meta: EnrichmentMeta = { matchCount: 0, noMatchCount: 0, requestIds: [] };
  if (!BATCHDATA_API_KEY) {
    console.error('[ENRICH] BATCH_DATA_SERVER_TOKEN not configured');
    return { results, meta };
  }

  const leadsToEnrich = leads.filter(
    (lead) => lead.type?.toUpperCase() === 'PREFORECLOSURE' && !lead.batchDataEnriched,
  );
  if (leadsToEnrich.length === 0) return { results, meta };

  const BATCH_SIZE = 10; // BatchData request limit
  for (let i = 0; i < leadsToEnrich.length; i += BATCH_SIZE) {
    const batch = leadsToEnrich.slice(i, i + BATCH_SIZE);
    const request = {
      requests: batch.map((lead) => ({
        // Send the FULL street line (e.g. "71 Cascades Ave") in `street`, exactly as BatchData's docs
        // expect. Splitting the house number into a separate `houseNumber` field matches the wrong parcel
        // (BatchData returns an invalid township lot) — verified against the API.
        address: {
          street: lead.ownerAddress,
          city: lead.ownerCity,
          state: lead.ownerState,
          zip: lead.ownerZip,
        },
      })),
      options: { projection: 'custom', customProjection: PROJECTION_GROUPS },
    };

    try {
      const response = await fetch(BATCHDATA_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${BATCHDATA_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        console.error(`[ENRICH] BatchData API error for batch ${i}: ${response.status} ${response.statusText}`);
        continue;
      }

      const data: BatchDataResponse = await response.json();

      // 🔎 Full raw response — captured so we can confirm the real subscription shape.
      console.log(`[ENRICH] Full BatchData response (batch ${i}, ${batch.length} lead(s)):`, JSON.stringify(data));

      if (data?.status?.code && data.status.code !== 200) {
        console.error(`[ENRICH] BatchData status ${data.status.code} ${data.status.text || ''}`);
        continue;
      }

      // Aggregate BatchData's authoritative match accounting (the billing source of truth).
      const batchMeta = readBatchMeta(data);
      meta.matchCount += batchMeta.matchCount;
      meta.noMatchCount += batchMeta.noMatchCount;
      if (batchMeta.requestId) meta.requestIds.push(batchMeta.requestId);

      const properties = data?.results?.properties || [];
      // Match each returned property back to its lead by normalized address (no-match results can
      // shift indices, so don't rely on position). Single-lead batches fall back to index 0.
      const leadByAddr = new Map(batch.map((lead) => [normalizeAddr(lead.ownerAddress, lead.ownerZip), lead]));
      properties.forEach((property, idx) => {
        const propKey = normalizeAddr(
          property.address?.streetNoUnit || property.address?.street,
          property.address?.zip,
        );
        const lead = leadByAddr.get(propKey) || (batch.length === 1 ? batch[0] : undefined);
        if (!lead) {
          console.warn(`[ENRICH] Could not match returned property #${idx} (${propKey}) to a lead in batch ${i}`);
          return;
        }
        results.set(lead.id, mapPropertyToLead(property, lead));
      });
    } catch (error) {
      console.error(`[ENRICH] Error enriching batch ${i}:`, error);
    }
  }

  return { results, meta };
}

/**
 * Enrich a single preforeclosure lead (thin wrapper over the batch path).
 */
export async function enrichPreforeclosureLead(lead: DBLead): Promise<Partial<DBLead>> {
  if (lead.type?.toUpperCase() !== 'PREFORECLOSURE') {
    throw new Error('BatchData enrichment only for PREFORECLOSURE leads');
  }
  const { results } = await enrichPreforeclosureLeads([lead]);
  return results.get(lead.id) || {};
}

// ---- Mapping ----

/** Map a BatchData property to the lead fields we persist. Never sets phones/emails. */
function mapPropertyToLead(property: EnrichProperty, lead: DBLead): Partial<DBLead> {
  const v = property.valuation || {};
  const lien = property.openLien || {};
  const fc = property.foreclosure || {};
  const owner = property.owner || {};
  const building = property.building || {};

  // County filing is authoritative. If BatchData's newest foreclosure event predates the county
  // recording date, BatchData is describing a PRIOR (often rescinded) foreclosure and hasn't ingested
  // the fresh filing yet — do NOT let it overwrite the county foreclosure fields (we still keep its
  // raw object in foreclosureData for reference). countyFilingDate itself is never written here.
  const countyMs = lead.countyFilingDate ? new Date(lead.countyFilingDate).getTime() : NaN;
  const bdEventMs = [fc.recordingDate, fc.filingDate, fc.defaultDate, fc.auctionDate]
    .map((d) => (d ? new Date(d).getTime() : NaN))
    .filter((t) => !Number.isNaN(t))
    .reduce((max, t) => (t > max ? t : max), -Infinity);
  const batchForeclosureStale =
    !Number.isNaN(countyMs) && bdEventMs !== -Infinity && bdEventMs < countyMs;
  if (batchForeclosureStale) {
    console.warn(
      `[ENRICH] BatchData foreclosure record for lead ${lead.id} predates the county filing ` +
        `(${new Date(bdEventMs).toISOString().slice(0, 10)} < ${lead.countyFilingDate}) — keeping county data.`,
    );
  }

  const enrichment: Partial<DBLead> = {
    // Valuation / equity
    estimatedValue: v.estimatedValue ?? lead.estimatedValue,
    estimatedEquity: v.equityCurrentEstimatedBalance ?? lead.estimatedEquity,
    equityPercent: v.equityPercent ?? lead.equityPercent,
    ltv: v.ltv ?? lead.ltv,

    // Liens / mortgages
    mortgageBalance: lien.totalOpenLienBalance ?? lead.mortgageBalance,
    freeAndClear: typeof lien.totalOpenLienBalance === 'number' ? lien.totalOpenLienBalance === 0 : lead.freeAndClear,
    openLienData: asJson(property.openLien),

    // Owner / occupancy
    ownerOccupied: owner.ownerOccupied ?? lead.ownerOccupied,
    hasLandline: owner.hasLandline ?? lead.hasLandline,

    // Property basics
    homeDetails: asJson(property.building) ?? lead.homeDetails,

    // Foreclosure (the priority object). The *Date fields are schema type a.date() (AWSDate = YYYY-MM-DD),
    // but BatchData sends full ISO datetimes — toDateOnly strips the time so the write doesn't get rejected.
    // When BatchData is stale relative to the county filing, keep the authoritative county values.
    foreclosureStatus: batchForeclosureStale ? lead.foreclosureStatus : (fc.status ?? lead.foreclosureStatus),
    foreclosureRecordingDate: batchForeclosureStale ? lead.foreclosureRecordingDate : (toDateOnly(fc.recordingDate) ?? lead.foreclosureRecordingDate),
    foreclosureAuctionDate: batchForeclosureStale ? lead.foreclosureAuctionDate : (toDateOnly(fc.auctionDate) ?? lead.foreclosureAuctionDate),
    foreclosureUnpaidBalance: batchForeclosureStale ? lead.foreclosureUnpaidBalance : (fc.unpaidBalance ?? lead.foreclosureUnpaidBalance),
    foreclosureAmount: batchForeclosureStale ? lead.foreclosureAmount : (fc.unpaidBalance ?? fc.pastDueAmount ?? lead.foreclosureAmount),
    foreclosureCaseNumber: batchForeclosureStale ? lead.foreclosureCaseNumber : (fc.caseNumber ?? lead.foreclosureCaseNumber),
    foreclosureLenderName: batchForeclosureStale ? lead.foreclosureLenderName : (fc.currentLenderName ?? lead.foreclosureLenderName),
    foreclosureDefaultDate: batchForeclosureStale ? lead.foreclosureDefaultDate : (toDateOnly(fc.defaultDate) ?? lead.foreclosureDefaultDate),
    foreclosureTrustee: batchForeclosureStale ? lead.foreclosureTrustee : (fc.trusteeName ?? lead.foreclosureTrustee),
    foreclosureTrusteePhone: batchForeclosureStale ? lead.foreclosureTrusteePhone : (fc.trusteePhone ?? lead.foreclosureTrusteePhone),
    foreclosureData: asJson(property.foreclosure), // always keep BatchData's raw object for reference

    // Raw capture (nothing lost)
    rawEnrichmentData: asJson(property),

    batchDataEnriched: true,
    batchDataEnrichedAt: new Date().toISOString(),
  };

  // NOTE: we deliberately do NOT append to `notes` here. It's the only `a.json().array()` field enrichment
  // touches, and appending through the SSR Amplify Data client fails the whole update ("Variable 'notes' has
  // an invalid value"). The enrichment summary is redundant with the structured fields + the Job Reports tab.

  return enrichment;
}

// ---- Helpers ----

/** Normalized key for matching a returned property back to its lead (alphanumeric street + 5-digit zip). */
function normalizeAddr(street?: string | null, zip?: string | null): string {
  const s = (street || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const z = (zip || '').replace(/[^0-9]/g, '').slice(0, 5);
  return `${s}_${z}`;
}

