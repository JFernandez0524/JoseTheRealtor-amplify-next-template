'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { client } from '../../../app/utils/aws/data/frontEndClient';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { type Schema } from '@/amplify/data/resource';

// Define the shape of a Lead
type Lead = Schema['PropertyLead']['type'] & {
  __typename?: string | null;
};

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  // 🟢 Filter States
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSkipTracing, setIsSkipTracing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const router = useRouter();

  // Re-fetch whenever filters change
  useEffect(() => {
    fetchLeads();
  }, [filterType, filterStatus]);

  const fetchLeads = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const user = await getFrontEndUser();
      if (!user) {
        console.log('No user found, redirecting to login...');
        router.push('/login');
        return;
      }
      setCurrentUserId(user.userId);

      // 1. Construct dynamic filter object
      const filterInput: any = {};

      if (filterType) {
        filterInput.type = { eq: filterType };
      }
      if (filterStatus) {
        filterInput.skipTraceStatus = { eq: filterStatus };
      }

      // 2. Check if we actually have filters
      const hasFilters = Object.keys(filterInput).length > 0;

      const { data, errors } = await client.models.PropertyLead.list({
        authMode: 'userPool',
        // Only pass 'filter' if it is NOT empty. Pass undefined otherwise.
        filter: hasFilters ? filterInput : undefined,
      });

      if (errors && errors.length > 0) {
        console.error('❌ GraphQL Errors:', errors);
        throw new Error(errors[0].message);
      }

      if (!data) {
        throw new Error('No data returned from GraphQL');
      }

      // Client-side sort by Date (Newest first)
      const sortedLeads = data.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setLeads(sortedLeads);
    } catch (err: any) {
      console.error('❌ Error fetching leads:', err);
      setError(err.message || 'Failed to load leads.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map((l) => l.id));
    }
  };

  const toggleSelectLead = (id: string) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter((l) => l !== id));
    } else {
      setSelectedLeads([...selectedLeads, id]);
    }
  };

  const handleBulkSkipTrace = async () => {
    if (selectedLeads.length === 0) return;

    if (
      !confirm(
        `This will perform a Skip Trace on ${selectedLeads.length} leads. Continue?`
      )
    ) {
      return;
    }

    setIsSkipTracing(true);
    try {
      await client.mutations.skipTraceLeads({
        leadIds: selectedLeads,
        targetCrm: 'NONE',
      });

      alert('Skip Trace Complete! Leads have been updated.');

      setSelectedLeads([]);
      await fetchLeads();
    } catch (err) {
      console.error('Skip Trace Failed:', err);
      alert('An error occurred during skip tracing.');
    } finally {
      setIsSkipTracing(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete ${selectedLeads.length} lead(s)?`
      )
    ) {
      return;
    }

    try {
      await Promise.all(
        selectedLeads.map((id) => client.models.PropertyLead.delete({ id }))
      );

      setSelectedLeads([]);
      await fetchLeads();
    } catch (err) {
      console.error('Error deleting leads:', err);
      alert('Failed to delete leads.');
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const handleRowClick = (leadId: string) => {
    router.push(`/lead/${leadId}`);
  };

  // 🟢 Count Invalid Leads for Alert
  const invalidLeadsCount = leads.filter(
    (l) => l.validationStatus === 'INVALID'
  ).length;

  return (
    <main className='p-6 max-w-[95%] mx-auto'>
      {/* HEADER */}
      <div className='flex flex-col md:flex-row justify-between items-center mb-6 gap-4'>
        <div>
          <h1 className='text-3xl font-bold text-gray-800'>All Leads Data</h1>
          {currentUserId && (
            <p className='text-sm text-gray-500 mt-1 font-mono text-xs'>
              Owner: {currentUserId}
            </p>
          )}
        </div>

        {/* ACTION BUTTONS */}
        <div className='flex flex-wrap gap-2'>
          <button
            onClick={fetchLeads}
            className='bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition shadow-sm'
          >
            🔄 Refresh
          </button>

          <button
            onClick={() => router.push('/upload')}
            className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition shadow-sm'
          >
            Upload CSV
          </button>

          {/* BULK ACTIONS */}
          {selectedLeads.length > 0 && (
            <>
              <button
                onClick={handleBulkSkipTrace}
                disabled={isSkipTracing}
                className='bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition shadow-sm disabled:opacity-50 flex items-center gap-2'
              >
                {isSkipTracing ? (
                  <>Processing...</>
                ) : (
                  <>🔍 Skip Trace ({selectedLeads.length})</>
                )}
              </button>

              <button
                onClick={handleDelete}
                className='bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition shadow-sm'
              >
                Delete ({selectedLeads.length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* 🟢 INVALID ADDRESS WARNING */}
      {invalidLeadsCount > 0 && (
        <div className='bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg relative mb-6 flex items-start gap-3 shadow-sm'>
          <span className='text-xl'>⚠️</span>
          <div>
            <strong className='font-bold'>Attention Needed: </strong>
            <span className='block sm:inline'>
              Found {invalidLeadsCount} lead(s) with invalid addresses. Google
              Maps could not locate them. Please click on the rows marked
              "INVALID" to edit the address manually.
            </span>
          </div>
        </div>
      )}

      {/* FILTER BAR */}
      <div className='bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-center'>
        <span className='text-sm font-semibold text-gray-600'>Filter By:</span>

        {/* Type Select */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className='border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none'
        >
          <option value=''>All Lead Types</option>
          <option value='preforeclosure'>Pre-Foreclosure</option>
          <option value='probate'>Probate</option>
        </select>

        {/* Status Select */}
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

        {/* Clear Filters Button */}
        {(filterType || filterStatus) && (
          <button
            onClick={() => {
              setFilterType('');
              setFilterStatus('');
            }}
            className='text-sm text-blue-600 hover:underline'
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Stats Row */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-6'>
        <div className='bg-white rounded-lg shadow p-4 border border-gray-200'>
          <p className='text-gray-600 text-sm'>Total Leads</p>
          <p className='text-3xl font-bold text-gray-900'>{leads.length}</p>
        </div>
        <div className='bg-white rounded-lg shadow p-4 border border-gray-200'>
          <p className='text-gray-600 text-sm'>Pending Trace</p>
          <p className='text-3xl font-bold text-yellow-600'>
            {leads.filter((l) => l.skipTraceStatus === 'PENDING').length}
          </p>
        </div>
        <div className='bg-white rounded-lg shadow p-4 border border-gray-200'>
          <p className='text-gray-600 text-sm'>Enriched</p>
          <p className='text-3xl font-bold text-green-600'>
            {leads.filter((l) => l.skipTraceStatus === 'COMPLETED').length}
          </p>
        </div>
        <div className='bg-white rounded-lg shadow p-4 border border-gray-200'>
          <p className='text-gray-600 text-sm'>Failed/No Match</p>
          <p className='text-3xl font-bold text-red-600'>
            {
              leads.filter(
                (l) =>
                  l.skipTraceStatus === 'FAILED' ||
                  l.skipTraceStatus === 'NO_MATCH'
              ).length
            }
          </p>
        </div>
      </div>

      {error && (
        <div className='bg-red-50 text-red-600 p-4 rounded-md mb-4 border border-red-200'>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* SCROLLABLE TABLE CONTAINER */}
      <div className='bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200'>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th scope='col' className='px-4 py-3 text-left w-10'>
                  <input
                    type='checkbox'
                    className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4'
                    checked={
                      leads.length > 0 && selectedLeads.length === leads.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  Type
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  Status
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  Enriched Data
                </th>

                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-blue-50'>
                  Owner Name
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-blue-50'>
                  Address
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-blue-50'>
                  City/State/Zip
                </th>

                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-purple-50'>
                  Admin Name
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-purple-50'>
                  Admin Address
                </th>

                <th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  Created At
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={10}
                    className='px-6 py-10 text-center text-gray-500'
                  >
                    <div className='flex flex-col items-center'>
                      <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2'></div>
                      Loading data...
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className='px-6 py-10 text-center text-gray-500'
                  >
                    <div className='text-lg mb-2'>📭 No leads found</div>
                    <div className='text-sm'>
                      Try adjusting filters or upload a CSV file.
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => handleRowClick(lead.id)}
                    className='hover:bg-gray-50 transition cursor-pointer'
                  >
                    <td className='px-4 py-4 whitespace-nowrap'>
                      <input
                        type='checkbox'
                        className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4'
                        checked={selectedLeads.includes(lead.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelectLead(lead.id)}
                      />
                    </td>

                    <td className='px-4 py-4 whitespace-nowrap text-sm'>
                      <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize'>
                        {lead.type}
                      </span>
                    </td>

                    <td className='px-4 py-4 whitespace-nowrap text-sm'>
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          lead.skipTraceStatus === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : lead.skipTraceStatus === 'FAILED' ||
                                lead.skipTraceStatus === 'NO_MATCH'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {lead.skipTraceStatus}
                      </span>
                    </td>

                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-600'>
                      {lead.phones && lead.phones.length > 0 ? (
                        <span className='font-semibold text-green-700'>
                          ✓ {lead.phones.length} Phone(s)
                        </span>
                      ) : (
                        <span className='text-gray-400 text-xs'>No Phones</span>
                      )}
                    </td>

                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                      {lead.ownerFirstName} {lead.ownerLastName}
                    </td>

                    {/* 🟢 VALIDATION STATUS INDICATOR ON ADDRESS */}
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                      <div className='flex items-center gap-2'>
                        {lead.ownerAddress}
                        {lead.validationStatus === 'INVALID' && (
                          <span
                            className='text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold'
                            title='Invalid Address'
                          >
                            ⚠️
                          </span>
                        )}
                      </div>
                    </td>

                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                      {lead.ownerCity}, {lead.ownerState} {lead.ownerZip}
                    </td>

                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-purple-50/30'>
                      {lead.adminFirstName
                        ? `${lead.adminFirstName} ${lead.adminLastName}`
                        : '-'}
                    </td>
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-purple-50/30'>
                      {lead.adminAddress
                        ? `${lead.adminAddress}, ${lead.adminCity}`
                        : '-'}
                    </td>

                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-500'>
                      {formatDate(lead.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
