// app/components/dashboard/DashboardFilters.tsx

import React from 'react';
import { Loader } from '@aws-amplify/ui-react';

function getDatePreset(preset: string): { from: string; to: string } {
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (preset) {
    case 'today': return { from: fmt(today), to: fmt(today) };
    case 'yesterday': { const d = new Date(today); d.setDate(d.getDate() - 1); return { from: fmt(d), to: fmt(d) }; }
    case 'last7': { const d = new Date(today); d.setDate(d.getDate() - 6); return { from: fmt(d), to: fmt(today) }; }
    case 'last30': { const d = new Date(today); d.setDate(d.getDate() - 29); return { from: fmt(d), to: fmt(today) }; }
    case 'thisMonth': { const d = new Date(today.getFullYear(), today.getMonth(), 1); return { from: fmt(d), to: fmt(today) }; }
    case 'lastMonth': { const from = new Date(today.getFullYear(), today.getMonth() - 1, 1); const to = new Date(today.getFullYear(), today.getMonth(), 0); return { from: fmt(from), to: fmt(to) }; }
    default: return { from: '', to: '' };
  }
}

type Props = {
  filterType: string;
  setFilterType: (val: string) => void;
  filterStatus: string;
  setFilterStatus: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  filterGhlStatus: string;
  setFilterGhlStatus: (val: string) => void;
  filterHasPhone: string;
  setFilterHasPhone: (val: string) => void;
  filterListingStatus: string;
  setFilterListingStatus: (val: string) => void;
  // Foreclosure qualification filters
  filterForeclosureStage: string;
  setFilterForeclosureStage: (val: string) => void;
  filterAuctionWindow: string;
  setFilterAuctionWindow: (val: string) => void;
  filterMinEquity: string;
  setFilterMinEquity: (val: string) => void;
  filterDateAdded: string;
  setFilterDateAdded: (val: string) => void;
  filterDateAddedTo: string;
  setFilterDateAddedTo: (val: string) => void;
  filterSource: string;
  setFilterSource: (val: string) => void;
  filterDataQuality: string;
  setFilterDataQuality: (val: string) => void;
  filterOwnerType: string;
  setFilterOwnerType: (val: string) => void;
  filterTaxForeclosure: boolean;
  setFilterTaxForeclosure: (val: boolean) => void;
  skipTraceFromDate: string;
  setSkipTraceFromDate: (val: string) => void;
  skipTraceToDate: string;
  setSkipTraceToDate: (val: string) => void;

  // Access Control
  hasPaidPlan: boolean;

  // Bulk Action Props
  selectedLeadsCount: number;
  selectedLeadTypes: string[];
  selectedLeadType: 'PROBATE' | 'PREFORECLOSURE' | null;
  handleBulkSkipTrace: () => Promise<void>;
  handleBulkGHLSync: () => Promise<void>;
  handleBulkStatusUpdate: (status: string) => Promise<void>;
  handleBulkEnrichLeads: () => Promise<void>;
  handleBulkDirectMail: () => Promise<void>;
  handlePopulateQueue: () => Promise<void>;
  handleAddToDoorKnock: () => Promise<void>;
  handleSyncListingStatus: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleExport: () => void;
  handleDownloadSkipTraced: () => void;
  handleViewDetails: () => void;
  isSkipTracing: boolean;
  isGhlSyncing: boolean;
  isEnriching: boolean;
  isGeneratingLetters: boolean;
  isEmailCampaigning: boolean;
  isPopulatingQueue: boolean;
};

export function DashboardFilters({
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  searchQuery,
  setSearchQuery,
  filterGhlStatus,
  setFilterGhlStatus,
  filterHasPhone,
  setFilterHasPhone,
  filterListingStatus,
  setFilterListingStatus,
  filterForeclosureStage,
  setFilterForeclosureStage,
  filterAuctionWindow,
  setFilterAuctionWindow,
  filterMinEquity,
  setFilterMinEquity,
  filterDateAdded,
  setFilterDateAdded,
  filterDateAddedTo,
  setFilterDateAddedTo,
  filterSource,
  setFilterSource,
  filterDataQuality,
  setFilterDataQuality,
  filterOwnerType,
  setFilterOwnerType,
  filterTaxForeclosure,
  setFilterTaxForeclosure,
  skipTraceFromDate,
  setSkipTraceFromDate,
  skipTraceToDate,
  setSkipTraceToDate,
  selectedLeadsCount,
  selectedLeadTypes,
  selectedLeadType,
  handleBulkSkipTrace,
  handleBulkGHLSync,
  handleBulkStatusUpdate,
  handleBulkEnrichLeads,
  handleBulkDirectMail,
  handlePopulateQueue,
  handleAddToDoorKnock,
  handleSyncListingStatus,
  handleDelete,
  handleExport,
  handleDownloadSkipTraced,
  handleViewDetails,
  hasPaidPlan,
  isSkipTracing,
  isGhlSyncing,
  isEnriching,
  isGeneratingLetters,
  isEmailCampaigning,
  isPopulatingQueue,
}: Props) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const activeFilters = [
    filterType && { label: `Type: ${filterType}`, reset: () => setFilterType('') },
    filterStatus && { label: `Trace: ${filterStatus}`, reset: () => setFilterStatus('') },
    filterGhlStatus && { label: `Launch AI: ${filterGhlStatus}`, reset: () => setFilterGhlStatus('') },
    filterHasPhone && {
      label:
        filterHasPhone === 'HAS_MOBILE'
          ? '📱 Mobile Only'
          : filterHasPhone === 'LANDLINE_ONLY'
          ? '☎️ Landlines Only'
          : filterHasPhone === 'HAS_LANDLINE'
          ? '☎️ Has Landline'
          : filterHasPhone === 'NO_PHONE'
          ? '🚫 No Phone'
          : 'Phone Active',
      reset: () => setFilterHasPhone(''),
    },
    filterListingStatus && { label: `Listing: ${filterListingStatus}`, reset: () => setFilterListingStatus('') },
    filterForeclosureStage && { label: `Stage: ${filterForeclosureStage}`, reset: () => setFilterForeclosureStage('') },
    filterAuctionWindow && { label: `Auction: Next ${filterAuctionWindow}d`, reset: () => setFilterAuctionWindow('') },
    filterMinEquity && { label: `Equity ≥ ${filterMinEquity}%`, reset: () => setFilterMinEquity('') },
    filterDataQuality && { label: `Quality: ${filterDataQuality}`, reset: () => setFilterDataQuality('') },
    filterOwnerType !== 'INDIVIDUALS' && { label: `Owner: ${filterOwnerType}`, reset: () => setFilterOwnerType('INDIVIDUALS') },
    filterTaxForeclosure && { label: '🏛️ Tax Foreclosure', reset: () => setFilterTaxForeclosure(false) },
    filterSource && { label: `Source: ${filterSource}`, reset: () => setFilterSource('') },
    (filterDateAdded || filterDateAddedTo) && {
      label: `Added: ${filterDateAdded || 'Any'} - ${filterDateAddedTo || 'Any'}`,
      reset: () => { setFilterDateAdded(''); setFilterDateAddedTo(''); },
    },
    (skipTraceFromDate || skipTraceToDate) && {
      label: `Traced: ${skipTraceFromDate || 'Any'} - ${skipTraceToDate || 'Any'}`,
      reset: () => { setSkipTraceFromDate(''); setSkipTraceToDate(''); },
    },
  ].filter(Boolean) as Array<{ label: string; reset: () => void }>;

  const handleClearAll = () => {
    setFilterType('');
    setFilterStatus('');
    setFilterGhlStatus('');
    setFilterHasPhone('');
    setFilterListingStatus('');
    setFilterForeclosureStage('');
    setFilterAuctionWindow('');
    setFilterMinEquity('');
    setFilterDateAdded('');
    setFilterDateAddedTo('');
    setFilterSource('');
    setFilterDataQuality('');
    setFilterOwnerType('INDIVIDUALS');
    setFilterTaxForeclosure(false);
    setSkipTraceFromDate('');
    setSkipTraceToDate('');
  };

  return (
    <div className='bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 mb-4 sm:mb-6 space-y-4'>
      {/* 🔍 Row 1: Search Input & Toggle Controls */}
      <div className='flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between'>
        <div className='relative flex-1'>
          <input
            type='text'
            placeholder='Search by address, owner name, or county...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full border border-slate-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none pr-10 font-medium text-slate-800 placeholder-slate-400'
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className='absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold'
            >
              ✕
            </button>
          )}
        </div>

        <div className='flex items-center gap-2 justify-end'>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              showAdvanced || activeFilters.length > 0
                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z' />
            </svg>
            ⚙️ Advanced Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
          </button>

          {activeFilters.length > 0 && (
            <button
              onClick={handleClearAll}
              className='px-3 py-2 text-xs font-bold text-slate-500 hover:text-red-600 transition-colors'
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* 💊 Row 2: Top-Level Quick Filter Pills */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100'>
        {/* 1. Lead Type */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className='border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none w-full bg-white text-slate-700'
        >
          <option value=''>🏠 All Lead Types</option>
          <option value='PREFORECLOSURE'>Pre-Foreclosure</option>
          <option value='PROBATE'>Probate</option>
        </select>

        {/* 2. Phone Channel Filter */}
        <select
          value={filterHasPhone}
          onChange={(e) => setFilterHasPhone(e.target.value)}
          className='border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-green-500 outline-none w-full bg-white text-slate-700'
        >
          <option value=''>📱 All Phone Channels</option>
          <option value='HAS_PHONE'>Has Any Phone (Mobile or Landline)</option>
          <option value='HAS_MOBILE'>📱 Mobile Only (SMS-Capable)</option>
          <option value='LANDLINE_ONLY'>☎️ Landlines Only (Power Dialer)</option>
          <option value='HAS_LANDLINE'>☎️ Has Landline(s)</option>
          <option value='NO_PHONE'>🚫 No Phone Numbers</option>
        </select>

        {/* 3. Skip Trace Status */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className='border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none w-full bg-white text-slate-700'
        >
          <option value=''>🔍 All Trace Statuses</option>
          <option value='PENDING'>Pending Trace</option>
          <option value='COMPLETED'>Completed Trace</option>
          <option value='NO_QUALITY_CONTACTS'>No Quality Contacts</option>
          <option value='FAILED'>Failed / Error</option>
          <option value='NO_MATCH'>No Match</option>
        </select>

        {/* 4. Launch AI Status */}
        <select
          value={filterGhlStatus}
          onChange={(e) => setFilterGhlStatus(e.target.value)}
          className='border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none w-full bg-white text-slate-700'
        >
          <option value=''>🤖 All Launch AI States</option>
          <option value='SUCCESS'>Launch AI Synced</option>
          <option value='PENDING'>Launch AI Pending</option>
          <option value='FAILED'>Launch AI Failed</option>
          <option value='NULL'>Needs Launch AI Sync</option>
        </select>
      </div>

      {/* 🏷️ Active Filter Badges */}
      {activeFilters.length > 0 && (
        <div className='flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100'>
          <span className='text-xs font-bold text-slate-400 uppercase tracking-wider'>Active Filters:</span>
          {activeFilters.map((af, idx) => (
            <span
              key={idx}
              className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200'
            >
              {af.label}
              <button
                onClick={af.reset}
                className='hover:text-blue-900 font-extrabold text-xs ml-0.5'
                title='Remove filter'
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ⚙️ Expandable Advanced Filters Drawer */}
      {showAdvanced && (
        <div className='bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 text-xs font-medium text-slate-700 mt-3'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            {/* Section A: Motivated Lead Targeter */}
            <div className='space-y-2.5'>
              <h4 className='font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wider'>
                🎯 Foreclosure & Motivated Targeter
              </h4>
              <div>
                <label className='text-[11px] text-slate-500 mb-1 block'>Foreclosure Stage:</label>
                <select
                  value={filterForeclosureStage}
                  onChange={(e) => setFilterForeclosureStage(e.target.value)}
                  className='border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs w-full bg-white outline-none'
                >
                  <option value=''>All Stages</option>
                  <option value='ACTIVE'>Active (NOD · Lis Pendens · Auction)</option>
                  <option value='AUCTION'>Facing Auction only</option>
                  <option value='DEAD'>Dead (Rescinded · Released)</option>
                </select>
              </div>

              <div>
                <label className='text-[11px] text-slate-500 mb-1 block'>Auction Window:</label>
                <select
                  value={filterAuctionWindow}
                  onChange={(e) => setFilterAuctionWindow(e.target.value)}
                  className='border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs w-full bg-white outline-none'
                >
                  <option value=''>Any Date</option>
                  <option value='30'>Next 30 days</option>
                  <option value='60'>Next 60 days</option>
                  <option value='90'>Next 90 days</option>
                </select>
              </div>

              <div>
                <label className='text-[11px] text-slate-500 mb-1 block'>Min Equity %:</label>
                <input
                  type='number'
                  min={0}
                  max={100}
                  value={filterMinEquity}
                  onChange={(e) => setFilterMinEquity(e.target.value)}
                  placeholder='e.g. 30'
                  className='border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs w-full bg-white outline-none'
                />
              </div>

              <label className='flex items-center gap-2 pt-1 font-semibold cursor-pointer'>
                <input
                  type='checkbox'
                  checked={filterTaxForeclosure}
                  onChange={(e) => setFilterTaxForeclosure(e.target.checked)}
                  className='rounded border-slate-300 text-blue-600 focus:ring-blue-500'
                />
                🏛️ Tax Foreclosures Only
              </label>
            </div>

            {/* Section B: Data Quality & Status */}
            <div className='space-y-2.5'>
              <h4 className='font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wider'>
                🛡️ Data Quality & Listing Status
              </h4>
              <div>
                <label className='text-[11px] text-slate-500 mb-1 block'>Listing Status:</label>
                <select
                  value={filterListingStatus}
                  onChange={(e) => setFilterListingStatus(e.target.value)}
                  className='border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs w-full bg-white outline-none'
                >
                  <option value=''>All Statuses</option>
                  <option value='NULL'>No Status</option>
                  <option value='off_market'>Off Market</option>
                  <option value='active'>Active MLS</option>
                  <option value='sold'>Sold</option>
                  <option value='pending'>Pending</option>
                  <option value='fsbo'>FSBO</option>
                  <option value='auction'>Auction</option>
                  <option value='door_knock'>Door Knock</option>
                </select>
              </div>

              <div>
                <label className='text-[11px] text-slate-500 mb-1 block'>Data Quality Check:</label>
                <select
                  value={filterDataQuality}
                  onChange={(e) => setFilterDataQuality(e.target.value)}
                  className='border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs w-full bg-white outline-none'
                >
                  <option value=''>All Records</option>
                  <option value='INVALID'>⚠️ Unconfirmed / Invalid Address</option>
                  <option value='NO_ZESTIMATE'>🏠 Missing Zestimate</option>
                </select>
              </div>

              <div>
                <label className='text-[11px] text-slate-500 mb-1 block'>Owner Type:</label>
                <select
                  value={filterOwnerType}
                  onChange={(e) => setFilterOwnerType(e.target.value)}
                  className='border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs w-full bg-white outline-none'
                >
                  <option value='INDIVIDUALS'>👤 Individuals Only (Default)</option>
                  <option value='INCLUDE_ENTITIES'>Include Entities (LLC/Trust)</option>
                  <option value='ENTITIES_ONLY'>🏢 Entities Only</option>
                </select>
              </div>
            </div>

            {/* Section C: Dates & Upload Source */}
            <div className='space-y-2.5'>
              <h4 className='font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wider'>
                📅 Date Added & Source
              </h4>
              <div>
                <label className='text-[11px] text-slate-500 mb-1 block'>Date Added Preset:</label>
                <select
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const { from, to } = getDatePreset(e.target.value);
                    setFilterDateAdded(from);
                    setFilterDateAddedTo(to);
                    e.target.value = '';
                  }}
                  className='border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs w-full bg-white outline-none'
                >
                  <option value=''>Quick Date Preset...</option>
                  <option value='today'>Today</option>
                  <option value='yesterday'>Yesterday</option>
                  <option value='last7'>Last 7 Days</option>
                  <option value='last30'>Last 30 Days</option>
                  <option value='thisMonth'>This Month</option>
                  <option value='lastMonth'>Last Month</option>
                </select>
              </div>

              <div className='grid grid-cols-2 gap-2'>
                <div>
                  <label className='text-[11px] text-slate-500 mb-1 block'>From:</label>
                  <input
                    type='date'
                    value={filterDateAdded}
                    onChange={(e) => setFilterDateAdded(e.target.value)}
                    className='border border-slate-300 rounded-lg px-2 py-1 text-xs w-full bg-white outline-none'
                  />
                </div>
                <div>
                  <label className='text-[11px] text-slate-500 mb-1 block'>To:</label>
                  <input
                    type='date'
                    value={filterDateAddedTo}
                    onChange={(e) => setFilterDateAddedTo(e.target.value)}
                    className='border border-slate-300 rounded-lg px-2 py-1 text-xs w-full bg-white outline-none'
                  />
                </div>
              </div>

              <div>
                <label className='text-[11px] text-slate-500 mb-1 block'>Upload Source:</label>
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                  className='border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs w-full bg-white outline-none'
                >
                  <option value=''>All Sources</option>
                  <option value='csv_upload'>📄 CSV Upload</option>
                  <option value='manual_entry'>✍️ Manual Entry</option>
                  <option value='api_import'>🔗 API Import</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📥 Download Button - Always Visible When Leads Selected */}
      {selectedLeadsCount > 0 && (
        <div className='flex justify-end'>
          <button
            onClick={handleDownloadSkipTraced}
            className='text-xs px-3 py-1.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm whitespace-nowrap'
          >
            📥 Download Selected ({selectedLeadsCount})
          </button>
        </div>
      )}

      {/* ⚡ BULK ACTIONS MENU */}
      {selectedLeadsCount > 0 && (
        <div className='flex flex-col sm:flex-row gap-3 sm:gap-2 pt-3 border-t border-slate-200'>
          <span className='text-xs font-bold text-slate-700 sm:self-center'>
            {selectedLeadsCount} Selected
            {selectedLeadsCount > 0 && (
              <span className='text-xs text-slate-500 ml-2 font-normal'>
                (Cost: ${(selectedLeadsCount * 0.10).toFixed(2)})
              </span>
            )}
          </span>

          <div className='flex flex-wrap gap-2'>
            {/* Bulk Status Update Dropdown */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStatusUpdate(e.target.value);
                  e.target.value = '';
                }
              }}
              disabled={isSkipTracing || isGhlSyncing}
              className='text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm w-full sm:w-auto cursor-pointer outline-none'
            >
              <option value=''>Set Status...</option>
              <option value='off_market'>Off Market</option>
              <option value='active'>Active</option>
              <option value='sold'>Sold</option>
              <option value='pending'>Pending</option>
              <option value='fsbo'>FSBO</option>
              <option value='auction'>Auction</option>
              <option value='skip'>Skip</option>
              <option value='door_knock'>Door Knock</option>
            </select>

            {/* Skip Trace Button - Only for PROBATE */}
            {(!selectedLeadType || selectedLeadType === 'PROBATE') && (
              <button
                onClick={handleBulkSkipTrace}
                disabled={isSkipTracing || isGhlSyncing || selectedLeadsCount === 0}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm w-full sm:w-auto
                  ${isSkipTracing ? 'bg-indigo-300 text-white cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                title={selectedLeadsCount > 0 ? `Cost: $${(selectedLeadsCount * 0.10).toFixed(2)}` : ''}
              >
                {isSkipTracing ? (
                  <>
                    <Loader size='small' variation='linear' /> Tracing...
                  </>
                ) : (
                  'Skip Trace'
                )}
              </button>
            )}

            {/* View Details Button (only when 1 lead selected) */}
            {selectedLeadsCount === 1 && (
              <button
                onClick={handleViewDetails}
                className='text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-600 text-white hover:bg-slate-700 transition shadow-sm w-full sm:w-auto'
              >
                👁️ View Details
              </button>
            )}

            {/* GHL Sync Button */}
            <button
              onClick={handleBulkGHLSync}
              disabled={isGhlSyncing || isSkipTracing}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm w-full sm:w-auto
                ${isGhlSyncing
                  ? 'bg-purple-300 text-white cursor-not-allowed'
                  : !hasPaidPlan
                  ? 'bg-slate-200 text-slate-500 cursor-pointer'
                  : 'bg-purple-600 text-white hover:bg-purple-700'}`}
            >
              {isGhlSyncing ? (
                <>
                  <Loader size='small' variation='linear' /> Syncing...
                </>
              ) : !hasPaidPlan ? (
                '🔒 Sync Launch AI (PRO+)'
              ) : (
                'Sync Launch AI'
              )}
            </button>

            {/* Enrich Leads Button - Only for PREFORECLOSURE */}
            {(!selectedLeadType || selectedLeadType === 'PREFORECLOSURE') && (
              <button
                onClick={handleBulkEnrichLeads}
                disabled={isEnriching || isSkipTracing || isGhlSyncing || selectedLeadsCount === 0}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm w-full sm:w-auto
                  ${isEnriching ? 'bg-orange-300 text-white cursor-not-allowed' : 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700'}`}
                title={selectedLeadsCount > 0 ? `Cost: $${(selectedLeadsCount * 0.35).toFixed(2)} (Preforeclosure only)` : ''}
              >
                {isEnriching ? (
                  <>
                    <Loader size='small' variation='linear' /> Enriching...
                  </>
                ) : (
                  <>🏦 Enrich Leads</>
                )}
              </button>
            )}

            {/* Add to Door Knock Button */}
            <button
              onClick={handleAddToDoorKnock}
              disabled={isPopulatingQueue || isSkipTracing || isGhlSyncing}
              className='text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition shadow-sm w-full sm:w-auto'
            >
              🚪 Add to Door Knock
            </button>

            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={isGhlSyncing || isSkipTracing}
              className='text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 transition shadow-sm w-full sm:w-auto'
            >
              Export
            </button>

            {/* Delete Button */}
            <button
              onClick={handleDelete}
              disabled={isGhlSyncing || isSkipTracing}
              className='text-xs font-bold px-3 py-1.5 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition shadow-sm w-full sm:w-auto'
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
