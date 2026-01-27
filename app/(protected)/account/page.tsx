import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { redirect } from 'next/navigation';
import AccountDashboard from '@/app/components/account/AccountDashboard';
import { type Schema } from '@/amplify/data/resource';
import { fetchAllLeads } from '@/app/utils/aws/data/pagination';

type UserAccount = Schema['UserAccount']['type'];
type PropertyLead = Schema['PropertyLead']['type'];

export default async function AccountPage() {
  // Get current user
  const currentUser = await AuthGetCurrentUserServer();
  if (!currentUser) {
    redirect('/');
  }

  // Fetch user's data
  const [
    { data: userAccounts },
    { data: userLeads },
  ] = await Promise.all([
    cookiesClient.models.UserAccount.list({
      filter: { owner: { eq: currentUser.userId } }
    }),
    fetchAllLeads((params) => 
      cookiesClient.models.PropertyLead.list({
        ...params,
        filter: { owner: { eq: currentUser.userId } }
      })
    ),
  ]);

  const userAccount = userAccounts?.[0];

  // Serialize for client component
  const initialAccount: UserAccount | null = userAccount ? JSON.parse(JSON.stringify(userAccount)) : null;
  const initialLeads: PropertyLead[] = JSON.parse(JSON.stringify(userLeads || []));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          My Account
        </h1>
        <p className="text-slate-500 font-medium">
          View your usage statistics, failed skip traces, and activity history.
        </p>
      </div>

      <AccountDashboard 
        initialAccount={initialAccount}
        initialLeads={initialLeads}
      />
    </div>
  );
}
