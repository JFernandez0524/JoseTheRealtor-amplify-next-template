// app/components/dashboard/LeadTable.tsx
/** @jsxImportSource react */

import React from 'react';
import { StatusBadge } from '../shared/StatusBadge';
import { formatDate } from '@/app/utils/formatters';
import { type Schema } from '@/amplify/data/resource';

// 1. EXTENDED LEAD TYPE (Kept correct)
type Lead = Schema['PropertyLead']['type'] & {
  ghlSyncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  ghlContactId?: string | null;
  ghlSyncDate?: string | null;
};

type Props = {
  leads: Lead[];
  selectedIds: string[];
  isLoading: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onRowClick: (id: string) => void;
  sortField:
    | 'createdAt'
    | 'updatedAt'
    | 'ownerLastName'
    | 'ownerCounty'
    | 'zestimate'
    | 'skipTraceCompletedAt'
    | 'aiScore';
  sortDirection: 'asc' | 'desc';
  onSort: (
    field:
      | 'createdAt'
      | 'updatedAt'
      | 'ownerLastName'
      | 'ownerCounty'
      | 'zestimate'
      | 'skipTraceCompletedAt'
      | 'aiScore'
  ) => void;
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
  sortField,
  sortDirection,
  onSort,
}: Props) {
  const tableRef = React.useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (tableRef.current) {
      tableRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (tableRef.current) {
      tableRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  const renderSortableHeader = (
    field:
      | 'createdAt'
      | 'updatedAt'
      | 'ownerLastName'
      | 'ownerCounty'
      | 'zestimate'
      | 'skipTraceCompletedAt'
      | 'aiScore',
    children: React.ReactNode,
    className: string = ''
  ) => (
    <th
      className={`px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 ${className}`}
      onClick={() => onSort(field)}
    >
      <div className='flex items-center gap-1'>
        {children}
        {sortField === field && (
          <span className='text-blue-500'>
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );

  return (
    <div className='bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200'>
      {/* Horizontal Scroll Controls */}
      <div className='flex justify-between items-center px-4 py-2 bg-gray-50 border-b border-gray-200'>
        <div className='text-sm text-gray-600'>
          {leads.length} leads on this page
        </div>
        <div className='flex items-center gap-2'>
          <button
            onClick={scrollLeft}
            className='p-1 rounded border border-gray-300 hover:bg-gray-100 transition-colors'
            title='Scroll left'
          >
            <svg
              className='w-4 h-4 text-gray-600'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M15 19l-7-7 7-7'
              />
            </svg>
          </button>
          <span className='text-xs text-gray-500'>Scroll table</span>
          <button
            onClick={scrollRight}
            className='p-1 rounded border border-gray-300 hover:bg-gray-100 transition-colors'
            title='Scroll right'
          >
            <svg
              className='w-4 h-4 text-gray-600'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M9 5l7 7-7 7'
              />
            </svg>
          </button>
        </div>
      </div>

      <div className='overflow-x-auto' ref={tableRef}>
        <table className='min-w-full divide-y divide-gray-200'>
          {/* 💥 FIX: Removed whitespace between <thead> and <tr> */}
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
              {renderSortableHeader('aiScore', 'AI Score', 'bg-purple-50')}
              <th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                Status
              </th>
              <th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                Enriched Data
              </th>
              {/* NEW GHL STATUS HEADER */}
              <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-purple-50'>
                GHL Sync
              </th>
              {renderSortableHeader(
                'ownerLastName',
                'Owner Name',
                'bg-blue-50'
              )}
              <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-blue-50'>
                Address
              </th>
              <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-green-50'>
                Phone
              </th>
              {renderSortableHeader('skipTraceCompletedAt', 'Skip Traced', 'bg-green-50')}
              {renderSortableHeader('ownerCounty', 'County', 'bg-blue-50')}
              <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-blue-50'>
                City/State/Zip
              </th>
              {renderSortableHeader('zestimate', 'Zestimate', 'bg-yellow-50')}
              <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-yellow-50'>
                Status
              </th>
              <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-purple-50'>
                Admin Name
              </th>
              <th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-purple-50'>
                Admin Address
              </th>
              {renderSortableHeader('createdAt', 'Created At')}
            </tr>
          </thead>
          {/* 💥 FIX: Removed whitespace before and after <tbody> content */}
          <tbody className='bg-white divide-y divide-gray-200'>
            {isLoading ? (
              <tr>
                <td
                  colSpan={15}
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
                  colSpan={15}
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
                  onDoubleClick={() => onRowClick(lead.id)}
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

                  {/* AI Score Column */}
                  <td className='px-4 py-4 whitespace-nowrap text-sm bg-purple-50/30'>
                    {lead.aiScore !== null && lead.aiScore !== undefined ? (
                      <div className='flex items-center gap-2'>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          lead.aiPriority === 'HIGH' ? 'bg-red-100 text-red-800' :
                          lead.aiPriority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {lead.aiScore}
                        </span>
                        {lead.aiPriority === 'HIGH' && <span>🔥</span>}
                      </div>
                    ) : (
                      <span className='text-gray-400 text-xs'>-</span>
                    )}
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

                  {/* NEW GHL STATUS CELL */}
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

                  {/* Phone Column */}
                  <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-green-50/30'>
                    {lead.phones && lead.phones.length > 0 ? (
                      <div className='flex items-center gap-1'>
                        <span className='font-mono text-xs'>
                          {lead.phones[0]}
                        </span>
                        {lead.phones.length > 1 && (
                          <span
                            className='text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full font-bold cursor-help'
                            title={`${lead.phones.length} phone numbers total: ${lead.phones.join(', ')}`}
                          >
                            +{lead.phones.length - 1}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className='text-gray-400 text-xs'>No phone</span>
                    )}
                  </td>

                  {/* Skip Trace Date Column */}
                  <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-green-50/30'>
                    {lead.skipTraceCompletedAt ? (
                      <span className='text-xs font-mono'>
                        {new Date(lead.skipTraceCompletedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className='text-gray-400 text-xs'>-</span>
                    )}
                  </td>

                  {/* County Column */}
                  <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                    {lead.ownerCounty || '-'}
                  </td>

                  <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                    {lead.ownerCity}, {lead.ownerState} {lead.ownerZip}
                  </td>

                  {/* Zestimate Column */}
                  <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-yellow-50/30'>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        {lead.zestimate && typeof lead.zestimate === 'number' ? (
                          <>
                            <a 
                              href={
                                lead.zillowUrl || 
                                (lead.zillowZpid ? `https://www.zillow.com/homes/${lead.zillowZpid}_zpid/` : '#')
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className='font-semibold text-green-700 hover:text-green-900 hover:underline'
                            >
                              ${lead.zestimate.toLocaleString()}
                            </a>
                            {lead.zillowLastUpdated && (() => {
                              const ageInDays = Math.floor((Date.now() - new Date(lead.zillowLastUpdated).getTime()) / (1000 * 60 * 60 * 24));
                              const isStale = ageInDays > 180;
                              return (
                                <span className={`text-xs ${isStale ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                  {isStale && '⚠️ '}{ageInDays}d old
                                </span>
                              );
                            })()}
                          </>
                        ) : lead.estimatedValue && typeof lead.estimatedValue === 'number' ? (
                          <span className='text-gray-600'>
                            ${lead.estimatedValue.toLocaleString()}
                          </span>
                        ) : (
                          <span className='text-gray-400'>-</span>
                        )}
                      </div>
                      {(lead.latitude && lead.longitude) || (lead.ownerAddress && lead.ownerCity && lead.ownerState && lead.ownerZip) ? (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const res = await fetch('/api/v1/refresh-zestimate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  leadId: lead.id,
                                  street: lead.ownerAddress,
                                  city: lead.ownerCity,
                                  state: lead.ownerState,
                                  zip: lead.ownerZip,
                                  latitude: lead.latitude,
                                  longitude: lead.longitude,
                                }),
                              });
                              if (res.ok) {
                                window.location.reload();
                              }
                            } catch (err) {
                              console.error('Refresh failed:', err);
                            }
                          }}
                          className="text-gray-400 hover:text-green-600"
                          title="Refresh Zestimate"
                        >
                          ↻
                        </button>
                      ) : null}
                    </div>
                  </td>

                  {/* Manual Status Column */}
                  <td className='px-4 py-4 whitespace-nowrap text-xs bg-yellow-50/30'>
                    <select
                      value={lead.manualStatus || ''}
                      onChange={async (e) => {
                        const newStatus = e.target.value as 'ACTIVE' | 'SOLD' | 'PENDING' | 'OFF_MARKET' | 'SKIP' | 'DIRECT_MAIL' | '';
                        try {
                          const { client } = await import('@/app/utils/aws/data/frontEndClient');
                          await client.models.PropertyLead.update({
                            id: lead.id,
                            manualStatus: newStatus || null
                          });
                        } catch (err) {
                          console.error('Failed to update status:', err);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={`text-xs font-semibold px-2 py-1 rounded border-0 cursor-pointer ${
                        lead.manualStatus === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                        lead.manualStatus === 'SOLD' ? 'bg-red-100 text-red-800' :
                        lead.manualStatus === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        lead.manualStatus === 'OFF_MARKET' ? 'bg-gray-100 text-gray-800' :
                        lead.manualStatus === 'SKIP' ? 'bg-orange-100 text-orange-800' :
                        lead.manualStatus === 'DIRECT_MAIL' ? 'bg-blue-100 text-blue-800' :
                        'bg-white text-gray-500'
                      }`}
                    >
                      <option value="">-</option>
                      <option value="ACTIVE">Active</option>
                      <option value="SOLD">Sold</option>
                      <option value="PENDING">Pending</option>
                      <option value="OFF_MARKET">Off Market</option>
                      <option value="SKIP">Skip</option>
                      <option value="DIRECT_MAIL">Direct Mail</option>
                    </select>
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
