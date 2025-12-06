'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { client } from '../../../app/utils/aws/data/frontEndClient';
import { getCurrentUser } from 'aws-amplify/auth';
import { type Schema } from '@/amplify/data/resource';

// Define the shape of a Lead
type Lead = Schema['PropertyLead']['type'] & {
  __typename?: string | null;
};

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Get User (Mostly for your own debugging display)
      const user = await getCurrentUser();
      setCurrentUserId(user.userId);
      console.log('🔍 Current User ID:', user.userId);

      // 2. Fetch Leads (Amplify automatically applies the "Owner" filter)
      const { data, errors } = await client.models.PropertyLead.list();

      if (errors && errors.length > 0) {
        console.error('❌ GraphQL Errors:', errors);
        throw new Error(errors[0].message);
      }

      console.log('✅ Leads fetched:', data.length);

      if (!data) {
        throw new Error('No data returned from GraphQL');
      }

      // 👇 FIX: Handle null/undefined dates safely
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

  return (
    <main className='p-6 max-w-[95%] mx-auto'>
      {/* HEADER */}
      <div className='flex justify-between items-center mb-6'>
        <div>
          <h1 className='text-3xl font-bold text-gray-800'>All Leads Data</h1>
          {currentUserId && (
            <p className='text-sm text-gray-500 mt-1 font-mono text-xs'>
              Owner: {currentUserId}
            </p>
          )}
        </div>
        <div className='space-x-2'>
          <button
            onClick={fetchLeads}
            className='bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition shadow-sm'
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => router.push('/upload')}
            className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition shadow-sm'
          >
            Upload CSV
          </button>
          {selectedLeads.length > 0 && (
            <button
              onClick={handleDelete}
              className='bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition shadow-sm'
            >
              Delete ({selectedLeads.length})
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-6'>
        <div className='bg-white rounded-lg shadow p-4 border border-gray-200'>
          <p className='text-gray-600 text-sm'>Total Leads</p>
          <p className='text-3xl font-bold text-gray-900'>{leads.length}</p>
        </div>
        <div className='bg-white rounded-lg shadow p-4 border border-gray-200'>
          <p className='text-gray-600 text-sm'>Pending</p>
          <p className='text-3xl font-bold text-yellow-600'>
            {leads.filter((l) => l.skipTraceStatus === 'PENDING').length}
          </p>
        </div>
        <div className='bg-white rounded-lg shadow p-4 border border-gray-200'>
          <p className='text-gray-600 text-sm'>Completed</p>
          <p className='text-3xl font-bold text-green-600'>
            {leads.filter((l) => l.skipTraceStatus === 'COMPLETED').length}
          </p>
        </div>
        <div className='bg-white rounded-lg shadow p-4 border border-gray-200'>
          <p className='text-gray-600 text-sm'>Failed</p>
          <p className='text-3xl font-bold text-red-600'>
            {leads.filter((l) => l.skipTraceStatus === 'FAILED').length}
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
                  ID
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  Type
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  Status
                </th>

                {/* Owner Info */}
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-blue-50'>
                  Owner Name
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-blue-50'>
                  Address
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-blue-50'>
                  City/State/Zip
                </th>

                {/* Admin Info */}
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
                      Upload a CSV file to get started
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className='hover:bg-gray-50 transition'>
                    <td className='px-4 py-4 whitespace-nowrap'>
                      <input
                        type='checkbox'
                        className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4'
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => toggleSelectLead(lead.id)}
                      />
                    </td>

                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-500 font-mono'>
                      {lead.id.substring(0, 8)}...
                    </td>

                    <td className='px-4 py-4 whitespace-nowrap text-sm'>
                      <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800'>
                        {lead.type}
                      </span>
                    </td>

                    <td className='px-4 py-4 whitespace-nowrap text-sm'>
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          lead.skipTraceStatus === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : lead.skipTraceStatus === 'FAILED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {lead.skipTraceStatus}
                      </span>
                    </td>

                    {/* Owner Data */}
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                      {lead.ownerFirstName} {lead.ownerLastName}
                    </td>
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                      {lead.ownerAddress}
                    </td>
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                      {lead.ownerCity}, {lead.ownerState} {lead.ownerZip}
                    </td>

                    {/* Admin Data */}
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
