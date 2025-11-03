// app/(protected)/dashboard/page.tsx
import { cookiesClient } from '@/app/utils/amplifyServerUtils.server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { data: leads, errors } = await cookiesClient.models.Lead.list();
  if (errors) {
    console.error('Error fetching leads:', errors);
    return <div>Error fetching leads</div>;
  }
  return (
    <main>
      <h1 className='text-2xl font-semibold mb-4'>Your Leads</h1>

      {!leads || leads.length === 0 ? (
        <p className='text-gray-500'>No leads found.</p>
      ) : (
        <table className='border-collapse w-full'>
          <thead>
            <tr>
              <th className='border p-2'>Type</th>
              <th className='border p-2'>Address</th>
              <th className='border p-2'>City</th>
              <th className='border p-2'>State</th>
              <th className='border p-2'>Zip</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td className='border p-2'>{lead.type}</td>
                <td className='border p-2'>{lead.address}</td>
                <td className='border p-2'>{lead.city}</td>
                <td className='border p-2'>{lead.state}</td>
                <td className='border p-2'>{lead.zip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
