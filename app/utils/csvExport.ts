/**
 * One entry in a CsvUploadJob's `duplicateLeads` array, as written by uploadCsvHandler.
 * `existingLeadId` and `existingLeadData` are nullable: a row duplicated *within* the uploaded
 * file has no pre-existing lead to point at, and jobs written before existingLeadData was
 * populated carry `null` there.
 */
export type DuplicateLeadEntry = {
  csvData?: {
    ownerName?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  } | null;
  existingLeadId?: string | null;
  existingLeadData?: {
    ownerName?: string | null;
    address?: string | null;
    zestimate?: number | null;
  } | null;
};

/** Escape a value for RFC 4180 CSV: wrap in quotes and double any embedded quote. */
function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/**
 * Generate a CSV comparison report for the duplicate rows of a CSV upload — one line per
 * duplicate, pairing the incoming CSV values against the existing lead they collided with.
 *
 * Called by the duplicate report download in `UploadProgressModal` and the upload history view.
 * Every field is optional-chained: historical jobs have `existingLeadData: null`, and intra-file
 * duplicates have no `existingLeadId`, so those columns come back empty rather than throwing.
 */
export function generateDuplicateComparisonCSV(
  duplicateLeads: (DuplicateLeadEntry | null | undefined)[]
): string {
  const headers = [
    'CSV Owner Name',
    'CSV Address',
    'CSV City',
    'CSV State',
    'CSV Zip',
    'Existing Owner Name',
    'Existing Address',
    'Existing Zestimate',
    'Existing Lead ID',
  ];

  const rows = (duplicateLeads ?? []).filter(Boolean).map((dup) => {
    const zestimate = dup?.existingLeadData?.zestimate;
    return [
      dup?.csvData?.ownerName || '',
      dup?.csvData?.address || '',
      dup?.csvData?.city || '',
      dup?.csvData?.state || '',
      dup?.csvData?.zip || '',
      dup?.existingLeadData?.ownerName || '',
      dup?.existingLeadData?.address || '',
      typeof zestimate === 'number' ? `$${zestimate.toLocaleString()}` : '',
      dup?.existingLeadId || '',
    ];
  });

  return [headers.join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
