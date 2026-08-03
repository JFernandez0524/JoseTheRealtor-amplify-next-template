import { NextResponse } from 'next/server';
import { AuthGetCurrentUserServer, cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

/**
 * GET /api/v1/account/export
 *
 * Export all user account data, property leads, integration settings,
 * job histories, and queues in JSON format for GDPR/CCPA data portability.
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

    const exportData = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        userId: userId,
        platform: 'JoseTheRealtor Lead Management Platform',
      },
      userAccount: userAccountRes.data || [],
      propertyLeads: leadsRes.data || [],
      contacts: contactsRes.data || [],
      doorKnockQueue: doorKnockRes.data || [],
      outreachQueue: outreachQueueRes.data || [],
      ghlIntegration: ghlIntegrationRes.data || [],
      batchDataJobs: batchJobsRes.data || [],
      csvUploadJobs: csvJobsRes.data || [],
      notifications: notificationsRes.data || [],
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `account-data-export-${dateStr}.json`;

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Account data export failed:', error);
    return NextResponse.json(
      { error: 'Failed to export account data', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
