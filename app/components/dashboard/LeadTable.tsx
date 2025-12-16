import React from 'react';
import { StatusBadge } from '../shared/StatusBadge';
import { formatDate } from '@/app/utils/formatters';
import { type Schema } from '@/amplify/data/resource';
// We will use standard icons/symbols since you use StatusBadge (custom)
// and we want to avoid unnecessary imports like lucide-react if not used elsewhere.

// 💥 1. EXTENDED LEAD TYPE
type Lead = Schema['PropertyLead']['type'] & {
  ghlSyncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  ghlContactId?: string;
  ghlSyncDate?: string;
};

type Props = {
  leads: Lead[];
  selectedIds: string[];
  isLoading: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onRowClick: (id: string) => void;
};

// ---------------------------------------------------------
// Helper: GHL Status Badge Renderer (New Component)
// ---------------------------------------------------------

const GhlStatusBadge: React.FC<{ status: Lead['ghlSyncStatus'] }> = ({
  status,
}) => {
  const baseClasses =
    'px-2 py-0.5 rounded-full text-xs font-medium capitalize flex items-center gap-1';

  if (!status || status === 'PENDING') {
    return (
      <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>
        <span role='img' aria-label='clock'>
          ⏳
        </span>{' '}
        {status || 'N/A'}
      </span>
    );
  }

  if (status === 'SUCCESS') {
    return (
      <span className={`${baseClasses} bg-purple-100 text-purple-800`}>
        <span role='img' aria-label='check'>
          ✅
        </span>{' '}
        {status}
      </span>
    );
  }

  if (status === 'FAILED') {
    return (
      <span className={`${baseClasses} bg-red-100 text-red-800`}>
        <span role='img' aria-label='cross'>
          ❌
        </span>{' '}
        {status}
      </span>
    );
  }

  if (status === 'SKIPPED') {
    return (
      <span className={`${baseClasses} bg-gray-100 text-gray-700`}>
        <span role='img' aria-label='skip'>
          🚫
        </span>{' '}
        {status}
      </span>
    );
  }

  return null;
};

export function LeadTable({
  leads,
  selectedIds,
  isLoading,
  onToggleAll,
  onToggleOne,
  onRowClick,
}: Props) {
  return (
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
                    leads.length > 0 && selectedIds.length === leads.length
                  }
                  onChange={onToggleAll}
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
              {/* 💥 2. NEW GHL STATUS HEADER */}
              <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-purple-50'>
                GHL Sync
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
                  colSpan={11} // Increased colspan to account for new column
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
                  colSpan={11} // Increased colspan to account for new column
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
                  onClick={() => onRowClick(lead.id)}
                  className='hover:bg-gray-50 transition cursor-pointer'
                >
                  <td className='px-4 py-4 whitespace-nowrap'>
                    <input
                      type='checkbox'
                      className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4'
                      checked={selectedIds.includes(lead.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggleOne(lead.id)}
                    />
                  </td>

                  <td className='px-4 py-4 whitespace-nowrap text-sm'>
                    <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize'>
                      {lead.type}
                    </span>
                  </td>

                  <td className='px-4 py-4 whitespace-nowrap text-sm'>
                    <StatusBadge status={lead.skipTraceStatus} />
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

                  {/* 💥 3. NEW GHL STATUS CELL */}
                  <td className='px-4 py-4 whitespace-nowrap text-sm'>
                    <GhlStatusBadge status={lead.ghlSyncStatus} />
                  </td>

                  <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                    {lead.ownerFirstName} {lead.ownerLastName}
                  </td>

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
  );
}
