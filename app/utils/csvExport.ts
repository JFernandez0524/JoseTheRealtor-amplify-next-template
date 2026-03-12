/**
 * Generate CSV comparison report for duplicate leads
 */
export function generateDuplicateComparisonCSV(duplicateLeads: any[]): string {
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

  const rows = duplicateLeads.map((dup) => [
    dup.csvData.ownerName || '',
    dup.csvData.address || '',
    dup.csvData.city || '',
    dup.csvData.state || '',
    dup.csvData.zip || '',
    dup.existingLeadData.ownerName || '',
    dup.existingLeadData.address || '',
    dup.existingLeadData.zestimate ? `$${dup.existingLeadData.zestimate.toLocaleString()}` : '',
    dup.existingLeadId || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
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
