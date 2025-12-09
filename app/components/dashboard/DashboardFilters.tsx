import React from 'react';

type Props = {
  filterType: string;
  setFilterType: (val: string) => void;
  filterStatus: string;
  setFilterStatus: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
};

export function DashboardFilters({
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  searchQuery,
  setSearchQuery,
}: Props) {
  return (
    <div className='bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-center justify-between'>
      {/* Left Side: Filters */}
      <div className='flex flex-wrap gap-4 items-center'>
        <span className='text-sm font-semibold text-gray-600'>Filter By:</span>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none'
        >
          <option value=''>All Lead Types</option>
          <option value='preforeclosure'>Pre-Foreclosure</option>
          <option value='probate'>Probate</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none'
        >
          <option value=''>All Statuses</option>
          <option value='PENDING'>Pending Trace</option>
          <option value='COMPLETED'>Completed</option>
          <option value='FAILED'>Failed/No Match</option>
        </select>

        {(filterType || filterStatus || searchQuery) && (
          <button
            onClick={() => {
              setFilterType('');
              setFilterStatus('');
              setSearchQuery('');
            }}
            className='text-sm text-blue-600 hover:underline'
          >
            Clear All
          </button>
        )}
      </div>

      {/* Right Side: Search Bar */}
      <div className='relative w-full md:w-64'>
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
    </div>
  );
}
