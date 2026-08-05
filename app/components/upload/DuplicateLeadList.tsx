'use client';

import {
  generateDuplicateComparisonCSV,
  downloadCSV,
  type DuplicateLeadEntry,
} from '@/app/utils/csvExport';

interface DuplicateLeadListProps {
  /** A CsvUploadJob's `duplicateLeads` array. Entries may be null on older jobs. */
  duplicateLeads: (DuplicateLeadEntry | null | undefined)[] | null | undefined;
  /** Used to name the downloaded file, e.g. `duplicate-leads-<fileName>.csv`. */
  fileName?: string | null;
  /** Tailwind max-height for the scroll area. Defaults to a modal-friendly height. */
  maxHeightClass?: string;
}

/**
 * Renders the duplicate rows of a CSV upload — the incoming CSV values plus a link to the existing
 * lead each one collided with — with a button to download the full comparison report.
 *
 * Shared by `UploadProgressModal` (live upload) and the upload history view (`/uploads`), so the
 * two can't drift. Every field is optional-chained: intra-file duplicates have no
 * `existingLeadId`, and jobs written before `existingLeadData` was populated carry null there.
 */
export function DuplicateLeadList({
  duplicateLeads,
  fileName,
  maxHeightClass = 'max-h-[200px]',
}: DuplicateLeadListProps) {
  const entries = (duplicateLeads ?? []).filter(Boolean) as DuplicateLeadEntry[];
  if (entries.length === 0) return null;

  const handleDownload = () => {
    const csvContent = generateDuplicateComparisonCSV(entries);
    // Prefer the source filename so a user with several uploads can tell the reports apart;
    // fall back to the date when the job record has no fileName.
    const stem = fileName?.replace(/\.csv$/i, '') || new Date().toISOString().split('T')[0];
    downloadCSV(csvContent, `duplicate-leads-${stem}.csv`);
  };

  return (
    <div className="border-t pt-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold text-gray-700">
          Duplicate Leads ({entries.length})
        </h3>
        <button
          onClick={handleDownload}
          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
        >
          Download Report
        </button>
      </div>
      <div className={`${maxHeightClass} overflow-y-auto border rounded-lg bg-gray-50 p-3 space-y-2`}>
        {entries.map((dup, idx) => (
          <div key={dup?.existingLeadId ?? idx} className="text-xs bg-white p-2 rounded border">
            <div className="font-medium text-gray-900">
              {dup?.csvData?.ownerName || dup?.existingLeadData?.ownerName || '(Owner name not specified)'}
            </div>
            <div className="text-gray-600">
              {[dup?.csvData?.address, dup?.csvData?.city, dup?.csvData?.state]
                .filter(Boolean)
                .join(', ')}{' '}
              {dup?.csvData?.zip}
            </div>
            {dup?.existingLeadId ? (
              <a
                href={`/lead-details/${dup.existingLeadId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                → View Existing Lead
              </a>
            ) : (
              // No existing lead to link to: this address appeared more than once inside the
              // uploaded file itself, so the first occurrence was imported and this one rejected.
              <span className="text-gray-500 italic">Duplicated within this file</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
