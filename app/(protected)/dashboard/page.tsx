'use client';

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { useState, useEffect } from 'react';

const client = generateClient<Schema>();

export default function DashboardPage() {
  const [leads, setLeads] = useState<Schema['Lead']['type'][]>([]);

  useEffect(() => {
    async function loadLeads() {
      const { data } = await client.models.Lead.list();
      setLeads(data);
    }
    loadLeads();
  }, []);

  return (
    <main>
      <h1 className='text-2xl font-semibold mb-4'>Your Leads</h1>
      {leads.length === 0 ? (
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
