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
 * Export all user account data, property leads, contacts, and outreach queues
 * in standard CSV format (.csv) for GDPR/CCPA data portability.
 */
export async function GET() {
  try {
    const currentUser = await AuthGetCurrentUserServer();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = currentUser.userId;

    // Fetch user-owned data across models concurrently
    const [
      userAccountRes,
      leadsRes,
      outreachQueueRes,
      ghlIntegrationRes,
    ] = await Promise.all([
      cookiesClient.models.UserAccount.list({ filter: { owner: { eq: userId } } }),
      cookiesClient.models.PropertyLead.list({ filter: { owner: { eq: userId } } }),
      cookiesClient.models.OutreachQueue.list({ filter: { userId: { eq: userId } } }),
      cookiesClient.models.GhlIntegration.list({ filter: { userId: { eq: userId } } }),
    ]);

    const leads = leadsRes.data || [];
    const outreachItems = outreachQueueRes.data || [];
    const accounts = userAccountRes.data || [];
    const integrations = ghlIntegrationRes.data || [];

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

    csvLines.push(''); // Blank line separator

    // --- SECTION 2: OUTREACH QUEUE ---
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

    csvLines.push(''); // Blank line separator

    // --- SECTION 3: USER ACCOUNT & INTEGRATIONS ---
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
      ];
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
