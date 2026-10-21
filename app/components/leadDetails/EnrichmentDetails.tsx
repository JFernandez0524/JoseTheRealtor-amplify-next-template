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
import { classifyForeclosureStageWithRecency } from '@/app/utils/foreclosure';
import { computeForeclosureFinancials } from '@/amplify/functions/shared/foreclosureFinancials';

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
  const sourceRaw = parseJson((lead as any).sourceRawData) || {};
  const val = raw.valuation || {};
  const mortgages: any[] = Array.isArray(lien.mortgages) ? lien.mortgages : [];
  const history: any[] = Array.isArray(raw.mortgageHistory) ? raw.mortgageHistory : [];
  const invLiens: any[] = Array.isArray(raw.involuntaryLien?.liens) ? raw.involuntaryLien.liens : [];
  const isEnriched = Boolean((lead as any).batchDataEnriched);

  const fcFin = computeForeclosureFinancials(lead);
  const saleDateRaw = fcFin.saleDate;

  // Recency-aware: fall back to the blob's status if the flat column is empty, then judge staleness
  // against the county filing so a years-old BatchData "rescission" doesn't read as DEAD on a fresh lead.
  const { stage, baseStage, stale } = classifyForeclosureStageWithRecency({
    ...(lead as any),
    foreclosureStatus:
      (lead as any).foreclosureStatus ||
      fc.status ||
      (saleDateRaw ? 'Scheduled Sheriff Sale' : undefined),
    foreclosureAuctionDate: saleDateRaw,
  });
  const isEntity = (lead as any).isEntityOwner === true;
  const isTax = (lead as any).isTaxForeclosure === true;
  const fcCategory = (lead as any).foreclosureCategory || null;
  const fcEvidence: string[] = Array.isArray((lead as any).foreclosureEvidence)
    ? (lead as any).foreclosureEvidence.filter(Boolean)
    : [];

  const approxUpset = fcFin.approxUpset;
  const estUpset = fcFin.estimatedUpset;
  const estimatedSpread = fcFin.equitySpread;
  const equitySpreadPct = fcFin.equitySpreadPct;
  const equityTier = fcFin.equityTier;

  const caseNumber =
    (lead as any).foreclosureCaseNumber ||
    sourceRaw.court_case_number ||
    sourceRaw['CASE NUMBER'] ||
    sourceRaw['Case Number'] ||
    fc.caseNumber ||
    null;
  const sheriffNumber = sourceRaw.sheriff_number || null;
  const plaintiffOrLender =
    (lead as any).plaintiffName ||
    (lead as any).foreclosureLenderName ||
    sourceRaw.plaintiff ||
    sourceRaw['LENDER-OR-PLAINTIFF-NAME'] ||
    sourceRaw['Lender Or Plaintiff Name'] ||
    fc.currentLenderName ||
    null;
  const defendantOrBorrower =
    (lead as any).defendantName ||
    sourceRaw.defendant ||
    sourceRaw['BORROWER-OR-DEFENDANT-NAME'] ||
    sourceRaw['Borrower Or Defendant Name'] ||
    fc.borrowerName ||
    [lead.ownerFirstName, lead.ownerLastName].filter(Boolean).join(' ') ||
    null;
  const attorneyOrTrustee =
    (lead as any).foreclosureTrustee ||
    sourceRaw.attorney ||
    sourceRaw['TRUSTEE-OR-DEPUTY-NAME'] ||
    sourceRaw['Trustee Or Deputy Name'] ||
    fc.trusteeName ||
    null;
  const attorneyPhone =
    (lead as any).foreclosureTrusteePhone ||
    sourceRaw.attorney_phone ||
    fc.trusteePhone ||
    null;
  const parcelDisplay =
    (lead as any).parcelId ||
    sourceRaw.parcel_id ||
    sourceRaw['PARCEL-ID-NO'] ||
    sourceRaw['Parcel ID'] ||
    (sourceRaw.block || sourceRaw.lot
      ? `Block ${sourceRaw.block || '—'} Lot ${sourceRaw.lot || '—'}`
      : null);

  return (
    <div>
      {/* Sheriff Sale / Lis Pendens Summary Banner (always shown when preforeclosure data exists) */}
      <Section
        title={
          fcFin.isSheriffSale
            ? 'Sheriff Sale & Foreclosure Summary'
            : 'Lis Pendens & Pre-Foreclosure Summary'
        }
      >
        <div className='mb-4 flex flex-wrap items-center gap-2'>
          {fcFin.foreclosureSubType === 'SHERIFF_SALE' && (
            <span className='px-2.5 py-1 text-xs font-bold rounded bg-rose-100 text-rose-800 border border-rose-300'>
              🔨 SHERIFF SALE / AUCTION
            </span>
          )}
          {fcFin.foreclosureSubType === 'LIS_PENDENS' && (
            <span className='px-2.5 py-1 text-xs font-bold rounded bg-amber-100 text-amber-800 border border-amber-300'>
              📋 LIS PENDENS FILING
            </span>
          )}
          <span className={`px-2.5 py-1 text-xs font-bold rounded ${STAGE_STYLE[stage]}`}>{stage}</span>
          {fcCategory && (
            <span className='px-2.5 py-1 text-xs font-bold rounded bg-indigo-100 text-indigo-800'>
              {String(fcCategory).replace(/_/g, ' ')}
            </span>
          )}
          {sourceRaw.days_until_sale && (
            <span className='px-2.5 py-1 text-xs font-bold rounded bg-red-50 text-red-700 border border-red-200'>
              ⏳ {sourceRaw.days_until_sale} Days Until Sale
            </span>
          )}
          {(isTax || fcFin.baselineLabel === 'Tax Lien') && (
            <span className='px-2.5 py-1 text-xs font-bold rounded bg-emerald-100 text-emerald-800'>
              🏛️ TAX FORECLOSURE
            </span>
          )}
          {isEntity && (
            <span className='px-2.5 py-1 text-xs font-bold rounded bg-slate-200 text-slate-700'>
              🏢 ENTITY OWNER
            </span>
          )}
          {equityTier === 'HIGH_EQUITY' && (
            <span className='px-2.5 py-1 text-xs font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-300'>
              🔥 HIGH EQUITY SPREAD{equitySpreadPct != null ? ` (${equitySpreadPct}%)` : ''}
            </span>
          )}
          {equityTier === 'MODERATE_EQUITY' && (
            <span className='px-2.5 py-1 text-xs font-bold rounded bg-teal-50 text-teal-800 border border-teal-200'>
              ✅ POSITIVE SPREAD{equitySpreadPct != null ? ` (${equitySpreadPct}%)` : ''}
            </span>
          )}
          {equityTier === 'UNDERWATER' && (
            <span className='px-2.5 py-1 text-xs font-bold rounded bg-red-100 text-red-800 border border-red-300'>
              ⚠️ UNDERWATER{equitySpreadPct != null ? ` (${equitySpreadPct}%)` : ''}
            </span>
          )}
        </div>

        {/* Upset / Loan vs Zestimate Financial Cards */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5'>
          {fcFin.isSheriffSale ? (
            <>
              <Field label='Sheriff Sale / Auction Date' value={saleDateRaw ? date(saleDateRaw) : '—'} />
              <Field label='Approx. Upset' value={money(approxUpset)} />
              <Field label='Estimated Upset / Judgment' value={money(estUpset ?? fcFin.baselineUpset)} />
            </>
          ) : (
            <>
              <Field
                label='LP Recording / Filing Date'
                value={fcFin.recordingDate ? date(fcFin.recordingDate) : '—'}
              />
              <Field label='Zestimate / Est. Value' value={money(fcFin.zestimateVal)} />
              <Field
                label={`Recorded ${fcFin.baselineLabel} Amount`}
                value={money(fcFin.baselineUpset)}
              />
            </>
          )}
          <div>
            <p className='text-xs text-gray-500 mb-0.5'>
              Est. Equity Spread (Zestimate − {fcFin.baselineLabel})
            </p>
            <div className='flex items-baseline gap-1.5'>
              <p
                className={`text-sm font-bold ${
                  estimatedSpread == null
                    ? 'text-gray-900'
                    : estimatedSpread >= 0
                      ? 'text-emerald-700'
                      : 'text-red-600'
                }`}
              >
                {estimatedSpread != null ? money(estimatedSpread) : '—'}
              </p>
              {equitySpreadPct != null && (
                <span
                  className={`text-xs font-semibold ${
                    equitySpreadPct >= 30
                      ? 'text-emerald-600'
                      : equitySpreadPct > 0
                        ? 'text-teal-600'
                        : 'text-red-500'
                  }`}
                >
                  ({equitySpreadPct}%)
                </span>
              )}
            </div>
          </div>
        </div>

        {stale && (
          <div className='mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800'>
            ⚠️ BatchData&apos;s foreclosure record ({date((lead as any).foreclosureRecordingDate || fc.recordingDate || fc.filingDate)})
            predates the county filing ({date((lead as any).countyFilingDate)}) and reads as{' '}
            <span className='font-bold'>{baseStage}</span>. It likely reflects a prior foreclosure —
            treating this lead as <span className='font-bold'>ACTIVE</span> based on the fresh filing.
          </div>
        )}

        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <Field label='Court Case Number' value={txt(caseNumber)} />
          <Field label='Sheriff File Number' value={txt(sheriffNumber)} />
          <Field label='Parcel ID (Block / Lot)' value={txt(parcelDisplay)} />
          <Field label='Defendant / Borrower' value={txt(defendantOrBorrower)} />
          <Field label='Attorney / Trustee' value={txt(attorneyOrTrustee)} />
          <Field label='Attorney / Trustee Phone' value={txt(attorneyPhone)} />
          <div className='md:col-span-3'>
            <Field label='Plaintiff / Foreclosing Lender' value={txt(plaintiffOrLender)} />
          </div>
          {(fcFin.recordingDate || (lead as any).countyFilingDate || (lead as any).foreclosureRecordingDate || fc.recordingDate) && (
            <Field
              label='County Filing / Recording Date'
              value={date(fcFin.recordingDate || (lead as any).countyFilingDate || (lead as any).foreclosureRecordingDate || fc.recordingDate)}
            />
          )}
          {sourceRaw.property_id && (
            <Field label='Sheriff Listing Property ID' value={txt(sourceRaw.property_id)} />
          )}
          {sourceRaw.occupancy_status && (
            <Field label='Occupancy Status' value={txt(sourceRaw.occupancy_status)} />
          )}
        </div>

        {fcEvidence.length > 0 && (
          <div className='mt-4 bg-indigo-50/60 border border-indigo-100 rounded-lg px-3.5 py-2.5 text-xs text-indigo-900'>
            <p className='font-bold uppercase tracking-wider text-[10px] text-indigo-500 mb-1'>
              Foreclosure Classification Evidence
            </p>
            <ul className='list-disc list-inside space-y-0.5'>
              {fcEvidence.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* BatchData Enrichment Sections (only rendered when BatchData enrichment has been run) */}
      {isEnriched && (
        <>
          <Section title='BatchData Valuation & Equity'>
            <div className='grid grid-cols-2 md:grid-cols-3 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-200'>
              <Field label='Estimated Value' value={money(lead.estimatedValue ?? val.estimatedValue)} />
              <Field label='Value Range' value={val.priceRangeMin ? `${money(val.priceRangeMin)} – ${money(val.priceRangeMax)}` : '—'} />
              <Field label='Confidence' value={val.confidenceScore ? `${val.confidenceScore}/100` : '—'} />
              <Field label='Equity' value={money(lead.estimatedEquity ?? val.equityCurrentEstimatedBalance)} />
              <Field label='Equity %' value={pct(lead.equityPercent ?? val.equityPercent)} />
              <Field label='LTV %' value={pct(lead.ltv ?? val.ltv)} />
            </div>
          </Section>

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
        </>
      )}

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

      {/* Raw Scraper / Source Payload */}
      {Object.keys(sourceRaw).length > 0 && (
        <Collapsible label='View County / Scraper Source Data'>
          <pre className='text-[10px] bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto max-h-96'>
            {JSON.stringify(sourceRaw, null, 2)}
          </pre>
        </Collapsible>
      )}

      {/* Full raw BatchData payload */}
      {Object.keys(raw).length > 0 && (
        <Collapsible label='View BatchData Enrichment Payload (JSON)'>
          <pre className='text-[10px] bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto max-h-96'>
            {JSON.stringify(raw, null, 2)}
          </pre>
        </Collapsible>
      )}

      {isEnriched && (
        <p className='text-xs text-gray-400 mt-4'>
          Enriched on {(lead as any).batchDataEnrichedAt ? new Date((lead as any).batchDataEnrichedAt).toLocaleString() : 'N/A'} · source: BatchData
        </p>
      )}
    </div>
  );
}
