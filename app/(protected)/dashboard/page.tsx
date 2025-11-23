'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { type Schema } from '@/amplify/data/resource'; // Adjust path
import { useRouter } from 'next/navigation';
import axios from 'axios';

// Define the shape of a Lead
type Lead = Schema['Lead']['type'];

// 1. 👇 DEFINE THE SHAPE OF YOUR API RESPONSE
type LeadsApiResponse = {
  success: boolean;
  leads: Lead[];
};

const axiosInstance = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds
});

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing'>('idle');
  const router = useRouter();

  // 1. Fetch all leads on page load
  useEffect(() => {
    fetchLeads();
  }, []);

  // 3. 👇 UPDATED fetchLeads FUNCTION
  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      // Use the correct response type
      const response = await axiosInstance.get<LeadsApiResponse>('/leads');
      const data = response.data; // data is { success: true, leads: [...] }

      // Check for success and set the leads array
      if (data.success && data.leads) {
        setLeads(data.leads);
      } else {
        setLeads([]);
      }
    } catch (err: any) {
      // Axios automatically throws for 4xx/5xx errors
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Handle checkbox selection
  const handleSelect = (leadId: string) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId)
        ? prev.filter((id) => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeads(leads.map((lead) => lead.id));
    } else {
      setSelectedLeads([]);
    }
  };

  // 3. Handle the "Skip Trace" button click
  const handleSkipTrace = async () => {
    if (selectedLeads.length === 0) {
      alert('Please select at least one lead to skip trace.');
      return;
    }

    // 1. Get the full lead objects for the selected IDs
    const leadsToTrace = leads.filter((lead) =>
      selectedLeads.includes(lead.id)
    );

    // 2. Check the type of the *first* selected lead
    // (We assume a batch is all one type)
    const leadType = leadsToTrace[0].type;
    const leadIdsToTrace = leadsToTrace.map((l) => l.id);

    setStatus('processing');
    setError(null);

    try {
      // 3. Call the *one* correct API route based on the lead type
      if (leadType === 'probate') {
        await axiosInstance.post('/skiptrace-leads/probate', {
          leadIds: leadIdsToTrace,
        });
      } else if (leadType === 'preforeclosure') {
        await axiosInstance.post('/skiptrace-leads/preforeclosure', {
          leadIds: leadIdsToTrace,
        });
      } else {
        throw new Error('Unknown lead type in batch.');
      }

      // 4. Refresh the data
      alert('Skip trace complete!');
      await fetchLeads(); // This now calls your axios-based function
      setSelectedLeads([]);
      setStatus('idle');
    } catch (err: any) {
      setError(err.message);
      setStatus('idle');
    }
  };

  return (
    <main className='max-w-6xl mx-auto py-10 px-6'>
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-3xl font-bold'>My Leads</h1>
        <Link
          href='/(protected)/upload' // Link to your upload page
          className='bg-blue-600 text-white py-2 px-4 rounded-md shadow-sm hover:bg-blue-700'
        >
          + Add/Upload Leads
        </Link>
      </div>

      {error && (
        <div className='p-3 bg-red-100 text-red-700 rounded-md mb-4'>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Action Bar */}
      <div className='mb-4'>
        <button
          onClick={handleSkipTrace}
          disabled={selectedLeads.length === 0 || status === 'processing'}
          className='bg-green-600 text-white py-2 px-4 rounded-md shadow-sm disabled:bg-gray-400'
        >
          {status === 'processing'
            ? 'Processing...'
            : `Skip Trace (${selectedLeads.length}) Selected`}
        </button>
      </div>

      {/* Leads Table */}
      <div className='bg-white shadow border rounded-lg overflow-hidden'>
        <table className='min-w-full divide-y divide-gray-200'>
          <thead className='bg-gray-50'>
            <tr>
              <th className='px-6 py-3 w-12'>
                <input type='checkbox' onChange={handleSelectAll} />
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Name
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Property Address
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Type
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Skiptrace Status
              </th>
            </tr>
          </thead>
          <tbody className='bg-white divide-y divide-gray-200'>
            {isLoading ? (
              <tr>
                <td colSpan={5} className='text-center p-4'>
                  Loading...
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={5} className='text-center p-4'>
                  No leads found. Add or upload leads to get started.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  className={
                    selectedLeads.includes(lead.id) ? 'bg-blue-50' : ''
                  }
                >
                  <td className='px-6 py-4'>
                    <input
                      type='checkbox'
                      checked={selectedLeads.includes(lead.id)}
                      onChange={() => handleSelect(lead.id)}
                    />
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
                    <Link
                      href={`/lead/${lead.id}`}
                      className='text-blue-600 hover:text-blue-800'
                    >
                      {lead.ownerFirstName} {lead.ownerLastName}
                    </Link>
                  </td>

                  <td className='px-6 py-4 whitespace-nowrap text-sm'>
                    <Link
                      href={`/lead/${lead.id}`}
                      className='text-blue-600 hover:text-blue-800'
                    >
                      {lead.ownerAddress}, {lead.ownerCity}, {lead.ownerState}
                    </Link>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm'>
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        lead.type === 'probate'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}
                    >
                      {lead.type}
                    </span>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm'>
                    {lead.skipTraceStatus === 'COMPLETED' ? (
                      <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800'>
                        Completed
                      </span>
                    ) : lead.skipTraceStatus === 'FAILED' ? (
                      <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800'>
                        Failed
                      </span>
                    ) : (
                      <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800'>
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
