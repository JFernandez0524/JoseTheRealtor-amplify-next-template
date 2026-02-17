'use client';

import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

interface EmailStats {
  totalSent: number;
  last7Days: number;
  last30Days: number;
  recentEmails: Array<{
    contactName: string;
    contactEmail: string;
    lastEmailSent: string;
    emailAttempts: number;
  }>;
}

export default function EmailAnalytics() {
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const { data: queue } = await client.models.OutreachQueue.list({
        filter: { emailStatus: { eq: 'PENDING' } },
      });

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const withEmails = queue.filter(q => q && q.lastEmailSent);
      
      const last7Days = withEmails.filter(q => 
        q && q.lastEmailSent && new Date(q.lastEmailSent) >= sevenDaysAgo
      ).length;

      const last30Days = withEmails.filter(q => 
        q && q.lastEmailSent && new Date(q.lastEmailSent) >= thirtyDaysAgo
      ).length;

      const recentEmails = withEmails
        .filter(q => q && q.lastEmailSent)
        .sort((a, b) => new Date(b.lastEmailSent!).getTime() - new Date(a.lastEmailSent!).getTime())
        .slice(0, 10)
        .map(q => ({
          contactName: q.contactName || 'Unknown',
          contactEmail: q.contactEmail || '',
          lastEmailSent: q.lastEmailSent!,
          emailAttempts: q.emailAttempts || 0,
        }));

      setStats({
        totalSent: withEmails.length,
        last7Days,
        last30Days,
        recentEmails,
      });
    } catch (error) {
      console.error('Failed to load email stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="animate-pulse bg-gray-100 rounded-lg h-64" />;
  }

  if (!stats) {
    return <div className="text-red-600">Failed to load email analytics</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600">Last 7 Days</div>
          <div className="text-3xl font-bold text-blue-600">{stats.last7Days}</div>
          <div className="text-xs text-gray-500">emails sent</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600">Last 30 Days</div>
          <div className="text-3xl font-bold text-green-600">{stats.last30Days}</div>
          <div className="text-xs text-gray-500">emails sent</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600">Total Sent</div>
          <div className="text-3xl font-bold text-purple-600">{stats.totalSent}</div>
          <div className="text-xs text-gray-500">all time</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Recent Emails</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Sent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Emails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.recentEmails.map((email, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 text-sm">{email.contactName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{email.contactEmail}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(email.lastEmailSent).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm">{email.emailAttempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
