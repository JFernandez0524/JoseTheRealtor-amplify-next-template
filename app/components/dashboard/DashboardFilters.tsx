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
  filterDateAdded: string;
  setFilterDateAdded: (val: string) => void;
  skipTraceFromDate: string;
  setSkipTraceFromDate: (val: string) => void;
  skipTraceToDate: string;
  setSkipTraceToDate: (val: string) => void;

  // Access Control
  hasAI?: boolean;

  // Bulk Action Props
  selectedLeadsCount: number;
  selectedLeadTypes: string[]; // NEW: Array of types of selected leads
  handleBulkSkipTrace: () => Promise<void>;
  handleBulkGHLSync: () => Promise<void>;
  handleBulkStatusUpdate: (status: string) => Promise<void>;
  handleBulkAIScore: () => Promise<void>;
  handleBulkEnrichLeads: () => Promise<void>;
  handleBulkDirectMail: () => Promise<void>;
  handleBulkEmailCampaign: () => Promise<void>;
  handlePopulateQueue: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleExport: () => void;
  handleDownloadSkipTraced: () => void;
  handleViewDetails: () => void;
  isSkipTracing: boolean;
  isGhlSyncing: boolean;
  isAiScoring: boolean;
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
  filterManualStatus,
  setFilterManualStatus,
  filterAiPriority,
  setFilterAiPriority,
  filterDateAdded,
  setFilterDateAdded,
  skipTraceFromDate,
  setSkipTraceFromDate,
  skipTraceToDate,
  setSkipTraceToDate,
  hasAI = false,
  selectedLeadsCount,
  selectedLeadTypes,
  handleBulkSkipTrace,
  handleBulkGHLSync,
  handleBulkStatusUpdate,
  handleBulkAIScore,
  handleBulkEnrichLeads,
  handleBulkDirectMail,
  handleBulkEmailCampaign,
  handlePopulateQueue,
  handleDelete,
  handleExport,
  handleDownloadSkipTraced,
  handleViewDetails,
  isSkipTracing,
  isGhlSyncing,
  isAiScoring,
  isEnriching,
  isGeneratingLetters,
  isEmailCampaigning,
  isPopulatingQueue,
}: Props) {
  // Determine if selected leads are all same type
  const hasPreforeclosure = selectedLeadTypes.includes('PREFORECLOSURE');
  const hasProbate = selectedLeadTypes.includes('PROBATE');
  const isMixedTypes = hasPreforeclosure && hasProbate;
  const [showFilters, setShowFilters] = React.useState(false);
  
  return (
    <div className='bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 mb-4 sm:mb-6 space-y-4'>
      {/* Always Visible: Search Bar and Filter Toggle */}
      <div className='flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between'>
        {/* Address Search - Always Visible */}
        <input
          type='text'
          placeholder='Search by address, name, or county...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className='flex-1 border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none'
        />
        
        {/* Filter Toggle Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2 justify-center whitespace-nowrap'
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z' />
          </svg>
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {/* Collapsible Filters Section */}
      {showFilters && (
        <div className='flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 items-start sm:items-center pt-4 border-t border-gray-200'>
          <span className='text-sm font-semibold text-gray-600 whitespace-nowrap'>Filter By:</span>

          {/* Filter Controls */}
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 w-full'>
          {/* 1. Lead Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full'
          >
            <option value=''>All Lead Types</option>
            <option value='PREFORECLOSURE'>Pre-Foreclosure</option>
            <option value='PROBATE'>Probate</option>
          </select>

          {/* 2. Skip Trace Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full'
          >
            <option value=''>All Trace Statuses</option>
            <option value='PENDING'>Pending Trace</option>
            <option value='COMPLETED'>Completed Trace</option>
            <option value='NO_QUALITY_CONTACTS'>No Quality Contacts</option>
            <option value='FAILED'>Failed/Error</option>
            <option value='NO_MATCH'>No Match</option>
          </select>

          {/* 3. GHL SYNC STATUS FILTER */}
          <select
            value={filterGhlStatus}
            onChange={(e) => setFilterGhlStatus(e.target.value)}
            className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none w-full'
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
            className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 outline-none w-full'
          >
            <option value=''>All Phone Statuses</option>
            <option value='HAS_PHONE'>Has Phone Numbers</option>
            <option value='NO_PHONE'>No Phone Numbers</option>
          </select>

          {/* 5. MANUAL STATUS FILTER */}
          <select
            value={filterManualStatus}
            onChange={(e) => setFilterManualStatus(e.target.value)}
            className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-yellow-500 outline-none w-full'
          >
            <option value=''>All Statuses</option>
            <option value='NULL'>No Status</option>
            <option value='ACTIVE'>Active Only</option>
            <option value='SOLD'>Sold</option>
            <option value='PENDING'>Pending</option>
            <option value='OFF_MARKET'>Off Market</option>
            <option value='SKIP'>Skip</option>
            <option value='DIRECT_MAIL'>Direct Mail</option>
            <option value='FSBO'>FSBO</option>
            <option value='DOOR_KNOCK'>Door Knock</option>
          </select>

          {/* 6. AI PRIORITY FILTER - AI PLAN ONLY */}
          {hasAI && (
            <select
              value={filterAiPriority}
              onChange={(e) => setFilterAiPriority(e.target.value)}
              className='border border-purple-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none w-full bg-purple-50'
            >
              <option value=''>All AI Priorities</option>
              <option value='HIGH'>🔥 High Priority</option>
              <option value='MEDIUM'>⚡ Medium Priority</option>
              <option value='LOW'>📊 Low Priority</option>
            </select>
          )}

          {/* 7. DATE ADDED FILTER */}
          <div className='flex flex-col gap-1'>
            <label className='text-xs text-gray-600'>Date Added:</label>
            <input
              type='date'
              value={filterDateAdded}
              onChange={(e) => setFilterDateAdded(e.target.value)}
              className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full'
            />
          </div>

          {/* 8. SKIP TRACE DATE FILTERS */}
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
        {(filterType || filterStatus || filterGhlStatus || filterHasPhone || filterManualStatus || skipTraceFromDate || skipTraceToDate) && (
          <button
            onClick={() => {
              setFilterType('');
              setFilterStatus('');
              setFilterGhlStatus('');
              setFilterHasPhone('');
              setFilterManualStatus('');
              setSkipTraceFromDate('');
              setSkipTraceToDate('');
            }}
            className='text-sm text-blue-600 hover:underline whitespace-nowrap'
          >
            Clear All
          </button>
        )}
      </div>
      )}

      {/* Download Button - Always Visible When Leads Selected */}
      {selectedLeadsCount > 0 && (
        <div className='flex justify-end'>
          <button
            onClick={handleDownloadSkipTraced}
            className='text-sm px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 transition shadow-sm whitespace-nowrap'
          >
            📥 Download Selected ({selectedLeadsCount})
          </button>
        </div>
      )}

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

            {/* View Details Button (only when 1 lead selected) */}
            {selectedLeadsCount === 1 && (
              <button
                onClick={handleViewDetails}
                className='text-sm px-3 py-1.5 rounded bg-gray-600 text-white hover:bg-gray-700 transition shadow-sm w-full sm:w-auto'
              >
                👁️ View Details
              </button>
            )}

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

            {/* Email Campaign Button */}
            <button
              onClick={handleBulkEmailCampaign}
              disabled={isEmailCampaigning || isSkipTracing || isGhlSyncing}
              className={`text-sm px-3 py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 shadow-sm w-full sm:w-auto
                                ${isEmailCampaigning ? 'bg-blue-300 text-white cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700'}`}
            >
              {isEmailCampaigning ? (
                <>
                  <Loader size='small' variation='linear' /> Sending...
                </>
              ) : (
                <>📧 Start Email Campaign</>
              )}
            </button>

            {/* Populate Queue Button */}
            <button
              onClick={handlePopulateQueue}
              disabled={isPopulatingQueue || isSkipTracing || isGhlSyncing}
              className={`text-sm px-3 py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 shadow-sm w-full sm:w-auto
                                ${isPopulatingQueue ? 'bg-purple-300 text-white cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'}`}
            >
              {isPopulatingQueue ? (
                <>
                  <Loader size='small' variation='linear' /> Populating...
                </>
              ) : (
                <>🔄 Populate Queue</>
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
