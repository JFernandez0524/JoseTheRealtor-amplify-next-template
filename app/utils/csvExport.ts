// app/utils/csvExport.ts
import { type Schema } from '@/amplify/data/resource';

type Lead = Schema['PropertyLead']['type'];

export const downloadLeadsAsCsv = (
  leads: Lead[],
  filename = 'leads_export.csv'
) => {
  if (!leads || leads.length === 0) {
    alert('No leads to export.');
    return;
  }

  // 1. Define Headers (Mojo/GHL friendly)
  const headers = [
    'First Name',
    'Last Name',
    'Mailing Address',
    'Mailing City',
    'Mailing State',
    'Mailing Zip',
    'Property Address',
    'Property City',
    'Property State',
    'Property Zip',
    'Phone 1',
    'Phone 2',
    'Phone 3',
    'Email 1',
    'Email 2',
    'Lead Type',
    'Status',
    'Tags',
  ];

  // 2. Convert Data to CSV Rows
  const csvRows = leads.map((lead) => {
    // Flatten Phones (Take top 3)
    const p1 = lead.phones?.[0] || '';
    const p2 = lead.phones?.[1] || '';
    const p3 = lead.phones?.[2] || '';

    // Flatten Emails (Take top 2)
    const e1 = lead.emails?.[0] || '';
    const e2 = lead.emails?.[1] || '';

    // Helper to sanitize strings (remove commas to prevent CSV breakage)
    const clean = (str?: string | null) =>
      (str || '').replace(/,/g, ' ').trim();

    return [
      clean(lead.ownerFirstName),
      clean(lead.ownerLastName),
      // 🟢 CRITICAL: Export the calculated mailing address we built
      clean(lead.mailingAddress),
      clean(lead.mailingCity),
      clean(lead.mailingState),
      clean(lead.mailingZip),
      clean(lead.ownerAddress),
      clean(lead.ownerCity),
      clean(lead.ownerState),
      clean(lead.ownerZip),
      p1,
      p2,
      p3,
      e1,
      e2,
      clean(lead.type),
      clean(lead.skipTraceStatus),
      `Imported ${new Date().toLocaleDateString()}`,
    ].join(',');
  });

  // 3. Construct File
  const csvContent = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  // 4. Trigger Download
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
