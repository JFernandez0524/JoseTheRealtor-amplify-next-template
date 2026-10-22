/**
 * THANKS.IO RECIPIENT BUILDER (manual direct-mail sends)
 *
 * Pure helpers that turn a PropertyLead into a Thanks.io `POST /api/v2/recipients` payload for the
 * mailing list the USER picked. Nothing here routes leads automatically — the list is always an
 * explicit choice made in the dashboard's "Send to Thanks.io" modal.
 *
 * Custom field contract (shared with the Thanks.io letter templates and thanksIoWebhookHandler):
 *   custom1 → GHL contact id   (delivery / QR-scan webhooks resolve the contact from this)
 *   custom2 → Zestimate        (QR landing page valuation)
 *   custom3 → Property street  (%CUSTOM3%)
 *   custom4 → Property city    (%CUSTOM4%)
 *   custom5 → Sheriff sale date, e.g. "December 2, 2026"   (%CUSTOM5%, auction letter only)
 *   custom6 → Estimated equity, e.g. "$346,200"           (%CUSTOM6%)
 *
 * USED BY: app/api/v1/thanksio/add-recipients/route.ts
 */
import { computeForeclosureFinancials } from './foreclosureFinancials';

export const THANKS_IO_API_BASE = 'https://api.thanks.io/api/v2';

export type ThanksIoListKey = 'PREFORECLOSURE_AUCTION' | 'PREFORECLOSURE_LIS_PENDENS' | 'PROBATE';

export interface ThanksIoListConfig {
  key: ThanksIoListKey;
  id: number;
  label: string;
  /** Lead type this list accepts (leads of any other type are rejected). */
  leadType: 'PREFORECLOSURE' | 'PROBATE';
  /** The letter for this list prints %CUSTOM5% (sale date) — a lead without a future sale date can't be sent. */
  requiresSaleDate: boolean;
  /** The letter for this list prints %CUSTOM6% (equity) — a lead without positive equity can't be sent. */
  requiresEquity: boolean;
  /** Minimum required equity percentage (e.g. 30 for 30%+ equity). */
  minEquityPct?: number;
}

export const THANKS_IO_LISTS: Record<ThanksIoListKey, ThanksIoListConfig> = {
  PREFORECLOSURE_AUCTION: {
    key: 'PREFORECLOSURE_AUCTION',
    id: 337586,
    label: 'Preforeclosure - Auction',
    leadType: 'PREFORECLOSURE',
    requiresSaleDate: true,
    requiresEquity: true,
    minEquityPct: 30,
  },
  PREFORECLOSURE_LIS_PENDENS: {
    key: 'PREFORECLOSURE_LIS_PENDENS',
    id: 309826,
    label: 'Preforeclosure - Lis Pendens',
    leadType: 'PREFORECLOSURE',
    requiresSaleDate: false,
    requiresEquity: true,
  },
  PROBATE: {
    key: 'PROBATE',
    id: 302546,
    label: 'Probate Mailing List',
    leadType: 'PROBATE',
    requiresSaleDate: false,
    requiresEquity: false,
  },
};

export function getThanksIoList(mailingListId: number): ThanksIoListConfig | null {
  return Object.values(THANKS_IO_LISTS).find((l) => l.id === mailingListId) ?? null;
}

/** Tag written to `customTags` once a lead is on a list — prevents mailing the same lead twice. */
export function thanksIoListTag(mailingListId: number): string {
  return `thanksio:${mailingListId}`;
}

/** Listing statuses that block mail (the property is listed, sold, under contract, or manually skipped). */
const BLOCKED_LISTING_STATUSES = new Set(['active', 'sold', 'pending', 'skip']);

export interface ThanksIoRecipientPayload {
  mailing_list_id: number;
  name: string;
  company: string;
  address: string;
  address2?: string;
  city: string;
  province: string;
  postal_code: string;
  country: 'US';
  custom1?: string;
  custom2?: string;
  custom3?: string;
  custom4?: string;
  custom5?: string;
  custom6?: string;
}

export type BuildRecipientResult =
  | { ok: true; payload: ThanksIoRecipientPayload }
  | { ok: false; reason: string };

const toTitleCase = (s?: string | null): string =>
  (s || '').trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const clean = (s?: string | null): string => (s || '').trim();

function parseJsonSafe(v: unknown): Record<string, any> {
  if (!v) return {};
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return p && typeof p === 'object' ? p : {};
    } catch {
      return {};
    }
  }
  return typeof v === 'object' ? (v as Record<string, any>) : {};
}

/** Parse "12/2/2026" or "2026-12-02" into a local Date at midnight; null when unparseable. */
export function parseSaleDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (us) return new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "December 2, 2026" — reads naturally inside a handwritten letter. */
export function formatSaleDateForLetter(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatCurrency(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/** Name the letter is addressed to: the estate admin for probate, the owner otherwise. */
function resolveRecipientName(lead: any, isProbate: boolean): string {
  const first = isProbate ? lead.adminFirstName || lead.ownerFirstName : lead.ownerFirstName;
  const last = isProbate ? lead.adminLastName || lead.ownerLastName : lead.ownerLastName;
  return toTitleCase([first, last].filter(Boolean).join(' '));
}

/**
 * Where the letter physically goes. Probate → admin's address. Everyone else → their mailing address
 * (absentee owners), falling back to the property itself (owner-occupied).
 */
function resolveMailingAddress(lead: any, isProbate: boolean) {
  const adminStd = parseJsonSafe(lead.adminStandardizedAddress);
  const propStd = parseJsonSafe(lead.standardizedAddress);
  const val = (v: any) => (v && typeof v === 'object' && 'S' in v ? v.S : v);

  if (isProbate) {
    const street = val(adminStd.street) || lead.adminAddress || lead.mailingAddress;
    if (clean(street)) {
      return {
        address: street,
        city: val(adminStd.city) || lead.adminCity || lead.mailingCity,
        state: val(adminStd.state) || lead.adminState || lead.mailingState,
        zip: val(adminStd.zip) || lead.adminZip || lead.mailingZip,
      };
    }
  } else if (clean(lead.mailingAddress) && clean(lead.mailingZip)) {
    return {
      address: lead.mailingAddress,
      city: lead.mailingCity,
      state: lead.mailingState,
      zip: lead.mailingZip,
    };
  }

  return {
    address: propStd.street || lead.ownerAddress,
    city: propStd.city || lead.ownerCity,
    state: propStd.state || lead.ownerState,
    zip: propStd.zip || lead.ownerZip,
  };
}

/**
 * Validate a lead against the chosen list and build its Thanks.io recipient payload.
 * Returns `{ ok: false, reason }` for anything that would produce a broken or unwanted letter.
 */
export function buildThanksIoRecipient(
  lead: any,
  list: ThanksIoListConfig,
  now: Date = new Date(),
): BuildRecipientResult {
  if (!lead) return { ok: false, reason: 'Lead not found' };

  const leadType = String(lead.type || '').toUpperCase().replace(/[_\s-]+/g, '');
  if (leadType !== list.leadType) {
    return { ok: false, reason: `Lead type ${lead.type || 'unknown'} does not belong on "${list.label}"` };
  }

  const rawListing = lead.listingStatus === undefined || lead.listingStatus === null
    ? 'off_market'
    : lead.listingStatus;
  const listing = String(rawListing).toLowerCase().trim().replace(/[\s_-]+/g, '');
  if (listing !== 'offmarket') {
    return { ok: false, reason: `Listing status is "${lead.listingStatus}" (only off-market leads are eligible for mail)` };
  }

  const labels: string[] = (lead.leadLabels || []).filter(Boolean);
  if (labels.some((l) => ['DNC', 'Do_Not_Call', 'Not_Interested'].includes(l))) {
    return { ok: false, reason: 'Lead is marked DNC / Not Interested' };
  }

  // Check Call Outcome (GHL field sync / cached outcome).
  // Wrong Number is a phone-level issue, so direct mail is still permitted.
  const outreach = parseJsonSafe(lead.ghlOutreachData);
  const callOutcome = clean(outreach.callOutcome || lead.callOutcome);
  if (callOutcome) {
    const o = callOutcome.toLowerCase();
    const isWrongNumber = o.includes('wrong number') || o.includes('disconnected') || o.includes('invalid number') || o.includes('incorrect number');
    if (!isWrongNumber) {
      const blockedDispositions = [
        'not interested',
        'not for sale',
        'not selling',
        'dnc',
        'do not call',
        'unsubscribe',
        'remove',
        'sold already',
        'sold',
        'listed with realtor',
        'listed',
      ];
      if (blockedDispositions.some((b) => o.includes(b))) {
        return { ok: false, reason: `Call Outcome is "${callOutcome}"` };
      }
    }
  }

  if ((lead.customTags || []).includes(thanksIoListTag(list.id))) {
    return { ok: false, reason: `Already added to "${list.label}"` };
  }

  const isProbate = list.leadType === 'PROBATE';
  const name = resolveRecipientName(lead, isProbate);
  if (!name) return { ok: false, reason: 'Missing recipient name' };

  const mail = resolveMailingAddress(lead, isProbate);
  if (!clean(mail.address) || !clean(mail.city) || !clean(mail.state) || !clean(mail.zip)) {
    return { ok: false, reason: 'Incomplete mailing address' };
  }

  const fin = computeForeclosureFinancials(lead);

  let saleDateText: string | undefined;
  if (list.requiresSaleDate) {
    const saleDate = parseSaleDate(fin.saleDate);
    if (!saleDate) return { ok: false, reason: 'No sheriff sale date on file' };
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (saleDate.getTime() < today.getTime()) {
      return { ok: false, reason: `Sheriff sale date ${fin.saleDate} has already passed` };
    }
    saleDateText = formatSaleDateForLetter(saleDate);
  }

  let equityText: string | undefined;
  if (fin.equitySpread != null && fin.equitySpread > 0) {
    if (list.minEquityPct != null && (fin.equitySpreadPct == null || fin.equitySpreadPct < list.minEquityPct)) {
      return {
        ok: false,
        reason: `Estimated equity ${fin.equitySpreadPct != null ? `${fin.equitySpreadPct}%` : 'unknown'} is below the required ${list.minEquityPct}% minimum`,
      };
    }
    equityText = formatCurrency(fin.equitySpread);
  } else if (list.requiresEquity) {
    return { ok: false, reason: 'No positive estimated equity (missing Zestimate or debt amount, or underwater)' };
  }

  const zestimate = lead.zestimate || lead.estimatedValue;

  const payload: ThanksIoRecipientPayload = {
    mailing_list_id: list.id,
    name,
    company: 'Or Current Resident',
    address: toTitleCase(mail.address),
    city: toTitleCase(mail.city),
    province: clean(mail.state).toUpperCase(),
    postal_code: clean(mail.zip).replace(/[^0-9-]/g, '').slice(0, 10),
    country: 'US',
    custom1: lead.ghlContactId || undefined,
    custom2: zestimate ? String(Math.round(Number(zestimate))) : undefined,
    custom3: toTitleCase(lead.ownerAddress) || undefined,
    custom4: toTitleCase(lead.ownerCity) || undefined,
    custom5: saleDateText,
    custom6: equityText,
  };

  return { ok: true, payload };
}
