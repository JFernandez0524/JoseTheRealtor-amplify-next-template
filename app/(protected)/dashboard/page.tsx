import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import LeadDashboardClient from '@/app/components/dashboard/LeadDashboardClient';
import { type Schema } from '@/amplify/data/resource';

type PropertyLead = Schema['PropertyLead']['type'];

export default async function DashboardPage() {
  // 1. Fetch ALL data with pagination on server
  let allLeads: PropertyLead[] = [];
  let token: string | null | undefined = undefined;

  try {
    do {
      const { data, errors, nextToken } =
        await cookiesClient.models.PropertyLead.list();

      if (errors) {
        console.error('Data Fetch Error:', errors);
        break; // Stop on error
      }
      
      if (data) {
        allLeads = allLeads.concat(data);
        console.log('Fetched batch:', data.length, 'Total:', allLeads.length);
      }
      
      token = nextToken;
    } while (token);

    console.log('Server fetched all leads:', allLeads.length);
  } catch (error) {
    console.error('Fatal error fetching leads:', error);
  }

  // 2. Serialize for Client Component
  const initialLeads: PropertyLead[] = JSON.parse(JSON.stringify(allLeads));

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
