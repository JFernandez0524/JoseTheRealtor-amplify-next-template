import { NextResponse } from 'next/server';
import { AuthGetCurrentUserServer, cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

/**
 * DELETE /api/v1/account/delete
 *
 * Deletes all database records owned by the authenticated user across all tables
 * prior to Cognito user pool deletion, ensuring GDPR/CCPA data erasure compliance.
 */
export async function DELETE() {
  try {
    const currentUser = await AuthGetCurrentUserServer();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = currentUser.userId;

    // 1. Fetch user-owned items across all models concurrently
    const [
      leadsRes,
      contactsRes,
      doorKnockRes,
      outreachQueueRes,
      integrationsRes,
      accountsRes,
      batchJobsRes,
      csvJobsRes,
      notificationsRes,
    ] = await Promise.all([
      cookiesClient.models.PropertyLead.list({ filter: { owner: { eq: userId } } }),
      cookiesClient.models.Contact.list({ filter: { owner: { eq: userId } } }),
      cookiesClient.models.DoorKnockQueue.list({ filter: { userId: { eq: userId } } }),
      cookiesClient.models.OutreachQueue.list({ filter: { userId: { eq: userId } } }),
      cookiesClient.models.GhlIntegration.list({ filter: { userId: { eq: userId } } }),
      cookiesClient.models.UserAccount.list({ filter: { owner: { eq: userId } } }),
      cookiesClient.models.BatchDataJob.list({ filter: { userId: { eq: userId } } }),
      cookiesClient.models.CsvUploadJob.list({ filter: { userId: { eq: userId } } }),
      cookiesClient.models.Notification.list({ filter: { owner: { eq: userId } } }),
    ]);

    const leads = leadsRes.data || [];
    const contacts = contactsRes.data || [];
    const doorKnocks = doorKnockRes.data || [];
    const outreachItems = outreachQueueRes.data || [];
    const integrations = integrationsRes.data || [];
    const accounts = accountsRes.data || [];
    const batchJobs = batchJobsRes.data || [];
    const csvJobs = csvJobsRes.data || [];
    const notifications = notificationsRes.data || [];

    // 2. Delete all records across all tables concurrently
    await Promise.all([
      ...leads.map((item) => cookiesClient.models.PropertyLead.delete({ id: item.id })),
      ...contacts.map((item) => cookiesClient.models.Contact.delete({ id: item.id })),
      ...doorKnocks.map((item) => cookiesClient.models.DoorKnockQueue.delete({ id: item.id })),
      ...outreachItems.map((item) => cookiesClient.models.OutreachQueue.delete({ id: item.id })),
      ...integrations.map((item) => cookiesClient.models.GhlIntegration.delete({ id: item.id })),
      ...accounts.map((item) => cookiesClient.models.UserAccount.delete({ id: item.id })),
      ...batchJobs.map((item) => cookiesClient.models.BatchDataJob.delete({ id: item.id })),
      ...csvJobs.map((item) => cookiesClient.models.CsvUploadJob.delete({ id: item.id })),
      ...notifications.map((item) => cookiesClient.models.Notification.delete({ id: item.id })),
    ]);

    console.log(`✅ Cleaned up database records for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'All user data erased successfully.',
    });
  } catch (error: any) {
    console.error('Account data erasure failed:', error);
    return NextResponse.json(
      { error: 'Failed to erase account data', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
