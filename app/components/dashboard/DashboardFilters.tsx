// app/components/dashboard/DashboardFilters.tsx

import React, { Dispatch, SetStateAction } from 'react';
import { Loader } from '@aws-amplify/ui-react'; // Ensure Loader is imported

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
  filterManualStatus: string;
  setFilterManualStatus: (val: string) => void;
  filterAiPriority: string;
  setFilterAiPriority: (val: string) => void;
  skipTraceFromDate: string;
  setSkipTraceFromDate: (val: string) => void;
  skipTraceToDate: string;
  setSkipTraceToDate: (val: string) => void;

  // Bulk Action Props
  selectedLeadsCount: number;
  selectedLeadTypes: string[]; // NEW: Array of types of selected leads
  handleBulkSkipTrace: () => Promise<void>;
  handleBulkGHLSync: () => Promise<void>;
  handleBulkStatusUpdate: (status: string) => Promise<void>;
  handleBulkAIScore: () => Promise<void>;
  handleBulkEnrichLeads: () => Promise<void>;
  handleBulkDirectMail: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleExport: () => void;
  handleDownloadSkipTraced: () => void;
  isSkipTracing: boolean;
  isGhlSyncing: boolean;
  isAiScoring: boolean;
  isEnriching: boolean;
  isGeneratingLetters: boolean;
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
  filterManualStatus,
  setFilterManualStatus,
  filterAiPriority,
  setFilterAiPriority,
  skipTraceFromDate,
  setSkipTraceFromDate,
  skipTraceToDate,
  setSkipTraceToDate,
  selectedLeadsCount,
  selectedLeadTypes,
  handleBulkSkipTrace,
  handleBulkGHLSync,
  handleBulkStatusUpdate,
  handleBulkAIScore,
  handleBulkEnrichLeads,
  handleBulkDirectMail,
  handleDelete,
  handleExport,
  handleDownloadSkipTraced,
  isSkipTracing,
  isGhlSyncing,
  isAiScoring,
  isEnriching,
  isGeneratingLetters,
}: Props) {
  // Determine if selected leads are all same type
  const hasPreforeclosure = selectedLeadTypes.includes('PREFORECLOSURE');
  const hasProbate = selectedLeadTypes.includes('PROBATE');
  const isMixedTypes = hasPreforeclosure && hasProbate;
  
  return (
    <div className='bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 mb-4 sm:mb-6 space-y-4'>
      {/* Filters Section */}
      <div className='flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 items-start sm:items-center'>
        <span className='text-sm font-semibold text-gray-600 whitespace-nowrap'>Filter By:</span>

        {/* Filter Controls - Stack on mobile, inline on larger screens */}
        <div className='flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto'>
          {/* 1. Lead Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto'
          >
            <option value=''>All Lead Types</option>
            <option value='PREFORECLOSURE'>Pre-Foreclosure</option>
            <option value='PROBATE'>Probate</option>
          </select>

          {/* 2. Skip Trace Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto'
          >
            <option value=''>All Trace Statuses</option>
            <option value='PENDING'>Pending Trace</option>
            <option value='COMPLETED'>Completed Trace</option>
            <option value='FAILED'>Failed/Error</option>
            <option value='NO_MATCH'>No Match</option>
          </select>

          {/* 3. GHL SYNC STATUS FILTER */}
          <select
            value={filterGhlStatus}
            onChange={(e) => setFilterGhlStatus(e.target.value)}
            className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none w-full sm:w-auto'
          >
            <option value=''>All GHL Statuses</option>
            <option value='SUCCESS'>GHL Synced</option>
            <option value='PENDING'>GHL Pending</option>
            <option value='FAILED'>GHL Failed</option>
            <option value='SKIPPED'>GHL Skipped</option>
            <option value='NULL'>Needs GHL Sync</option>
          </select>

          {/* 4. PHONE STATUS FILTER */}
          <select
            value={filterHasPhone}
            onChange={(e) => setFilterHasPhone(e.target.value)}
            className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 outline-none w-full sm:w-auto'
          >
            <option value=''>All Phone Statuses</option>
            <option value='HAS_PHONE'>Has Phone Numbers</option>
            <option value='NO_PHONE'>No Phone Numbers</option>
          </select>

          {/* 5. MANUAL STATUS FILTER */}
          <select
            value={filterManualStatus}
            onChange={(e) => setFilterManualStatus(e.target.value)}
            className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-yellow-500 outline-none w-full sm:w-auto'
          >
            <option value=''>All Statuses</option>
            <option value='ACTIVE'>Active Only</option>
            <option value='SOLD'>Sold</option>
            <option value='PENDING'>Pending</option>
            <option value='OFF_MARKET'>Off Market</option>
            <option value='SKIP'>Skip</option>
            <option value='DIRECT_MAIL'>Direct Mail</option>
          </select>

          {/* 6. AI PRIORITY FILTER */}
          <select
            value={filterAiPriority}
            onChange={(e) => setFilterAiPriority(e.target.value)}
            className='border border-purple-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none w-full sm:w-auto bg-purple-50'
          >
            <option value=''>All AI Priorities</option>
            <option value='HIGH'>🔥 High Priority</option>
            <option value='MEDIUM'>⚡ Medium Priority</option>
            <option value='LOW'>📊 Low Priority</option>
          </select>

          {/* 7. SKIP TRACE DATE FILTERS */}
          <div className='flex flex-col sm:flex-row gap-2 items-center'>
            <label className='text-xs text-gray-600 whitespace-nowrap'>Skip Traced:</label>
            <input
              type='date'
              value={skipTraceFromDate}
              onChange={(e) => setSkipTraceFromDate(e.target.value)}
              className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto'
              placeholder='From Date'
            />
            <span className='text-gray-400 text-xs'>to</span>
            <input
              type='date'
              value={skipTraceToDate}
              onChange={(e) => setSkipTraceToDate(e.target.value)}
              className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto'
              placeholder='To Date'
            />
          </div>
        </div>

        {/* Clear All Button */}
        {(filterType || filterStatus || searchQuery || filterGhlStatus || filterHasPhone || filterManualStatus || skipTraceFromDate || skipTraceToDate) && (
          <button
            onClick={() => {
              setFilterType('');
              setFilterStatus('');
              setFilterGhlStatus('');
              setFilterHasPhone('');
              setFilterManualStatus('');
              setSkipTraceFromDate('');
              setSkipTraceToDate('');
              setSearchQuery('');
            }}
            className='text-sm text-blue-600 hover:underline whitespace-nowrap'
          >
            Clear All
          </button>
        )}

        {/* Download Selected Leads Button - Only show when leads are selected */}
        {selectedLeadsCount > 0 && (
          <button
            onClick={handleDownloadSkipTraced}
            className='text-sm px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 transition shadow-sm whitespace-nowrap'
          >
            📥 Download Selected ({selectedLeadsCount})
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className='relative w-full sm:max-w-md'>
        <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
          <svg
            className='h-5 w-5 text-gray-400'
            fill='currentColor'
            viewBox='0 0 20 20'
          >
            <path
              fillRule='evenodd'
              d='M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z'
              clipRule='evenodd'
            />
          </svg>
        </div>
        <input
          type='text'
          placeholder='Search Address...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className='pl-10 block w-full border border-gray-300 rounded-md py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none'
        />
      </div>

      {/* BULK ACTIONS MENU */}
      {selectedLeadsCount > 0 && (
        <div className='flex flex-col sm:flex-row gap-3 sm:gap-2 pt-3 sm:pt-0 border-t sm:border-t-0'>
          <span className='text-sm font-semibold text-gray-700 sm:self-center'>
            {selectedLeadsCount} Selected
            {selectedLeadsCount > 0 && (
              <span className='text-xs text-gray-500 ml-2'>
                (Cost: ${(selectedLeadsCount * 0.10).toFixed(2)})
              </span>
            )}
          </span>

          <div className='flex flex-col sm:flex-row gap-2'>
            {/* Bulk Status Update Dropdown */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStatusUpdate(e.target.value);
                  e.target.value = ''; // Reset dropdown
                }
              }}
              disabled={isSkipTracing || isGhlSyncing}
              className='text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm w-full sm:w-auto cursor-pointer'
            >
              <option value="">Set Status...</option>
              <option value="ACTIVE">Active</option>
              <option value="SOLD">Sold</option>
              <option value="PENDING">Pending</option>
              <option value="OFF_MARKET">Off Market</option>
              <option value="SKIP">Skip</option>
              <option value="DIRECT_MAIL">Direct Mail</option>
            </select>

            {/* Skip Trace Button */}
            <button
              onClick={handleBulkSkipTrace}
              disabled={isSkipTracing || isGhlSyncing}
              className={`text-sm px-3 py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 shadow-sm w-full sm:w-auto
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

            {/* GHL Sync Button */}
            <button
              onClick={handleBulkGHLSync}
              disabled={isGhlSyncing || isSkipTracing}
              className={`text-sm px-3 py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 shadow-sm w-full sm:w-auto
                                ${isGhlSyncing ? 'bg-purple-300 text-white cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
            >
              {isGhlSyncing ? (
                <>
                  <Loader size='small' variation='linear' /> Syncing...
                </>
              ) : (
                'Sync GHL'
              )}
            </button>

            {/* AI Score Button */}
            <button
              onClick={handleBulkAIScore}
              disabled={isAiScoring || isSkipTracing || isGhlSyncing}
              className={`text-sm px-3 py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 shadow-sm w-full sm:w-auto
                                ${isAiScoring ? 'bg-purple-300 text-white cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'}`}
            >
              {isAiScoring ? (
                <>
                  <Loader size='small' variation='linear' /> Scoring...
                </>
              ) : (
                <>🤖 Calculate AI Scores</>
              )}
            </button>

            {/* Enrich Leads Button (Preforeclosure only) */}
            {hasPreforeclosure && !isMixedTypes && (
              <button
                onClick={handleBulkEnrichLeads}
                disabled={isEnriching || isSkipTracing || isGhlSyncing || isAiScoring}
                className={`text-sm px-3 py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 shadow-sm w-full sm:w-auto
                                  ${isEnriching ? 'bg-orange-300 text-white cursor-not-allowed' : 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700'}`}
                title={selectedLeadsCount > 0 ? `Cost: $${(selectedLeadsCount * 0.29).toFixed(2)} (Preforeclosure only)` : ''}
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

            {/* Direct Mail Button */}
            <button
              onClick={handleBulkDirectMail}
              disabled={isGeneratingLetters || isSkipTracing || isGhlSyncing || isAiScoring}
              className={`text-sm px-3 py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 shadow-sm w-full sm:w-auto
                                ${isGeneratingLetters ? 'bg-green-300 text-white cursor-not-allowed' : 'bg-gradient-to-r from-green-600 to-teal-600 text-white hover:from-green-700 hover:to-teal-700'}`}
            >
              {isGeneratingLetters ? (
                <>
                  <Loader size='small' variation='linear' /> Generating...
                </>
              ) : (
                <>📬 Generate Letters</>
              )}
            </button>

            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={isGhlSyncing || isSkipTracing}
              className='text-sm px-3 py-1.5 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition shadow-sm w-full sm:w-auto'
            >
              Export
            </button>

            {/* Delete Button */}
            <button
              onClick={handleDelete}
              disabled={isGhlSyncing || isSkipTracing}
              className='text-sm px-3 py-1.5 rounded bg-red-100 text-red-600 hover:bg-red-200 transition shadow-sm w-full sm:w-auto'
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
