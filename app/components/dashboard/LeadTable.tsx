import React from 'react';
import { StatusBadge } from '../shared/StatusBadge';
import { formatDate } from '@/app/utils/formatters';
import { type Schema } from '@/amplify/data/resource';

// Use the Schema type directly
type Lead = Schema['PropertyLead']['type'];

type Props = {
  leads: Lead[];
  selectedIds: string[];
  isLoading: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onRowClick: (id: string) => void;
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
