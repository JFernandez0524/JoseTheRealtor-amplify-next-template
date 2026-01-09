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

  // Bulk Action Props
  selectedLeadsCount: number;
  handleBulkSkipTrace: () => Promise<void>;
  handleBulkGHLSync: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleExport: () => void;
  isSkipTracing: boolean;
  isGhlSyncing: boolean;
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
  selectedLeadsCount,
  handleBulkSkipTrace,
  handleBulkGHLSync,
  handleDelete,
  handleExport,
  isSkipTracing,
  isGhlSyncing,
}: Props) {
  return (
    // 💥 FIX 1: Ensure the main container is flexible horizontally on MD screens
    // Removed unnecessary flex-wrap on md:
    <div className='bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-wrap md:flex-nowrap gap-4 items-start justify-between'>
      {/* Left Side: Filters and Statuses (Ensures filters wrap together) */}
      <div className='flex flex-wrap gap-4 items-center flex-grow'>
        <span className='text-sm font-semibold text-gray-600'>Filter By:</span>

        {/* 1. Lead Type Filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none'
        >
          <option value=''>All Lead Types</option>
          <option value='PREFORECLOSURE'>Pre-Foreclosure</option>
          <option value='PROBATE'>Probate</option>
        </select>

        {/* 2. Skip Trace Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none'
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
          className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none'
        >
          <option value=''>All GHL Statuses</option>
          <option value='SUCCESS'>GHL Synced</option>
          <option value='PENDING'>GHL Pending</option>
          <option value='FAILED'>GHL Failed</option>
          <option value='SKIPPED'>GHL Skipped</option>
          <option value='NULL'>Needs GHL Sync</option>
        </select>

        {/* Clear All Button */}
        {(filterType || filterStatus || searchQuery || filterGhlStatus) && (
          <button
            onClick={() => {
              setFilterType('');
              setFilterStatus('');
              setFilterGhlStatus('');
              setSearchQuery('');
            }}
            className='text-sm text-blue-600 hover:underline'
          >
            Clear All
          </button>
        )}
      </div>

      {/* Right Side: Search Bar and Bulk Actions (Pushed to the right) */}
      <div className='flex flex-col md:flex-row gap-4 items-center w-full md:w-auto'>
        {/* Search Bar */}
        {/* 💥 FIX 2: Added margin bottom on small screens so it separates from buttons */}
        <div className='relative w-full md:w-64 mb-4 md:mb-0'>
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
          <div className='flex space-x-2'>
            <span className='text-sm font-semibold self-center whitespace-nowrap text-gray-700'>
              {selectedLeadsCount} Selected:
            </span>

            {/* Skip Trace Button */}
            <button
              onClick={handleBulkSkipTrace}
              disabled={isSkipTracing || isGhlSyncing}
              className={`text-sm px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 shadow-sm
                                ${isSkipTracing ? 'bg-indigo-300 text-white cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
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
              className={`text-sm px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 shadow-sm
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

            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={isGhlSyncing || isSkipTracing}
              className='text-sm px-3 py-1.5 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition shadow-sm'
            >
              Export
            </button>

            {/* Delete Button */}
            <button
              onClick={handleDelete}
              disabled={isGhlSyncing || isSkipTracing}
              className='text-sm px-3 py-1.5 rounded bg-red-100 text-red-600 hover:bg-red-200 transition shadow-sm'
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
