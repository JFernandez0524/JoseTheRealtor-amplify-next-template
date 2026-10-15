'use client';

import React, { useState, useMemo } from 'react';
import {
  HiX,
  HiCheck,
  HiFilter,
  HiSearch,
  HiInformationCircle,
  HiShieldCheck,
  HiExclamationCircle,
} from 'react-icons/hi';
import {
  type OwnershipCategory,
  type OwnershipClassification,
} from '@/amplify/functions/shared/ownershipClassifier';
import {
  type ForeclosureCategory,
  type ForeclosureClassification,
  classifyForeclosure,
} from '@/amplify/functions/shared/foreclosureClassifier';
import { resolveOwnerNameWithClassification } from '@/app/utils/csvMapping';

export interface ClassifiedPreviewRow {
  index: number;
  rawRow: Record<string, any>;
  addressDisplay: string;
  cityDisplay: string;
  stateDisplay: string;
  zipDisplay: string;
  countyDisplay: string;
  parcelIdDisplay: string;
  ownerDisplayName: string;
  ownership: OwnershipClassification;
  foreclosure: ForeclosureClassification;
  caseNumber: string;
  lender: string;
  amount: string;
  selected: boolean;
}

interface ImportPreviewModalProps {
  isOpen: boolean;
  fileName: string;
  leadType: string;
  rawRows: Record<string, any>[];
  columnMapping: Record<string, string>;
  onClose: () => void;
  onConfirmImport: (selectedRows: Record<string, any>[]) => void;
  isImporting: boolean;
}

export function ImportPreviewModal({
  isOpen,
  fileName,
  leadType,
  rawRows,
  columnMapping,
  onClose,
  onConfirmImport,
  isImporting,
}: ImportPreviewModalProps) {
  // Pre-classify all rows based on column mapping
  const initialClassifiedRows = useMemo(() => {
    return rawRows.map((row, index): ClassifiedPreviewRow => {
      const cell = (canonicalKey: string): string => {
        const mapped = columnMapping[canonicalKey];
        if (mapped && row[mapped] != null) return String(row[mapped]).trim();
        return '';
      };

      const rawDefendant = cell('ownerFullName') || cell('borrowerName') || '';
      const rawFirst = cell('ownerFirstName');
      const rawLast = cell('ownerLastName');
      const ownerResolved = resolveOwnerNameWithClassification({
        full: rawDefendant,
        first: rawFirst,
        last: rawLast,
      });

      const rawCase = cell('caseNumber');
      const rawLender = cell('lender');
      const rawTrustee = cell('trustee');
      const rawAmount = cell('loanAmount');

      const foreclosureClass = classifyForeclosure({
        caseNumber: rawCase,
        plaintiff: rawLender,
        trustee: rawTrustee,
        loanAmount: rawAmount,
      });

      const address = cell('ownerAddress');
      const city = cell('ownerCity');
      const state = cell('ownerState');
      const zip = cell('ownerZip');
      const county = cell('ownerCounty');
      const parcelId = cell('parcelId');

      const ownerDisplayName =
        `${ownerResolved.firstName || ''} ${ownerResolved.lastName || ''}`.trim() ||
        rawDefendant ||
        'Unknown';

      // Default selection: select individuals, multiple individuals, estates, and trusts by default
      const defaultSelected = [
        'INDIVIDUAL',
        'MULTIPLE_INDIVIDUALS',
        'ESTATE',
        'TRUST',
      ].includes(ownerResolved.classification.category);

      return {
        index,
        rawRow: row,
        addressDisplay: address || 'No Address',
        cityDisplay: city,
        stateDisplay: state,
        zipDisplay: zip,
        countyDisplay: county,
        parcelIdDisplay: parcelId,
        ownerDisplayName,
        ownership: ownerResolved.classification,
        foreclosure: foreclosureClass,
        caseNumber: rawCase,
        lender: rawLender,
        amount: rawAmount,
        selected: defaultSelected,
      };
    });
  }, [rawRows, columnMapping]);

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => {
    const s = new Set<number>();
    initialClassifiedRows.forEach((r) => {
      if (r.selected) s.add(r.index);
    });
    return s;
  });

  const [ownershipFilter, setOwnershipFilter] = useState<string>('ALL');
  const [foreclosureFilter, setForeclosureFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Counts for badges
  const stats = useMemo(() => {
    const ownershipCounts: Record<string, number> = {};
    const foreclosureCounts: Record<string, number> = {};

    initialClassifiedRows.forEach((r) => {
      const oc = r.ownership.category;
      ownershipCounts[oc] = (ownershipCounts[oc] || 0) + 1;

      const fc = r.foreclosure.category;
      foreclosureCounts[fc] = (foreclosureCounts[fc] || 0) + 1;
    });

    return { ownershipCounts, foreclosureCounts };
  }, [initialClassifiedRows]);

  // Filtered rows for the table view
  const visibleRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return initialClassifiedRows.filter((r) => {
      if (ownershipFilter !== 'ALL' && r.ownership.category !== ownershipFilter) {
        return false;
      }
      if (foreclosureFilter !== 'ALL' && r.foreclosure.category !== foreclosureFilter) {
        return false;
      }
      if (q) {
        const matchesAddress = r.addressDisplay.toLowerCase().includes(q);
        const matchesCity = r.cityDisplay.toLowerCase().includes(q);
        const matchesOwner = r.ownerDisplayName.toLowerCase().includes(q);
        const matchesCase = r.caseNumber.toLowerCase().includes(q);
        const matchesLender = r.lender.toLowerCase().includes(q);
        if (!matchesAddress && !matchesCity && !matchesOwner && !matchesCase && !matchesLender) {
          return false;
        }
      }
      return true;
    });
  }, [initialClassifiedRows, ownershipFilter, foreclosureFilter, searchQuery]);

  if (!isOpen) return null;

  const toggleSelectRow = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      visibleRows.forEach((r) => next.add(r.index));
      return next;
    });
  };

  const handleDeselectAllVisible = () => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      visibleRows.forEach((r) => next.delete(r.index));
      return next;
    });
  };

  const handleApplyJosePreset = () => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      initialClassifiedRows.forEach((r) => {
        if (
          r.ownership.category === 'INDIVIDUAL' ||
          r.ownership.category === 'MULTIPLE_INDIVIDUALS' ||
          r.ownership.category === 'ESTATE' ||
          r.ownership.category === 'TRUST'
        ) {
          next.add(r.index);
        } else {
          next.delete(r.index);
        }
      });
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedRawRows = initialClassifiedRows
      .filter((r) => selectedIndices.has(r.index))
      .map((r) => r.rawRow);
    onConfirmImport(selectedRawRows);
  };

  const getOwnershipBadge = (cat: OwnershipCategory) => {
    switch (cat) {
      case 'INDIVIDUAL':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'MULTIPLE_INDIVIDUALS':
        return 'bg-teal-100 text-teal-800 border-teal-300';
      case 'ESTATE':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'TRUST':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'LLC':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'CORPORATION':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'INSTITUTIONAL':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'OTHER_ENTITY':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getForeclosureBadge = (cat: ForeclosureCategory) => {
    switch (cat) {
      case 'MORTGAGE_FORECLOSURE':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'TAX_FORECLOSURE':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'OTHER_FORECLOSURE':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
      <div className='flex h-[92vh] w-full max-w-6xl flex-col rounded-xl bg-white shadow-2xl overflow-hidden'>
        {/* Header */}
        <div className='flex items-center justify-between border-b border-gray-200 bg-slate-50 px-6 py-4'>
          <div>
            <div className='flex items-center gap-3'>
              <h2 className='text-xl font-bold text-gray-900'>
                Lead Import Preview & Classification
              </h2>
              <span className='rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-800'>
                {leadType}
              </span>
            </div>
            <p className='mt-1 text-sm text-gray-500'>
              File: <span className='font-medium text-gray-700'>{fileName}</span> •{' '}
              <span className='font-semibold text-emerald-600'>
                {selectedIndices.size} of {initialClassifiedRows.length} selected for import
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className='rounded-lg p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-700'
          >
            <HiX className='h-6 w-6' />
          </button>
        </div>

        {/* Filters and Controls */}
        <div className='space-y-3 border-b border-gray-200 bg-white p-4'>
          {/* Preset Buttons & Search */}
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-xs font-semibold uppercase tracking-wider text-gray-400'>
                Quick Select:
              </span>
              <button
                type='button'
                onClick={handleApplyJosePreset}
                className='rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors'
              >
                ★ Individuals & Estates (Recommended)
              </button>
              <button
                type='button'
                onClick={handleSelectAllVisible}
                className='rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50'
              >
                Select All
              </button>
              <button
                type='button'
                onClick={handleDeselectAllVisible}
                className='rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50'
              >
                Deselect All
              </button>
            </div>

            {/* Search */}
            <div className='relative w-full max-w-xs'>
              <HiSearch className='absolute left-3 top-2.5 h-4 w-4 text-gray-400' />
              <input
                type='text'
                placeholder='Search owner, address, docket...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='w-full rounded-md border border-gray-300 py-1.5 pl-9 pr-3 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
              />
            </div>
          </div>

          {/* Category Chips */}
          <div className='flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100'>
            <span className='text-xs font-semibold uppercase tracking-wider text-gray-400'>
              Ownership:
            </span>
            <button
              onClick={() => setOwnershipFilter('ALL')}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                ownershipFilter === 'ALL'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({initialClassifiedRows.length})
            </button>
            {Object.entries(stats.ownershipCounts).map(([cat, count]) => (
              <button
                key={cat}
                onClick={() => setOwnershipFilter(cat)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                  ownershipFilter === cat
                    ? 'ring-2 ring-blue-500 font-bold ' + getOwnershipBadge(cat as OwnershipCategory)
                    : getOwnershipBadge(cat as OwnershipCategory)
                }`}
              >
                {cat.replace('_', ' ')} ({count})
              </button>
            ))}
          </div>

          {leadType === 'PREFORECLOSURE' && (
            <div className='flex flex-wrap items-center gap-2 pt-1'>
              <span className='text-xs font-semibold uppercase tracking-wider text-gray-400'>
                Foreclosure:
              </span>
              <button
                onClick={() => setForeclosureFilter('ALL')}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  foreclosureFilter === 'ALL'
                    ? 'bg-slate-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {Object.entries(stats.foreclosureCounts).map(([cat, count]) => (
                <button
                  key={cat}
                  onClick={() => setForeclosureFilter(cat)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                    foreclosureFilter === cat
                      ? 'ring-2 ring-slate-600 font-bold ' + getForeclosureBadge(cat as ForeclosureCategory)
                      : getForeclosureBadge(cat as ForeclosureCategory)
                  }`}
                >
                  {cat.replace('_FORECLOSURE', '')} ({count})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Table View */}
        <div className='flex-1 overflow-auto bg-gray-50'>
          <table className='w-full border-collapse text-left text-xs'>
            <thead className='sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm'>
              <tr className='text-gray-500'>
                <th className='w-12 px-4 py-3 text-center'>
                  <input
                    type='checkbox'
                    checked={
                      visibleRows.length > 0 &&
                      visibleRows.every((r) => selectedIndices.has(r.index))
                    }
                    onChange={(e) => {
                      if (e.target.checked) handleSelectAllVisible();
                      else handleDeselectAllVisible();
                    }}
                    className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                  />
                </th>
                <th className='px-4 py-3 font-semibold'>Property Address</th>
                <th className='px-4 py-3 font-semibold'>Defendant / Borrower</th>
                <th className='px-4 py-3 font-semibold'>Ownership Type</th>
                {leadType === 'PREFORECLOSURE' && (
                  <>
                    <th className='px-4 py-3 font-semibold'>Foreclosure Type</th>
                    <th className='px-4 py-3 font-semibold'>Plaintiff / Lender</th>
                    <th className='px-4 py-3 font-semibold'>Docket / Loan</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-200 bg-white'>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className='py-12 text-center text-gray-400'>
                    No records match your active filters.
                  </td>
                </tr>
              ) : (
                visibleRows.map((r) => {
                  const isSelected = selectedIndices.has(r.index);
                  return (
                    <tr
                      key={r.index}
                      className={`hover:bg-blue-50/50 transition-colors ${
                        isSelected ? 'bg-white' : 'bg-gray-50/70 opacity-60'
                      }`}
                    >
                      <td className='px-4 py-3 text-center'>
                        <input
                          type='checkbox'
                          checked={isSelected}
                          onChange={() => toggleSelectRow(r.index)}
                          className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                        />
                      </td>
                      <td className='px-4 py-3'>
                        <div className='font-semibold text-gray-900'>{r.addressDisplay}</div>
                        <div className='text-gray-500'>
                          {r.cityDisplay}, {r.stateDisplay} {r.zipDisplay}
                          {r.parcelIdDisplay ? ` • Parcel: ${r.parcelIdDisplay}` : ''}
                        </div>
                      </td>
                      <td className='px-4 py-3'>
                        <div className='font-medium text-gray-900'>{r.ownerDisplayName}</div>
                        {r.ownership.rawName !== r.ownerDisplayName && (
                          <div className='text-[10px] text-gray-400'>
                            Raw: {r.ownership.rawName}
                          </div>
                        )}
                      </td>
                      <td className='px-4 py-3'>
                        <span
                          title={r.ownership.evidence.join('; ')}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${getOwnershipBadge(
                            r.ownership.category
                          )}`}
                        >
                          {r.ownership.category.replace('_', ' ')}
                          {r.ownership.requiresManualReview && (
                            <HiExclamationCircle className='h-3 w-3 text-amber-500' />
                          )}
                        </span>
                      </td>
                      {leadType === 'PREFORECLOSURE' && (
                        <>
                          <td className='px-4 py-3'>
                            <span
                              title={r.foreclosure.evidence.join('; ')}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${getForeclosureBadge(
                                r.foreclosure.category
                              )}`}
                            >
                              {r.foreclosure.category.replace('_FORECLOSURE', '')}
                            </span>
                          </td>
                          <td className='px-4 py-3'>
                            <div className='max-w-[180px] truncate font-medium text-gray-800' title={r.lender}>
                              {r.lender || '—'}
                            </div>
                          </td>
                          <td className='px-4 py-3'>
                            <div className='font-mono text-gray-700'>{r.caseNumber || '—'}</div>
                            <div className='text-gray-500 font-semibold'>{r.amount || ''}</div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className='flex items-center justify-between border-t border-gray-200 bg-slate-50 px-6 py-4'>
          <div className='text-xs text-gray-500'>
            Showing <span className='font-semibold text-gray-700'>{visibleRows.length}</span> of{' '}
            <span className='font-semibold text-gray-700'>{initialClassifiedRows.length}</span> records
          </div>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={onClose}
              disabled={isImporting}
              className='rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={handleConfirm}
              disabled={isImporting || selectedIndices.size === 0}
              className='flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors'
            >
              {isImporting ? (
                <>
                  <div className='h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent' />
                  Importing...
                </>
              ) : (
                <>
                  <HiCheck className='h-4 w-4' />
                  Import Selected ({selectedIndices.size} Leads)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
