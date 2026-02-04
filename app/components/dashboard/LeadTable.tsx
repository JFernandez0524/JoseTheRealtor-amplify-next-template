// app/components/dashboard/LeadTable.tsx
/** @jsxImportSource react */

import React, { useState } from 'react';
import { StatusBadge } from '../shared/StatusBadge';
import { formatDate } from '@/app/utils/formatters';
import { updateLead } from '@/app/utils/aws/data/lead.client';
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
  onToggleAllFiltered: () => void;
  totalFilteredCount: number;
  onToggleOne: (id: string) => void;
  onRowClick: (id: string) => void;
  onRefresh?: () => Promise<void>;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
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
  onToggleAllFiltered,
  totalFilteredCount,
  onToggleOne,
  onRowClick,
  onRefresh,
  sortField,
  sortDirection,
  onSort,
}: Props) {
  const tableRef = React.useRef<HTMLDivElement>(null);
  const modalRef = React.useRef<HTMLDivElement>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    street: '',
    city: '',
    state: '',
    zip: '',
  });

  // Normalize address for comparison (handles abbreviations and variations)
  const normalizeAddress = (addr: string | undefined | null): string => {
    if (!addr) return '';
    return addr
      .toLowerCase()
      .trim()
      // Remove common prefixes
      .replace(/\b(city|town|borough|township|village)\s+of\s+/gi, '')
      // Normalize street suffixes
      .replace(/\bstreet\b/g, 'st')
      .replace(/\bavenue\b/g, 'ave')
      .replace(/\bboulevard\b/g, 'blvd')
      .replace(/\bdrive\b/g, 'dr')
      .replace(/\broad\b/g, 'rd')
      .replace(/\blane\b/g, 'ln')
      .replace(/\bcourt\b/g, 'ct')
      .replace(/\bcircle\b/g, 'cir')
      .replace(/\bplace\b/g, 'pl')
      .replace(/\bterrace\b/g, 'ter')
      .replace(/\bparkway\b/g, 'pkwy')
      // Normalize directions
      .replace(/\bnorth\b/g, 'n')
      .replace(/\bsouth\b/g, 's')
      .replace(/\beast\b/g, 'e')
      .replace(/\bwest\b/g, 'w')
      // Remove extra spaces
      .replace(/\s+/g, ' ')
      .trim();
  };

  const addressesMatch = (addr1: string | undefined | null, addr2: string | undefined | null): boolean => {
    return normalizeAddress(addr1) === normalizeAddress(addr2);
  };

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

  const handleEditAddress = (lead: Lead) => {
    setEditingLead(lead);
    setEditForm({
      street: lead.ownerAddress || '',
      city: lead.ownerCity || '',
      state: lead.ownerState || '',
      zip: lead.ownerZip || '',
    });
    setIsSaving(false); // Reset saving state when opening modal
  };

  const handleSaveAddress = async () => {
    if (!editingLead) return;
    
    setIsSaving(true);
    try {
      await updateLead(editingLead.id, {
        ownerAddress: editForm.street,
        ownerCity: editForm.city,
        ownerState: editForm.state,
        ownerZip: editForm.zip,
      });

      // Refresh Zestimate with new address
      const res = await fetch('/api/v1/refresh-zestimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: editingLead.id,
          street: editForm.street,
          city: editForm.city,
          state: editForm.state,
          zip: editForm.zip,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        console.error('Zestimate refresh failed:', error);
        alert(`Address updated but Zestimate refresh failed: ${error.error}`);
      }

      setEditingLead(null);
      if (onRefresh) {
        await onRefresh();
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to update address:', err);
      alert('Failed to update address');
    } finally {
      setIsSaving(false);
    }
  };

  const renderSortableHeader = (
    field: string,
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
      {/* Horizontal Scroll Controls - Sticky */}
      <div className='sticky top-0 z-10 flex justify-between items-center px-4 py-2 bg-gray-50 border-b border-gray-200'>
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

      <div className='overflow-x-auto relative' ref={tableRef}>
        <table className='min-w-full divide-y divide-gray-200'>
          {/* 💥 FIX: Removed whitespace between <thead> and <tr> */}
          <thead className='bg-gray-50'>
            <tr>
              <th scope='col' className='px-4 py-3 text-left w-10 sticky left-0 bg-gray-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]'>
                <div className="flex flex-col gap-1">
                  <input
                    type='checkbox'
                    className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4'
                    checked={
                      leads.length > 0 && selectedIds.length === leads.length
                    }
                    onChange={onToggleAll}
                    title="Select visible leads on this page"
                  />
                  {totalFilteredCount > leads.length && (
                    <button
                      onClick={onToggleAllFiltered}
                      className="text-[9px] text-blue-600 hover:text-blue-800 whitespace-nowrap"
                      title={`Select all ${totalFilteredCount} filtered leads`}
                    >
                      All {totalFilteredCount}
                    </button>
                  )}
                </div>
              </th>
              {renderSortableHeader('type', 'Type')}
              {renderSortableHeader('aiScore', 'AI Score', 'bg-purple-50')}
              {renderSortableHeader('skipTraceStatus', 'Status')}
              {/* NEW GHL STATUS HEADER */}
              {renderSortableHeader('ghlSyncStatus', 'GHL Sync', 'bg-purple-50')}
              {renderSortableHeader(
                'ownerLastName',
                'Owner Name',
                'bg-blue-50'
              )}
              {renderSortableHeader('ownerAddress', 'Address', 'bg-blue-50')}
              {renderSortableHeader('ownerCity', 'City/State/Zip', 'bg-blue-50')}
              {renderSortableHeader('ownerCounty', 'County', 'bg-blue-50')}
              {renderSortableHeader('zestimate', 'Zestimate', 'bg-yellow-50')}
              {renderSortableHeader('manualStatus', 'Status', 'bg-yellow-50')}
              {renderSortableHeader('adminLastName', 'Admin Name', 'bg-purple-50')}
              {renderSortableHeader('adminAddress', 'Admin Address', 'bg-purple-50')}
              {renderSortableHeader('phones', 'Phone', 'bg-green-50')}
              {renderSortableHeader('emails', 'Email', 'bg-green-50')}
              {renderSortableHeader('skipTraceCompletedAt', 'Skip Traced', 'bg-green-50')}
              {renderSortableHeader('enrichmentData', 'Enriched Data')}
              {renderSortableHeader('createdAt', 'Created At')}
            </tr>
          </thead>
          {/* 💥 FIX: Removed whitespace before and after <tbody> content */}
          <tbody className='bg-white divide-y divide-gray-200'>
            {isLoading ? (
              <tr>
                <td
                  colSpan={16}
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
                  colSpan={16}
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
                  <td className='px-4 py-4 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]'>
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
                    <div className='flex items-center gap-2'>
                      <StatusBadge status={lead.skipTraceStatus} />
                      {lead.leadLabels?.includes('DIRECT_MAIL_ONLY') && (
                        <span className='px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 font-medium'>
                          📬 Mail Only
                        </span>
                      )}
                    </div>
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
                      <span className='select-text'>{lead.ownerAddress}</span>
                      {lead.validationStatus === 'INVALID' && (
                        <span
                          className='text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold'
                          title='Invalid Address'
                        >
                          ⚠️
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditAddress(lead);
                        }}
                        className='text-gray-400 hover:text-blue-600 select-none'
                        title='Edit address'
                      >
                        ✏️
                      </button>
                    </div>
                  </td>

                  <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                    {lead.ownerCity}, {lead.ownerState} {lead.ownerZip}
                  </td>

                  {/* County Column */}
                  <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-blue-50/30'>
                    {lead.ownerCounty || '-'}
                  </td>

                  {/* Zestimate Column */}
                  <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-yellow-50/30'>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        {lead.zestimate && typeof lead.zestimate === 'number' ? (
                          <>
                            <div className="flex items-center gap-1">
                              <a 
                                href={
                                  lead.zillowUrl || 
                                  (lead.zillowZpid ? `https://www.zillow.com/homes/${lead.zillowZpid}_zpid/` : '#')
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className='font-semibold text-green-700 hover:text-green-900 hover:underline relative group'
                              >
                                ${lead.zestimate.toLocaleString()}
                                <span className='invisible group-hover:visible absolute left-0 top-full mt-1 w-64 bg-gray-900 text-white text-xs rounded p-2 z-50 whitespace-normal'>
                                  {lead.zillowAddress && !addressesMatch(lead.zillowAddress, lead.ownerAddress)
                                    ? `⚠️ ADDRESS MISMATCH: Zillow shows "${lead.zillowAddress}" but lead is "${lead.ownerAddress}". Click to verify, then use edit button (✏️) to fix.`
                                    : 'Click to view property on Zillow'
                                  }
                                </span>
                              </a>
                              {lead.zillowAddress && !addressesMatch(lead.zillowAddress, lead.ownerAddress) && (
                                <span className="text-red-600 text-xs font-bold" title={`Zillow address: ${lead.zillowAddress}`}>⚠️</span>
                              )}
                            </div>
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
                            const button = e.currentTarget;
                            button.disabled = true;
                            button.textContent = '⏳';
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
                              const data = await res.json();
                              if (res.ok) {
                                button.textContent = '✓';
                                button.className = 'text-green-600 font-bold';
                                // Wait a bit longer for database to update
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                if (onRefresh) {
                                  await onRefresh();
                                }
                                button.textContent = '↻';
                                button.className = 'text-gray-400 hover:text-green-600';
                                button.disabled = false;
                              } else {
                                button.textContent = '↻';
                                button.disabled = false;
                                alert(`Refresh failed: ${data.error}`);
                              }
                            } catch (err: any) {
                              button.textContent = '↻';
                              button.disabled = false;
                              console.error('Refresh failed:', err);
                              alert(`Refresh failed: ${err.message}`);
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
                          await updateLead(lead.id, {
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

                  {/* Email Column */}
                  <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-green-50/30'>
                    {lead.emails && lead.emails.length > 0 ? (
                      <div className='flex items-center gap-1'>
                        <span className='text-xs truncate max-w-[150px]' title={lead.emails[0] ?? undefined}>
                          {lead.emails[0]}
                        </span>
                        {lead.emails.length > 1 && (
                          <span
                            className='text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full font-bold cursor-help'
                            title={`${lead.emails.length} emails total: ${lead.emails.filter(e => e).join(', ')}`}
                          >
                            +{lead.emails.length - 1}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className='text-gray-400 text-xs'>No email</span>
                    )}
                  </td>

                  {/* Skip Trace Date Column */}
                  <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900 bg-green-50/30'>
                    {(() => {
                      // Try skipTraceCompletedAt first
                      if (lead.skipTraceCompletedAt) {
                        return (
                          <span className='text-xs font-mono'>
                            {new Date(lead.skipTraceCompletedAt).toLocaleDateString()}
                          </span>
                        );
                      }
                      
                      // Fallback: get last attempt from history
                      if (lead.skipTraceHistory) {
                        const history = typeof lead.skipTraceHistory === 'string' 
                          ? JSON.parse(lead.skipTraceHistory) 
                          : lead.skipTraceHistory;
                        if (history && history.length > 0) {
                          const lastAttempt = history[history.length - 1];
                          return (
                            <span className='text-xs font-mono text-yellow-600'>
                              {new Date(lastAttempt.timestamp).toLocaleDateString()}
                            </span>
                          );
                        }
                      }
                      
                      return <span className='text-gray-400 text-xs'>-</span>;
                    })()}
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

                  <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {formatDate(lead.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Address Edit Modal */}
      {editingLead && (
        <div 
          className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50' 
          onClick={(e) => {
            // Only close if clicking the backdrop, not the modal content
            if (e.target === e.currentTarget) {
              setEditingLead(null);
              setIsSaving(false);
            }
          }}
        >
          <div ref={modalRef} className='bg-white rounded-lg p-6 max-w-md w-full'>
            <h3 className='text-lg font-bold mb-4'>Edit Address</h3>
            <div className='space-y-3'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Street Address</label>
                <input
                  type='text'
                  value={editForm.street}
                  onChange={(e) => setEditForm({ ...editForm, street: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>City</label>
                <input
                  type='text'
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md'
                />
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>State</label>
                  <input
                    type='text'
                    value={editForm.state}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>ZIP</label>
                  <input
                    type='text'
                    value={editForm.zip}
                    onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md'
                  />
                </div>
              </div>
            </div>
            <div className='flex gap-3 mt-6'>
              <button
                onClick={handleSaveAddress}
                disabled={isSaving}
                className='flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Updating...
                  </>
                ) : (
                  'Save & Refresh Zestimate'
                )}
              </button>
              <button
                onClick={() => { setEditingLead(null); setIsSaving(false); }}
                disabled={isSaving}
                className='px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
