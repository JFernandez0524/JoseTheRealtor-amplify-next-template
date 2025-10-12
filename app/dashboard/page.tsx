'use client';

import { getCurrentUser } from 'aws-amplify/auth';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const client = generateClient<Schema>();

export default function DashboardPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        const { data } = await client.models.Lead.list({
          filter: { owner: { eq: user.username } },
        });
        setLeads(data);
      } catch {
        router.push('/login');
      }
    }
    load();
  }, [router]);
  return (
    <Authenticator>
      {({ user, signOut }) => (
        <main className='p-6'>
          <div className='flex justify-between mb-4'>
            <h1 className='text-2xl font-semibold'>
              Welcome, {user?.username}
            </h1>
            <button
              onClick={signOut}
              className='bg-gray-200 px-3 py-1 rounded hover:bg-gray-300'
            >
              Sign Out
            </button>
          </div>
          <Dashboard user={user} />
        </main>
      )}
    </Authenticator>
  );
}

function Dashboard({ user }: any) {
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    async function loadLeads() {
      const { data } = await client.models.Lead.list({
        filter: { owner: { eq: user.username } }, // 👈 Filter by owner
      });
      setLeads(data);
    }
    loadLeads();
  }, [user]);

  return (
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
  );
}
