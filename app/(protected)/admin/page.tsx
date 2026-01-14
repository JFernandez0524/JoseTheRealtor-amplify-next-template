import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { AuthGetUserGroupsServer, AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { redirect } from 'next/navigation';
import AdminDashboard from '@/app/components/admin/AdminDashboard';
import { type Schema } from '@/amplify/data/resource';

type UserAccount = Schema['UserAccount']['type'];
type PropertyLead = Schema['PropertyLead']['type'];

export default async function AdminPage() {
  // Check if user is admin
  const groups = await AuthGetUserGroupsServer();
  if (!groups.includes('ADMINS')) {
    redirect('/dashboard');
  }

  // Get current user info
  const currentUser = await AuthGetCurrentUserServer();

  // Fetch admin data using server client to avoid triggering AccessContext
  const [
    { data: users, errors: userErrors },
    { data: leads, errors: leadErrors },
  ] = await Promise.all([
    // Use server client to avoid client-side effects
    cookiesClient.models.UserAccount.list(),
    cookiesClient.models.PropertyLead.list(),
  ]);

  if (userErrors) console.error('User Fetch Error:', userErrors);
  if (leadErrors) console.error('Lead Fetch Error:', leadErrors);

  // Deduplicate users by email (keep most recent)
  const userMap = new Map<string, UserAccount>();
  (users || []).forEach(user => {
    const existing = userMap.get(user.email);
    if (!existing || new Date(user.updatedAt) > new Date(existing.updatedAt)) {
      userMap.set(user.email, user);
    }
  });
  const deduplicatedUsers = Array.from(userMap.values());

  // Serialize for client component
  const initialUsers: UserAccount[] = JSON.parse(JSON.stringify(deduplicatedUsers));
  const initialLeads: PropertyLead[] = JSON.parse(JSON.stringify(leads || []));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Admin Dashboard
        </h1>
        <p className="text-slate-500 font-medium">
          Manage users, monitor system activity, and oversee platform operations.
        </p>
      </div>

      <AdminDashboard 
        initialUsers={initialUsers} 
        initialLeads={initialLeads}
        currentUserId={currentUser?.userId || ''}
      />
    </div>
  );
}
