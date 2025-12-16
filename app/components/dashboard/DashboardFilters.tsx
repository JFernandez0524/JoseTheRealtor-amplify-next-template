import React from 'react';

type Props = {
  filterType: string;
  setFilterType: (val: string) => void;
  filterStatus: string; // This is the Skip Trace Status
  setFilterStatus: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  // 💥 NEW PROPS FOR GHL FILTER
  filterGhlStatus: string;
  setFilterGhlStatus: (val: string) => void;
};

export function DashboardFilters({
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  searchQuery,
  setSearchQuery,
  // 💥 DESTUCTURE NEW PROPS
  filterGhlStatus,
  setFilterGhlStatus,
}: Props) {
  return (
    <div className='bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-center justify-between'>
            {/* Left Side: Filters */}     {' '}
      <div className='flex flex-wrap gap-4 items-center'>
               {' '}
        <span className='text-sm font-semibold text-gray-600'>Filter By:</span> 
              {/* 1. Lead Type Filter */}       {' '}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none'
        >
                    <option value=''>All Lead Types</option>         {' '}
          <option value='preforeclosure'>Pre-Foreclosure</option>         {' '}
          <option value='probate'>Probate</option>       {' '}
        </select>
                {/* 2. Skip Trace Status Filter */}       {' '}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none'
        >
                    <option value=''>All Trace Statuses</option>         {' '}
          <option value='PENDING'>Pending Trace</option>         {' '}
          <option value='COMPLETED'>Completed Trace</option>         {' '}
          <option value='FAILED'>Failed/Error</option>         {' '}
          <option value='NO_MATCH'>No Match</option>       {' '}
        </select>
        {/* 💥 3. NEW GHL SYNC STATUS FILTER */}
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
                {/* Clear All Button */}       {' '}
        {(filterType || filterStatus || searchQuery || filterGhlStatus) && (
          <button
            onClick={() => {
              setFilterType('');
              setFilterStatus('');
              setFilterGhlStatus(''); // 💥 CLEAR NEW FILTER
              setSearchQuery('');
            }}
            className='text-sm text-blue-600 hover:underline'
          >
                        Clear All          {' '}
          </button>
        )}
             {' '}
      </div>
            {/* Right Side: Search Bar */}     {' '}
      <div className='relative w-full md:w-64'>
               {' '}
        <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                   {' '}
          <svg
            className='h-5 w-5 text-gray-400'
            fill='currentColor'
            viewBox='0 0 20 20'
          >
                       {' '}
            <path
              fillRule='evenodd'
              d='M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z'
              clipRule='evenodd'
            />
                     {' '}
          </svg>
                 {' '}
        </div>
               {' '}
        <input
          type='text'
          placeholder='Search Address...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className='pl-10 block w-full border border-gray-300 rounded-md py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none'
        />
             {' '}
      </div>
         {' '}
    </div>
  );
}
