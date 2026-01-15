import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import LeadDashboardClient from '@/app/components/dashboard/LeadDashboardClient';
import { type Schema } from '@/amplify/data/resource';

type PropertyLead = Schema['PropertyLead']['type'];

export default async function DashboardPage() {
  // 1. Fetch ALL Data with pagination
  let allLeads: PropertyLead[] = [];
  let nextToken: string | null = null;

  do {
    const result = await cookiesClient.models.PropertyLead.list({
      limit: 1000,
      nextToken: nextToken || undefined
    });
    
    if (result.errors) console.error('Data Fetch Error:', result.errors);
    if (result.data) allLeads.push(...result.data);
    nextToken = result.nextToken || null;
  } while (nextToken);

  const leads = allLeads;

  // 2. Serialize for Client Component
  const initialLeads: PropertyLead[] = JSON.parse(JSON.stringify(leads));

  return (
    <div className='p-6'>
      <div className='mb-6'>
        <h1 className='text-3xl font-black text-slate-900 tracking-tight'>
          Property Leads
        </h1>
        <p className='text-slate-500 font-medium'>
          Manage your pipeline and sync high-equity leads to your CRM.
        </p>
      </div>

      <LeadDashboardClient initialLeads={initialLeads} />
    </div>
  );
}
