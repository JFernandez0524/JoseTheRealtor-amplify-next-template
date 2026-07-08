'use client';

/**
 * EnrichmentDetails — surfaces the FULL BatchData enrichment payload on the lead detail page so users can
 * see everything they paid for. Renders the flat foreclosure/valuation fields plus the three stored JSON
 * blobs (foreclosureData, openLienData with per-mortgage detail, rawEnrichmentData = the whole property
 * object: valuation range, owner, mortgage history, involuntary liens). Every section is null-safe — it
 * skips whatever a given record doesn't have (rescinded records have no auction date, older leads have no
 * blobs, etc.). Rendered by LeadDetailClient for enriched PREFORECLOSURE leads.
 */
import { useState } from 'react';
import type { Schema } from '@/amplify/data/resource';
import { classifyForeclosureStage } from '@/app/utils/foreclosure';

type Lead = Schema['PropertyLead']['type'];

const money = (v: any) => (v || v === 0 ? `$${Number(v).toLocaleString()}` : '—');
const pct = (v: any) => (v || v === 0 ? `${v}%` : '—');
const date = (v: any) => (v ? new Date(v).toLocaleDateString() : '—');
const txt = (v: any) => (v ?? '—');

/** Blobs come back as objects, but tolerate strings (our asJson write path). */
function parseJson(v: any): any {
  if (v == null) return null;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return null; }
  }
  return v;
}

const STAGE_STYLE: Record<string, string> = {
  AUCTION: 'bg-red-100 text-red-800',
  ACTIVE: 'bg-orange-100 text-orange-800',
  DEAD: 'bg-gray-200 text-gray-600',
  UNKNOWN: 'bg-gray-100 text-gray-500',
};

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className='text-xs text-gray-500 mb-0.5'>{label}</p>
      <p className='text-sm font-semibold text-gray-900 break-words'>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className='pt-4 mt-4 border-t border-gray-100 first:pt-0 first:mt-0 first:border-0'>
      <h3 className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-3'>{title}</h3>
      {children}
    </div>
  );
}

function Collapsible({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className='pt-4 mt-4 border-t border-gray-100'>
      <button onClick={() => setOpen((o) => !o)} className='text-xs font-bold text-blue-600 hover:text-blue-800'>
        {open ? '▾' : '▸'} {label}
      </button>
      {open && <div className='mt-3'>{children}</div>}
    </div>
  );
}

export function EnrichmentDetails({ lead }: { lead: Lead }) {
  const raw = parseJson((lead as any).rawEnrichmentData) || {};
  const fc = parseJson((lead as any).foreclosureData) || raw.foreclosure || {};
  const lien = parseJson((lead as any).openLienData) || raw.openLien || {};
  const val = raw.valuation || {};
  const mortgages: any[] = Array.isArray(lien.mortgages) ? lien.mortgages : [];
  const history: any[] = Array.isArray(raw.mortgageHistory) ? raw.mortgageHistory : [];
  const invLiens: any[] = Array.isArray(raw.involuntaryLien?.liens) ? raw.involuntaryLien.liens : [];

  const stage = classifyForeclosureStage((lead as any).foreclosureStatus || fc.status);

  return (
    <div>
      {/* Valuation & Equity */}
      <Section title='Valuation & Equity'>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-200'>
          <Field label='Estimated Value' value={money(lead.estimatedValue ?? val.estimatedValue)} />
          <Field label='Value Range' value={val.priceRangeMin ? `${money(val.priceRangeMin)} – ${money(val.priceRangeMax)}` : '—'} />
          <Field label='Confidence' value={val.confidenceScore ? `${val.confidenceScore}/100` : '—'} />
          <Field label='Equity' value={money(lead.estimatedEquity ?? val.equityCurrentEstimatedBalance)} />
          <Field label='Equity %' value={pct(lead.equityPercent ?? val.equityPercent)} />
          <Field label='LTV %' value={pct(lead.ltv ?? val.ltv)} />
        </div>
      </Section>

      {/* Foreclosure */}
      <Section title='Foreclosure'>
        <div className='mb-3'>
          <span className={`px-2 py-1 text-xs font-bold rounded ${STAGE_STYLE[stage]}`}>{stage}</span>
        </div>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
          <Field label='Status' value={txt((lead as any).foreclosureStatus || fc.status)} />
          <Field label='Document Type' value={txt(fc.documentType)} />
          <Field label='Case Number' value={txt((lead as any).foreclosureCaseNumber || fc.caseNumber)} />
          <Field label='Recording Date' value={date((lead as any).foreclosureRecordingDate || fc.recordingDate)} />
          <Field label='Filing Date' value={date(fc.filingDate)} />
          <Field label='Default Date' value={date((lead as any).foreclosureDefaultDate || fc.defaultDate)} />
          <Field label='Auction Date' value={date((lead as any).foreclosureAuctionDate || fc.auctionDate)} />
          <Field label='Unpaid Balance' value={money((lead as any).foreclosureUnpaidBalance ?? fc.unpaidBalance)} />
          <Field label='Borrower' value={txt(fc.borrowerName)} />
          <Field label='Trustee' value={txt((lead as any).foreclosureTrustee || fc.trusteeName)} />
          <Field label='Trustee Phone' value={txt((lead as any).foreclosureTrusteePhone || fc.trusteePhone)} />
          <Field label='Lender' value={txt((lead as any).foreclosureLenderName || fc.currentLenderName)} />
        </div>
      </Section>

      {/* Open Liens / Mortgages */}
      <Section title='Open Liens & Mortgages'>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-4 mb-3'>
          <Field label='Total Open Lien Balance' value={money(lead.mortgageBalance ?? lien.totalOpenLienBalance)} />
          <Field label='Open Lien Count' value={txt(lien.totalOpenLienCount)} />
          <Field label='Loan Types' value={Array.isArray(lien.allLoanTypes) ? lien.allLoanTypes.join(', ') : '—'} />
        </div>
        {mortgages.length > 0 && (
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead className='bg-gray-50 text-gray-500 uppercase'>
                <tr>
                  <th className='px-2 py-2 text-left'>Lender</th>
                  <th className='px-2 py-2 text-left'>Type</th>
                  <th className='px-2 py-2 text-right'>Original</th>
                  <th className='px-2 py-2 text-right'>Est. Balance</th>
                  <th className='px-2 py-2 text-right'>Rate</th>
                  <th className='px-2 py-2 text-right'>Est. Payment</th>
                  <th className='px-2 py-2 text-left'>Due</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100'>
                {mortgages.map((m, i) => (
                  <tr key={i}>
                    <td className='px-2 py-2 font-medium text-gray-800'>{txt(m.lenderName)}</td>
                    <td className='px-2 py-2 text-gray-600'>{txt(m.loanType)}</td>
                    <td className='px-2 py-2 text-right'>{money(m.loanAmount)}</td>
                    <td className='px-2 py-2 text-right font-semibold'>{money(m.currentEstimatedBalance)}</td>
                    <td className='px-2 py-2 text-right'>{m.currentEstimatedInterestRate ? `${m.currentEstimatedInterestRate}%` : '—'}</td>
                    <td className='px-2 py-2 text-right'>{money(m.estimatedPaymentAmount)}</td>
                    <td className='px-2 py-2 text-gray-600'>{date(m.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Owner & Occupancy */}
      <Section title='Owner & Occupancy'>
        <div className='flex flex-wrap gap-2'>
          {(lead as any).ownerOccupied && <span className='px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded'>Owner Occupied</span>}
          {lead.freeAndClear && <span className='px-2 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded'>Free &amp; Clear</span>}
          {(lead as any).hasLandline && <span className='px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded'>Has Landline</span>}
          {(lead.equityPercent ?? 0) >= 50 && <span className='px-2 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded'>High Equity</span>}
          {!(lead as any).ownerOccupied && !lead.freeAndClear && !(lead as any).hasLandline && (lead.equityPercent ?? 0) < 50 && (
            <span className='text-sm text-gray-400'>No flags</span>
          )}
        </div>
      </Section>

      {/* Mortgage History (collapsible) */}
      {history.length > 0 && (
        <Collapsible label={`Mortgage History (${history.length})`}>
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead className='bg-gray-50 text-gray-500 uppercase'>
                <tr>
                  <th className='px-2 py-2 text-left'>Recorded</th>
                  <th className='px-2 py-2 text-left'>Lender</th>
                  <th className='px-2 py-2 text-left'>Type</th>
                  <th className='px-2 py-2 text-right'>Amount</th>
                  <th className='px-2 py-2 text-right'>Rate</th>
                  <th className='px-2 py-2 text-left'>Borrowers</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100'>
                {history.map((m, i) => (
                  <tr key={i}>
                    <td className='px-2 py-2 text-gray-600'>{date(m.recordingDate)}</td>
                    <td className='px-2 py-2 font-medium text-gray-800'>{txt(m.lenderName)}</td>
                    <td className='px-2 py-2 text-gray-600'>{txt(m.loanType)}</td>
                    <td className='px-2 py-2 text-right'>{money(m.loanAmount)}</td>
                    <td className='px-2 py-2 text-right'>{m.interestRate ? `${m.interestRate}%` : '—'}</td>
                    <td className='px-2 py-2 text-gray-600'>{Array.isArray(m.borrowers) ? m.borrowers.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Collapsible>
      )}

      {/* Involuntary Liens (collapsible) */}
      {invLiens.length > 0 && (
        <Collapsible label={`Involuntary Liens (${invLiens.length})`}>
          <div className='space-y-2'>
            {invLiens.map((l, i) => (
              <div key={i} className='text-xs bg-gray-50 rounded border px-3 py-2'>
                <span className='font-semibold text-gray-800'>{txt(l.documentType)}</span>
                <span className='text-gray-500'> · recorded {date(l.recordingDate)} · {money(l.lienAmount)}</span>
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      {/* Full raw payload */}
      {Object.keys(raw).length > 0 && (
        <Collapsible label='View full raw payload (JSON)'>
          <pre className='text-[10px] bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto max-h-96'>
            {JSON.stringify(raw, null, 2)}
          </pre>
        </Collapsible>
      )}

      <p className='text-xs text-gray-400 mt-4'>
        Enriched on {(lead as any).batchDataEnrichedAt ? new Date((lead as any).batchDataEnrichedAt).toLocaleString() : 'N/A'} · source: BatchData
      </p>
    </div>
  );
}
