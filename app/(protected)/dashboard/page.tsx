'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { type Schema } from '@/amplify/data/resource';
import { useRouter } from 'next/navigation';
import axios from 'axios';

// Define the shape of a Lead based on your Schema
// We extend it slightly to ensure TypeScript doesn't complain about internal fields like 'owner'
type Lead = Schema['Lead']['type'] & {
  owner?: string;
  __typename?: string;
};

type LeadsApiResponse = {
  success: boolean;
  leads: Lead[];
};

const axiosInstance = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get<LeadsApiResponse>('/leads');
      setLeads(response.data.leads || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching leads:', err);
      setError('Failed to load leads. Please try again.');
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

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <main className='p-6 max-w-[95%] mx-auto'>
      {/* HEADER */}
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-3xl font-bold text-gray-800'>All Leads Data</h1>
        <div className='space-x-2'>
          <button
            onClick={() => router.push('/upload')}
            className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition shadow-sm'
          >
            Upload CSV
          </button>
          {selectedLeads.length > 0 && (
            <button className='bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition shadow-sm'>
              Delete ({selectedLeads.length})
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className='bg-red-50 text-red-600 p-3 rounded-md mb-4 border border-red-200'>
          {error}
        </div>
      )}

      {/* --- SCROLLABLE TABLE CONTAINER --- */}
      <div className='bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200'>
        <div className='overflow-x-auto'>
          {' '}
          {/* 👈 Enables Horizontal Scroll */}
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
                {/* 19 Columns requested */}
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  ID
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  Type Name
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  Type
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  Status
                </th>

                {/* Owner Info */}
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-blue-50'>
                  Owner First
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-blue-50'>
                  Owner Last
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-blue-50'>
                  Owner Address
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-blue-50'>
                  Owner City
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-blue-50'>
                  Owner State
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-blue-50'>
                  Owner Zip
                </th>

                {/* Admin Info */}
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-purple-50'>
                  Admin First
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-purple-50'>
                  Admin Last
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-purple-50'>
                  Admin Address
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-purple-50'>
                  Admin City
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-purple-50'>
                  Admin State
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-purple-50'>
                  Admin Zip
                </th>

                {/* Meta Data */}
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  Created At
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  Updated At
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  Record Owner (ID)
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={20}
                    className='px-6 py-10 text-center text-gray-500'
                  >
                    Loading data...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td
                    colSpan={20}
                    className='px-6 py-10 text-center text-gray-500'
                  >
                    No leads found.
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
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-500'>
                      {lead.__typename || 'Lead'}
                    </td>

                    <td className='px-4 py-4 whitespace-nowrap text-sm'>
                      <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800'>
                        {lead.type}
                      </span>
                    </td>

                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-500'>
                      {lead.skipTraceStatus}
                    </td>

                    {/* Owner Fields */}
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                      {lead.ownerFirstName || '-'}
                    </td>
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                      {lead.ownerLastName || '-'}
                    </td>
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                      {lead.ownerAddress || '-'}
                    </td>
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                      {lead.ownerCity || '-'}
                    </td>
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                      {lead.ownerState || '-'}
                    </td>
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                      {lead.ownerZip || '-'}
                    </td>

                    {/* Admin Fields */}
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-purple-50/30'>
                      {lead.adminFirstName || '-'}
                    </td>
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-purple-50/30'>
                      {lead.adminLastName || '-'}
                    </td>
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-purple-50/30'>
                      {lead.adminAddress || '-'}
                    </td>
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-purple-50/30'>
                      {lead.adminCity || '-'}
                    </td>
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-purple-50/30'>
                      {lead.adminState || '-'}
                    </td>
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-purple-50/30'>
                      {lead.adminZip || '-'}
                    </td>

                    {/* Meta Fields */}
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-500'>
                      {formatDate(lead.createdAt)}
                    </td>
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-500'>
                      {formatDate(lead.updatedAt)}
                    </td>
                    <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-400 font-mono text-xs'>
                      {lead.owner || 'Unknown'}
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
