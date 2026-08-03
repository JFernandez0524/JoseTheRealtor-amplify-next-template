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
    let deletedCounts = {
      leads: 0,
      contacts: 0,
      doorKnock: 0,
      outreachQueue: 0,
      ghlIntegration: 0,
      userAccounts: 0,
      batchDataJobs: 0,
      csvUploadJobs: 0,
      notifications: 0,
    };

    // 1. Delete PropertyLeads & related items
    const { data: leads } = await cookiesClient.models.PropertyLead.list({
      filter: { owner: { eq: userId } },
    });
    for (const lead of leads || []) {
      await cookiesClient.models.PropertyLead.delete({ id: lead.id });
      deletedCounts.leads++;
    }

    // 2. Delete Contacts
    const { data: contacts } = await cookiesClient.models.Contact.list({
      filter: { owner: { eq: userId } },
    });
    for (const contact of contacts || []) {
      await cookiesClient.models.Contact.delete({ id: contact.id });
      deletedCounts.contacts++;
    }

    // 3. Delete DoorKnockQueue items
    const { data: doorKnocks } = await cookiesClient.models.DoorKnockQueue.list({
      filter: { userId: { eq: userId } },
    });
    for (const item of doorKnocks || []) {
      await cookiesClient.models.DoorKnockQueue.delete({ id: item.id });
      deletedCounts.doorKnock++;
    }

    // 4. Delete OutreachQueue items
    const { data: outreachItems } = await cookiesClient.models.OutreachQueue.list({
      filter: { userId: { eq: userId } },
    });
    for (const item of outreachItems || []) {
      await cookiesClient.models.OutreachQueue.delete({ id: item.id });
      deletedCounts.outreachQueue++;
    }

    // 5. Delete GhlIntegrations
    const { data: integrations } = await cookiesClient.models.GhlIntegration.list({
      filter: { userId: { eq: userId } },
    });
    for (const integration of integrations || []) {
      await cookiesClient.models.GhlIntegration.delete({ id: integration.id });
      deletedCounts.ghlIntegration++;
    }

    // 6. Delete UserAccount
    const { data: accounts } = await cookiesClient.models.UserAccount.list({
      filter: { owner: { eq: userId } },
    });
    for (const account of accounts || []) {
      await cookiesClient.models.UserAccount.delete({ id: account.id });
      deletedCounts.userAccounts++;
    }

    // 7. Delete BatchDataJobs
    const { data: batchJobs } = await cookiesClient.models.BatchDataJob.list({
      filter: { userId: { eq: userId } },
    });
    for (const job of batchJobs || []) {
      await cookiesClient.models.BatchDataJob.delete({ id: job.id });
      deletedCounts.batchDataJobs++;
    }

    // 8. Delete CsvUploadJobs
    const { data: csvJobs } = await cookiesClient.models.CsvUploadJob.list({
      filter: { userId: { eq: userId } },
    });
    for (const job of csvJobs || []) {
      await cookiesClient.models.CsvUploadJob.delete({ id: job.id });
      deletedCounts.csvUploadJobs++;
    }

    // 9. Delete Notifications
    const { data: notifications } = await cookiesClient.models.Notification.list({
      filter: { owner: { eq: userId } },
    });
    for (const note of notifications || []) {
      await cookiesClient.models.Notification.delete({ id: note.id });
      deletedCounts.notifications++;
    }

    console.log(`✅ Complete data erasure for user ${userId}:`, deletedCounts);

    return NextResponse.json({
      success: true,
      message: 'All user data erased successfully.',
      deletedCounts,
    });
  } catch (error: any) {
    console.error('Account data erasure failed:', error);
    return NextResponse.json(
      { error: 'Failed to erase account data', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
