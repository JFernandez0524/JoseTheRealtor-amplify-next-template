'use client';

import React, { useState } from 'react';
import { CardWrapper } from '../leadDetails/CardWrapper';
import { LeadStatusBadge } from '@/app/components/leadDetails/LeadStatusBadge';
import { Loader } from '@aws-amplify/ui-react';
import AuthModal from './AuthModal';

interface PropertyReportViewProps {
  marketData: any;
  lead?: any;
  isPremium?: boolean;
  onSkipTrace?: () => void;
  isSkipTracing?: boolean;
  ghlActionsComponent?: React.ReactNode;
}

const formatCurrency = (v?: any) =>
  v
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(Number(v))
    : '---';

export default function PropertyReportView({
  marketData,
  lead,
  isPremium = false,
  onSkipTrace,
  isSkipTracing = false,
  ghlActionsComponent,
}: PropertyReportViewProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const parcel = marketData?.parcel;
  const valuation = marketData?.valuation;
  const building = parcel?.building?.[0] || {};
  const legal = parcel?.legal || {};

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // 🎯 Intercept premium actions to redirect to pricing page for unauthenticated users
  const handlePremiumAction = (action?: () => void) => {
    if (!isPremium) {
      // Redirect to pricing page for signup
      window.location.href = '/pricing';
    } else if (action) {
      action();
    }
  };

  return (
    <>
      {/* 🚀 SALES-FOCUSED CONVERSION MODAL */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <div className='grid grid-cols-12 gap-8 w-full mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700'>
        {/* 🏠 MAIN CONTENT */}
        <div className='col-span-12 lg:col-span-9 space-y-8'>
          {/* HERO */}
          <section className='bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden'>
            <div className='p-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6'>
              <div>
                <div className='flex items-center gap-3 mb-3'>
                  <span className='bg-indigo-600 text-white text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-widest'>
                    {lead?.type || 'PROSPECT'}
                  </span>
                </div>
                <h2 className='text-4xl font-black text-slate-900 tracking-tight'>
                  {valuation?.address || 'Property Intelligence'}
                </h2>
                <p className='text-xl text-slate-400 font-medium'>
                  {valuation?.city}, {valuation?.state} {valuation?.postalCode}
                </p>
              </div>
              <div className='bg-slate-50 p-6 rounded-2xl border border-slate-100 text-right min-w-[240px]'>
                <p className='text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1'>
                  Zestimate®
                </p>
                <p className='text-4xl font-black text-indigo-600 tracking-tighter'>
                  {formatCurrency(valuation?.zestimate)}
                </p>
              </div>
            </div>
          </section>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
            <CardWrapper title='Market Intel & Taxes'>
              <div className='space-y-6'>
                <MarketRow
                  label='Total Assessed'
                  value={formatCurrency(parcel?.totalValue)}
                />
                <MarketRow
                  label='Tax Amount'
                  value={formatCurrency(parcel?.taxAmount)}
                  subtitle={`Year: ${parcel?.taxYear || '---'}`}
                />
                <div className='mt-8 p-6 bg-indigo-900 rounded-2xl text-white shadow-xl'>
                  <p className='text-[10px] font-black text-indigo-300 uppercase mb-2 tracking-widest'>
                    Confidence
                  </p>
                  <p className='text-3xl font-black'>
                    {valuation?.highPercent
                      ? 100 - valuation.highPercent
                      : '---'}
                    %
                  </p>
                  <p className='text-[10px] text-indigo-400 mt-2 italic leading-relaxed uppercase'>
                    Range: {formatCurrency(valuation?.minus30)} —{' '}
                    {formatCurrency(valuation?.zestimate * 1.1)}
                  </p>
                </div>
              </div>
            </CardWrapper>

            <CardWrapper title='Structure Details'>
              <div className='grid grid-cols-2 gap-y-8 gap-x-4'>
                <InfoRow label='Year Built' value={building?.yearBuilt} />
                <InfoRow
                  label='Beds / Baths'
                  value={`${building?.bedrooms || '-'} / ${building?.baths || '-'}`}
                />
                <InfoRow label='Stories' value={building?.totalStories} />
                <InfoRow label='Construction' value={building?.foundation} />
              </div>
            </CardWrapper>
          </div>

          <CardWrapper title='Technical Property Analysis'>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-y-12 gap-x-8'>
              <InfoRow label='APN' value={parcel?.apn} />
              <InfoRow
                label='Living Area'
                value={
                  parcel?.buildingSizeSquareFeet
                    ? `${parcel.buildingSizeSquareFeet.toLocaleString()} SqFt`
                    : null
                }
              />
              <InfoRow
                label='Lot Size Sqft'
                value={
                  parcel?.lotSizeSquareFeet
                    ? `${parcel.lotSizeSquareFeet.toLocaleString()} SqFt`
                    : null
                }
              />
              <InfoRow
                label='Lot Size (Acres)'
                value={
                  parcel?.lotSizeAcres ? `${parcel.lotSizeAcres} Acres` : null
                }
              />
              <InfoRow label='Zoning' value={parcel?.zoningDescription} />
              <InfoRow label='County' value={parcel?.county} />
              <InfoRow label='Township' value={legal?.township} />
              <InfoRow
                label='Block / Lot'
                value={`${legal?.block || '-'} / ${legal?.lot || '-'}`}
              />
            </div>
          </CardWrapper>
        </div>

        {/* ⚡ ACTION SIDEBAR */}
        <div className='col-span-12 lg:col-span-3 space-y-6'>
          <div className='sticky top-8 space-y-6'>
            <div className='bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl border border-slate-800 relative overflow-hidden'>
              <h3 className='text-white text-[10px] font-black uppercase mb-10 tracking-widest'>
                Lead Progression
              </h3>
              <div className='space-y-5'>
                <button
                  onClick={() => handlePremiumAction(onSkipTrace)}
                  disabled={lead?.skipTraceStatus === 'COMPLETED'}
                  className='w-full bg-white text-slate-900 font-black text-[10px] uppercase tracking-widest py-5 rounded-2xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2 shadow-lg'
                >
                  {isSkipTracing ? (
                    <Loader size='small' />
                  ) : lead?.skipTraceStatus === 'COMPLETED' ? (
                    '✓ Traced'
                  ) : (
                    <>
                      {/* Curiositiy lock icon for non-members */}
                      {!isPremium && <span>🔒</span>} Run Skip Trace
                    </>
                  )}
                </button>

                {/* Intercept CRM Sync click for unauthenticated users */}
                <div onClick={() => !isPremium && setIsAuthModalOpen(true)}>
                  <div
                    className={
                      !isPremium ? 'pointer-events-none opacity-50' : ''
                    }
                  >
                    {ghlActionsComponent}
                  </div>
                </div>
              </div>

              {!isPremium && (
                <p className='text-[9px] text-slate-500 text-center italic mt-4 uppercase tracking-tighter font-bold'>
                  Member login required for phones & outreach automation
                </p>
              )}
            </div>

            {lead && (
              <CardWrapper title='Pipeline Status'>
                <div className='space-y-4 pt-2'>
                  <div className='flex justify-between items-center'>
                    <span className='text-[10px] font-bold text-slate-400 uppercase'>
                      Discovery
                    </span>
                    <LeadStatusBadge
                      type='SKIP_TRACE'
                      status={lead.skipTraceStatus}
                    />
                  </div>
                  <div className='flex justify-between items-center'>
                    <span className='text-[10px] font-bold text-slate-400 uppercase'>
                      CRM Sync
                    </span>
                    <LeadStatusBadge
                      type='GHL_SYNC'
                      status={lead.ghlSyncStatus}
                    />
                  </div>
                </div>
              </CardWrapper>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// HELPERS (No changes needed)
function InfoRow({ label, value }: { label: string; value: any }) {
  const displayValue =
    value === null || value === undefined || value === '' ? '---' : value;
  return (
    <div>
      <p className='text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest'>
        {label}
      </p>
      <p className='text-sm font-bold text-slate-700 leading-tight'>
        {displayValue}
      </p>
    </div>
  );
}

function MarketRow({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: any;
  subtitle?: string;
}) {
  return (
    <div className='flex justify-between items-start py-2.5 border-b border-slate-50'>
      <div>
        <p className='text-xs font-bold text-slate-600 tracking-tight'>
          {label}
        </p>
        {subtitle && (
          <p className='text-[9px] text-slate-400 uppercase mt-0.5'>
            {subtitle}
          </p>
        )}
      </div>
      <p className='text-sm font-black text-slate-900 tracking-tighter'>
        {value || '---'}
      </p>
    </div>
  );
}
