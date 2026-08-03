import { NextResponse } from 'next/server';
import { AuthGetCurrentUserServer, cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

/**
 * Escapes a cell value for standard CSV formatting.
 */
function escapeCsvCell(cell: any): string {
  if (cell === null || cell === undefined) return '';
  const str = Array.isArray(cell)
    ? cell.join('; ')
    : typeof cell === 'object'
    ? JSON.stringify(cell)
    : String(cell);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /api/v1/account/export
 *
 * Export 100% of user account data, property leads, contacts, door knock queues,
 * outreach queues, job histories, and notifications in standard CSV format (.csv).
 */
export async function GET() {
  try {
    const currentUser = await AuthGetCurrentUserServer();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = currentUser.userId;

    // Fetch user-owned data across ALL models concurrently
    const [
      userAccountRes,
      leadsRes,
      contactsRes,
      doorKnockRes,
      outreachQueueRes,
      ghlIntegrationRes,
      batchJobsRes,
      csvJobsRes,
      notificationsRes,
    ] = await Promise.all([
      cookiesClient.models.UserAccount.list({ filter: { owner: { eq: userId } } }),
      cookiesClient.models.PropertyLead.list({ filter: { owner: { eq: userId } } }),
      cookiesClient.models.Contact.list({ filter: { owner: { eq: userId } } }),
      cookiesClient.models.DoorKnockQueue.list({ filter: { userId: { eq: userId } } }),
      cookiesClient.models.OutreachQueue.list({ filter: { userId: { eq: userId } } }),
      cookiesClient.models.GhlIntegration.list({ filter: { userId: { eq: userId } } }),
      cookiesClient.models.BatchDataJob.list({ filter: { userId: { eq: userId } } }),
      cookiesClient.models.CsvUploadJob.list({ filter: { userId: { eq: userId } } }),
      cookiesClient.models.Notification.list({ filter: { owner: { eq: userId } } }),
    ]);

    const leads = leadsRes.data || [];
    const contacts = contactsRes.data || [];
    const doorKnocks = doorKnockRes.data || [];
    const outreachItems = outreachQueueRes.data || [];
    const accounts = userAccountRes.data || [];
    const integrations = ghlIntegrationRes.data || [];
    const batchJobs = batchJobsRes.data || [];
    const csvJobs = csvJobsRes.data || [];
    const notifications = notificationsRes.data || [];

    const csvLines: string[] = [];

    // --- SECTION 1: PROPERTY LEADS ---
    csvLines.push('=== PROPERTY LEADS ===');
    const leadHeaders = [
      'Lead ID',
      'Lead Type',
      'Owner First Name',
      'Owner Last Name',
      'Owner Property Address',
      'Owner City',
      'Owner State',
      'Owner Zip',
      'Owner County',
      'Admin First Name',
      'Admin Last Name',
      'Admin Address',
      'Admin City',
      'Admin State',
      'Admin Zip',
      'Mailing Address',
      'Mailing City',
      'Mailing State',
      'Mailing Zip',
      'Absentee Owner',
      'Phones (SMS)',
      'Landline Phones',
      'Emails',
      'Estimated Value',
      'Zestimate',
      'Estimated Equity',
      'Mortgage Balance',
      'Skip Trace Status',
      'GHL Sync Status',
      'GHL Contact ID',
      'Listing Status',
      'Upload Source',
      'Foreclosure Status',
      'Foreclosure Auction Date',
      'Foreclosure Amount',
      'Foreclosure Unpaid Balance',
      'Foreclosure Case Number',
      'Foreclosure Lender',
      'AI Score',
      'AI Priority',
      'Created At',
    ];
    csvLines.push(leadHeaders.map(escapeCsvCell).join(','));

    for (const lead of leads) {
      const row = [
        lead.id,
        lead.type,
        lead.ownerFirstName,
        lead.ownerLastName,
        lead.ownerAddress,
        lead.ownerCity,
        lead.ownerState,
        lead.ownerZip,
        lead.ownerCounty,
        lead.adminFirstName,
        lead.adminLastName,
        lead.adminAddress,
        lead.adminCity,
        lead.adminState,
        lead.adminZip,
        lead.mailingAddress,
        lead.mailingCity,
        lead.mailingState,
        lead.mailingZip,
        lead.isAbsenteeOwner ? 'Yes' : 'No',
        lead.phones,
        lead.landlinePhones,
        lead.emails,
        lead.estimatedValue,
        lead.zestimate,
        lead.estimatedEquity,
        lead.mortgageBalance,
        lead.skipTraceStatus,
        lead.ghlSyncStatus,
        lead.ghlContactId,
        lead.listingStatus,
        lead.uploadSource,
        lead.foreclosureStatus,
        lead.foreclosureAuctionDate,
        lead.foreclosureAmount,
        lead.foreclosureUnpaidBalance,
        lead.foreclosureCaseNumber,
        lead.foreclosureLenderName,
        lead.aiScore,
        lead.aiPriority,
        lead.createdAt,
      ];
      csvLines.push(row.map(escapeCsvCell).join(','));
    }

    csvLines.push('');

    // --- SECTION 2: CONTACTS ---
    csvLines.push('=== CONTACTS ===');
    const contactHeaders = ['Contact ID', 'Lead ID', 'First Name', 'Last Name', 'Middle Name', 'Phones', 'Emails', 'Addresses', 'Litigator', 'Deceased', 'Created At'];
    csvLines.push(contactHeaders.map(escapeCsvCell).join(','));

    for (const c of contacts) {
      const row = [c.id, c.leadId, c.firstName, c.lastName, c.middleName, c.phones, c.emails, c.addresses, c.litigator ? 'Yes' : 'No', c.deceased ? 'Yes' : 'No', c.createdAt];
      csvLines.push(row.map(escapeCsvCell).join(','));
    }

    csvLines.push('');

    // --- SECTION 3: DOOR KNOCK QUEUE ---
    csvLines.push('=== DOOR KNOCK QUEUE ===');
    const doorKnockHeaders = ['Queue ID', 'Lead ID', 'Owner Name', 'Property Address', 'City', 'State', 'Zip', 'Lead Type', 'Status', 'Visited At', 'Priority', 'Notes'];
    csvLines.push(doorKnockHeaders.map(escapeCsvCell).join(','));

    for (const dk of doorKnocks) {
      const ownerName = [dk.ownerFirstName, dk.ownerLastName].filter(Boolean).join(' ');
      const row = [dk.id, dk.leadId, ownerName, dk.propertyAddress, dk.propertyCity, dk.propertyState, dk.propertyZip, dk.leadType, dk.status, dk.visitedAt, dk.priority, dk.notes];
      csvLines.push(row.map(escapeCsvCell).join(','));
    }

    csvLines.push('');

    // --- SECTION 4: OUTREACH QUEUE ---
    csvLines.push('=== OUTREACH QUEUE ===');
    const queueHeaders = [
      'Queue Item ID',
      'Contact ID',
      'Contact Name',
      'Contact Phone',
      'Contact Email',
      'Property Address',
      'Property City',
      'Property State',
      'Lead Type',
      'Queue Status',
      'Email Status',
      'Email Attempts',
      'Last Contact Date',
      'Last Lead Reply Date',
    ];
    csvLines.push(queueHeaders.map(escapeCsvCell).join(','));

    for (const item of outreachItems) {
      const row = [
        item.id,
        item.contactId,
        item.contactName,
        item.contactPhone,
        item.contactEmail,
        item.propertyAddress,
        item.propertyCity,
        item.propertyState,
        item.leadType,
        item.queueStatus,
        item.emailStatus,
        item.emailAttempts,
        item.lastContactDate,
        item.lastLeadReplyDate,
      ];
      csvLines.push(row.map(escapeCsvCell).join(','));
    }

    csvLines.push('');

    // --- SECTION 5: BATCHDATA & SKIP TRACE JOBS ---
    csvLines.push('=== BATCHDATA JOBS ===');
    const batchJobHeaders = ['Job ID', 'Job Type', 'Leads Sent', 'Matched', 'No Match', 'No Quality', 'Failed', 'Skipped', 'Credits Charged', 'Dollars Charged'];
    csvLines.push(batchJobHeaders.map(escapeCsvCell).join(','));

    for (const bj of batchJobs) {
      const row = [bj.id, bj.jobType, bj.leadsSent, bj.matched, bj.noMatch, bj.noQuality, bj.failed, bj.skipped, bj.creditsCharged, bj.dollarsCharged];
      csvLines.push(row.map(escapeCsvCell).join(','));
    }

    csvLines.push('');

    // --- SECTION 6: CSV UPLOAD JOBS ---
    csvLines.push('=== CSV UPLOAD JOBS ===');
    const csvJobHeaders = ['Job ID', 'File Name', 'Lead Type', 'Status', 'Total Rows', 'Processed Rows', 'Success Count', 'Duplicate Count', 'Error Count', 'Started At', 'Completed At'];
    csvLines.push(csvJobHeaders.map(escapeCsvCell).join(','));

    for (const cj of csvJobs) {
      const row = [cj.id, cj.fileName, cj.leadType, cj.status, cj.totalRows, cj.processedRows, cj.successCount, cj.duplicateCount, cj.errorCount, cj.startedAt, cj.completedAt];
      csvLines.push(row.map(escapeCsvCell).join(','));
    }

    csvLines.push('');

    // --- SECTION 7: USER ACCOUNT & INTEGRATIONS ---
    csvLines.push('=== USER ACCOUNT & INTEGRATIONS ===');
    const accountHeaders = [
      'User ID / Owner',
      'Email',
      'Credits Balance',
      'Total Skips Performed',
      'Total Leads Synced',
      'GHL Location ID',
      'GHL Integration Type',
      'Sub-Account Status',
      'Agent Name',
      'Agent Brokerage',
    ];
    csvLines.push(accountHeaders.map(escapeCsvCell).join(','));

    for (const acc of accounts) {
      const intg = integrations.find((i) => i.userId === userId);
      const row = [
        acc.owner,
        acc.email,
        acc.credits,
        acc.totalSkipsPerformed,
        acc.totalLeadsSynced,
        intg?.locationId || acc.crmLocationId,
        acc.ghlIntegrationType,
        acc.ghlSubAccountStatus,
        intg?.agentName || '',
        intg?.agentBrokerage || '',
      ];
      csvLines.push(row.map(escapeCsvCell).join(','));
    }

    csvLines.push('');

    // --- SECTION 8: NOTIFICATIONS ---
    csvLines.push('=== NOTIFICATIONS ===');
    const notifHeaders = ['Notification ID', 'Title', 'Message', 'Type', 'Is Read'];
    csvLines.push(notifHeaders.map(escapeCsvCell).join(','));

    for (const n of notifications) {
      const row = [n.id, n.title, n.message, n.type, n.isRead ? 'Yes' : 'No'];
      csvLines.push(row.map(escapeCsvCell).join(','));
    }

    const csvContent = csvLines.join('\n');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `account-data-export-${dateStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Account data CSV export failed:', error);
    return NextResponse.json(
      { error: 'Failed to export account data', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
