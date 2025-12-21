import {
  cookiesClient,
  AuthIsUserAuthenticatedServer,
} from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { redirect } from 'next/navigation';
import LeadDashboardClient from '@/app/components/dashboard/LeadDashboardClient';
import { type Schema } from '@/amplify/data/resource';
// Define a reusable type for a single Lead
type PropertyLead = Schema['PropertyLead']['type'];

export default async function DashboardPage() {
  // 1. Server-side Auth Guard
  const isAuthenticated = await AuthIsUserAuthenticatedServer();
  if (!isAuthenticated) {
    redirect('/login');
  }

  // 2. Fetch Initial Data using the Cookies Client
  // 1. Properly type the response from the database
  const { data: leads, errors } =
    await cookiesClient.models.PropertyLead.list();
  if (errors) {
    console.error('Data Fetch Error:', errors);
  }

  // 2. 🚨 FIX: Serialize the data to strip non-serializable functions
  // This removes the 'contacts: function', 'enrichments: function', etc.
  // 2. Serialize and cast to the correct type
  // We use PropertyLead[] to tell TypeScript this is an array of Leads
  const initialLeads: PropertyLead[] = JSON.parse(JSON.stringify(leads || []));
  return (
    <div className='p-6'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold'>Property Leads</h1>
        <p className='text-gray-600'>
          Initial data loaded from server; syncing in real-time.
        </p>
      </div>

      {/* 3. Pass server data to the Client Component */}
      <LeadDashboardClient initialLeads={initialLeads || []} />
    </div>
  );
}
