// app/components/leadDetails/PropertyMarketIntel.tsx
'use client';

import React from 'react';
import { type Schema } from '@/amplify/data/resource';
import { CardWrapper } from './CardWrapper';

type Lead = Schema['PropertyLead']['type'];

interface PropertyMarketIntelProps {
  lead: Lead;
  onRefreshZestimate?: () => void;
  isRefreshing?: boolean;
}

export function PropertyMarketIntel({
  lead,
  onRefreshZestimate,
  isRefreshing = false,
}: PropertyMarketIntelProps) {
  // Parse homeDetails JSON if present
  let details: any = {};
  if (lead.homeDetails) {
    try {
      details = typeof lead.homeDetails === 'string' ? JSON.parse(lead.homeDetails) : lead.homeDetails;
    } catch {
      details = {};
    }
  }

  const isSold = lead.listingStatus === 'sold' || (!lead.listingStatus && lead.leadLabels?.includes('RECENTLY_SOLD'));
  const isActive = lead.listingStatus === 'active' || (!lead.listingStatus && lead.leadLabels?.includes('ACTIVE_MLS'));
  const isPending = lead.listingStatus === 'pending';
  const is55Plus = lead.leadLabels?.includes('55_PLUS') || details.community?.includes('55+');
  const hasHoa = lead.leadLabels?.includes('HOA_PROPERTY') || details.hoaFee;
  const isCondo = lead.leadLabels?.includes('CONDO') || details.isCondo || /condo|co-op|coop/i.test(details.propertyType || '');

  const formatMoney = (val?: number | null) =>
    val != null && !isNaN(val) ? `$${Number(val).toLocaleString()}` : null;

  return (
    <CardWrapper title='🏠 Property & Market Intelligence'>
      <div className='space-y-6'>
        {/* Verification Notice */}
        <div className='flex items-start gap-2 p-3 text-xs bg-amber-50/90 border border-amber-200 rounded-lg text-amber-800'>
          <span className='text-base leading-none'>ℹ️</span>
          <div>
            <span className='font-semibold'>Automated Web Intelligence:</span> Property and listing details are compiled from public records and search snippets. Always verify current listing status, pricing, and HOA details directly on your local MLS.
          </div>
        </div>

        {/* Top Status & Summary Banner */}
        <div className='flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200'>
          <div className='flex flex-wrap items-center gap-2'>
            {isSold && (
              <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200'>
                <span className='w-2 h-2 rounded-full bg-red-600 animate-pulse' />
                🔴 SOLD
                {lead.lastSaleAmount ? ` (${formatMoney(lead.lastSaleAmount)})` : ''}
              </span>
            )}
            {isActive && (
              <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200'>
                <span className='w-2 h-2 rounded-full bg-emerald-600 animate-pulse' />
                🟢 ACTIVE MLS
                {details.listPrice ? ` (${formatMoney(details.listPrice)})` : ''}
              </span>
            )}
            {isPending && (
              <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200'>
                🟡 PENDING / UNDER CONTRACT
              </span>
            )}
            {!isSold && !isActive && !isPending && (
              <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-700'>
                ⚪ Off Market
              </span>
            )}
            {isCondo && (
              <span className='inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200'>
                🏢 Condo / Co-op
              </span>
            )}
            {is55Plus && (
              <span className='inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200'>
                🏷️ 55+ Community
              </span>
            )}
            {hasHoa && (
              <span className='inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200'>
                🏷️ HOA: {details.hoaFee ? `${formatMoney(details.hoaFee)}/mo` : 'Yes'}
              </span>
            )}
          </div>

          {onRefreshZestimate && (
            <button
              onClick={onRefreshZestimate}
              disabled={isRefreshing}
              className='text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition shadow-sm disabled:opacity-50 flex items-center gap-1.5'
              title='Re-check Zillow, Redfin, and MLS status'
            >
              {isRefreshing ? '⏳ Refreshing...' : '🔄 Refresh Market Intel'}
            </button>
          )}
        </div>

        {/* AI Intelligence Callout */}
        {details.aiReasoning && (
          <div className='flex items-start gap-2.5 p-3 text-xs bg-indigo-50/90 border border-indigo-200 rounded-xl text-indigo-900'>
            <span className='text-base leading-none'>💡</span>
            <div>
              <span className='font-bold'>AI Listing Synthesis:</span> {details.aiReasoning}
            </div>
          </div>
        )}

        {/* 4-Quadrant Grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          {/* Box 1: Listing & MLS Info */}
          <div className='p-4 rounded-xl border border-gray-100 bg-white shadow-sm space-y-3'>
            <h3 className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
              MLS & Listing Details
            </h3>
            <div className='space-y-2 text-sm'>
              <div className='flex justify-between'>
                <span className='text-gray-500'>Listing Status:</span>
                <span className='font-semibold text-gray-900 capitalize'>
                  {lead.listingStatus ? lead.listingStatus.replace(/_/g, ' ') : 'Off Market'}
                </span>
              </div>
              {details.mlsNumber && (
                <div className='flex justify-between'>
                  <span className='text-gray-500'>MLS Number:</span>
                  <span className='font-mono font-bold text-blue-600'>
                    #{details.mlsNumber}
                  </span>
                </div>
              )}
              {lead.lastSaleAmount && (
                <div className='flex justify-between'>
                  <span className='text-gray-500'>Last Sale Price:</span>
                  <span className='font-bold text-gray-900'>
                    {formatMoney(lead.lastSaleAmount)}
                  </span>
                </div>
              )}
              {lead.lastSaleDate && (
                <div className='flex justify-between'>
                  <span className='text-gray-500'>Last Sale Date:</span>
                  <span className='font-medium text-gray-800'>
                    {new Date(lead.lastSaleDate).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Box 2: Valuation & Rent Intel */}
          <div className='p-4 rounded-xl border border-gray-100 bg-white shadow-sm space-y-3'>
            <h3 className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
              Valuation & Rental Intel
            </h3>
            <div className='space-y-2 text-sm'>
              <div className='flex justify-between items-center'>
                <span className='text-gray-500'>Zestimate®:</span>
                {lead.zestimate ? (
                  <a
                    href={lead.zillowUrl || (lead.zillowZpid ? `https://www.zillow.com/homes/${lead.zillowZpid}_zpid/` : '#')}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='font-bold text-green-700 hover:text-green-900 hover:underline flex items-center gap-1'
                  >
                    {formatMoney(lead.zestimate)} ↗
                  </a>
                ) : (
                  <span className='text-gray-400'>Not Available</span>
                )}
              </div>
              {lead.rentZestimate && (
                <div className='flex justify-between'>
                  <span className='text-gray-500'>Rent Zestimate®:</span>
                  <span className='font-semibold text-gray-900'>
                    {formatMoney(lead.rentZestimate)}/mo
                  </span>
                </div>
              )}
              {lead.estimatedValue && (
                <div className='flex justify-between'>
                  <span className='text-gray-500'>Estimated Value:</span>
                  <span className='font-medium text-gray-900'>
                    {formatMoney(lead.estimatedValue)}
                  </span>
                </div>
              )}
              {lead.type?.toUpperCase() !== 'PROBATE' && lead.estimatedEquity ? (
                <div className='flex justify-between'>
                  <span className='text-gray-500'>Est. Equity:</span>
                  <span className='font-bold text-emerald-600'>
                    {formatMoney(lead.estimatedEquity)}
                  </span>
                </div>
              ) : lead.type?.toUpperCase() === 'PROBATE' ? (
                <div className='flex justify-between' title='Probate leads omit mortgage/debt balance from public court records; equity cannot be assumed'>
                  <span className='text-gray-500'>Est. Equity:</span>
                  <span className='font-medium text-gray-400'>
                    N/A (Probate)
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Box 3: Property Specs */}
          <div className='p-4 rounded-xl border border-gray-100 bg-white shadow-sm space-y-3'>
            <h3 className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
              Property Specifications
            </h3>
            <div className='grid grid-cols-2 gap-3 text-sm'>
              <div>
                <span className='text-xs text-gray-400 block'>Beds / Baths</span>
                <span className='font-semibold text-gray-900'>
                  {details.beds != null ? details.beds : '—'} bd | {details.baths != null ? details.baths : '—'} ba
                </span>
              </div>
              <div>
                <span className='text-xs text-gray-400 block'>Living Area</span>
                <span className='font-semibold text-gray-900'>
                  {details.sqft ? `${Number(details.sqft).toLocaleString()} sqft` : '—'}
                </span>
              </div>
              <div>
                <span className='text-xs text-gray-400 block'>Year Built</span>
                <span className='font-semibold text-gray-900'>
                  {details.yearBuilt || '—'}
                </span>
              </div>
              <div>
                <span className='text-xs text-gray-400 block'>Property Type</span>
                <span className='font-semibold text-gray-900'>
                  {details.propertyType || (isCondo ? 'Condo / Co-op' : 'Single Family')}
                </span>
              </div>
            </div>
          </div>

          {/* Box 4: Community & Fixed Costs */}
          <div className='p-4 rounded-xl border border-gray-100 bg-white shadow-sm space-y-3'>
            <h3 className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
              Community & Fixed Costs
            </h3>
            <div className='space-y-2 text-sm'>
              <div className='flex justify-between'>
                <span className='text-gray-500'>Community:</span>
                <span className='font-medium text-gray-900'>
                  {details.community || (is55Plus ? '55+ Active Adult Community' : 'Standard Residential')}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-500'>HOA / Association Fee:</span>
                <span className='font-bold text-gray-900'>
                  {details.hoaFee ? `${formatMoney(details.hoaFee)} / month` : 'None / Not Reported'}
                </span>
              </div>
              {details.annualTaxes && (
                <div className='flex justify-between'>
                  <span className='text-gray-500'>Annual Property Taxes:</span>
                  <span className='font-semibold text-gray-900'>
                    {formatMoney(details.annualTaxes)} / yr
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </CardWrapper>
  );
}
