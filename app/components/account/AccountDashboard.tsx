'use client';

import { useState } from 'react';
import { type Schema } from '@/amplify/data/resource';
import { 
  HiOutlineDocumentText, 
  HiOutlineChartBar,
  HiOutlineClock,
  HiOutlineExclamationCircle
} from 'react-icons/hi2';

type UserAccount = Schema['UserAccount']['type'];
type PropertyLead = Schema['PropertyLead']['type'];

interface AccountDashboardProps {
  initialAccount: UserAccount | null;
  initialLeads: PropertyLead[];
}

export default function AccountDashboard({ initialAccount, initialLeads }: AccountDashboardProps) {
  const [leads] = useState(initialLeads);

  // Calculate stats from actual lead data (more reliable than counters)
  const totalLeads = leads.length;
  
  // Count successful skip traces
  const totalSkips = leads.filter(lead => 
    lead.skipTraceStatus === 'COMPLETED' && 
    (lead.phones?.length > 0 || lead.emails?.length > 0)
  ).length;
  
  // Count successful GHL syncs
  const totalSynced = leads.filter(lead => 
    lead.ghlSyncStatus === 'SUCCESS'
  ).length;
  
  const credits = initialAccount?.credits || 0;

  // Failed skip traces
  const failedLeads = leads.filter(lead => 
    lead.skipTraceStatus === 'FAILED' || lead.skipTraceStatus === 'NO_MATCH'
  );

  // Get today's failures
  const today = new Date().toISOString().split('T')[0];
  const todayFailures = failedLeads.filter(lead => {
    if (!lead.skipTraceHistory) return false;
    const history = typeof lead.skipTraceHistory === 'string' 
      ? JSON.parse(lead.skipTraceHistory) 
      : lead.skipTraceHistory;
    return history.some((attempt: any) => 
      attempt.timestamp.startsWith(today) && 
      (attempt.status === 'FAILED' || attempt.status === 'NO_MATCH')
    );
  });

  // Recent activity (last 10 skip traced leads)
  const recentActivity = leads
    .filter(lead => lead.skipTraceCompletedAt || lead.skipTraceHistory)
    .sort((a, b) => {
      const dateA = a.skipTraceCompletedAt || 
        (a.skipTraceHistory ? 
          (typeof a.skipTraceHistory === 'string' ? JSON.parse(a.skipTraceHistory) : a.skipTraceHistory)[0]?.timestamp 
          : '');
      const dateB = b.skipTraceCompletedAt || 
        (b.skipTraceHistory ? 
          (typeof b.skipTraceHistory === 'string' ? JSON.parse(b.skipTraceHistory) : b.skipTraceHistory)[0]?.timestamp 
          : '');
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    })
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <HiOutlineDocumentText className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Leads</p>
              <p className="text-2xl font-bold text-gray-900">{totalLeads}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <HiOutlineChartBar className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Skip Traces</p>
              <p className="text-2xl font-bold text-gray-900">{totalSkips}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <HiOutlineClock className="h-8 w-8 text-purple-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">GHL Synced</p>
              <p className="text-2xl font-bold text-gray-900">{totalSynced}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <HiOutlineExclamationCircle className="h-8 w-8 text-orange-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Credits</p>
              <p className="text-2xl font-bold text-gray-900">{credits}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Failed Skip Traces Section */}
      {failedLeads.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-yellow-900 mb-4">
            ⚠️ Failed Skip Traces ({failedLeads.length} total, {todayFailures.length} today)
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {failedLeads.slice(0, 20).map(lead => {
              const history = lead.skipTraceHistory 
                ? (typeof lead.skipTraceHistory === 'string' ? JSON.parse(lead.skipTraceHistory) : lead.skipTraceHistory)
                : [];
              const lastAttempt = history[history.length - 1];
              
              return (
                <div key={lead.id} className="bg-white p-3 rounded border border-yellow-200">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {lead.ownerAddress}, {lead.ownerCity}, {lead.ownerState}
                      </p>
                      <p className="text-sm text-gray-600">
                        Type: {lead.type} | Status: {lead.skipTraceStatus}
                      </p>
                      {lastAttempt && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last attempt: {new Date(lastAttempt.timestamp).toLocaleString()}
                          {history.length > 1 && ` (${history.length} total attempts)`}
                        </p>
                      )}
                    </div>
                    <a
                      href={`/lead/${lead.id}`}
                      className="text-xs text-blue-600 hover:text-blue-800 ml-4"
                    >
                      View →
                    </a>
                  </div>
                </div>
              );
            })}
            {failedLeads.length > 20 && (
              <p className="text-sm text-gray-500 text-center pt-2">
                Showing first 20 of {failedLeads.length} failed leads
              </p>
            )}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Skip Trace Activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Property
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Results
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentActivity.map((lead) => {
                const date = lead.skipTraceCompletedAt || 
                  (lead.skipTraceHistory ? 
                    (typeof lead.skipTraceHistory === 'string' ? JSON.parse(lead.skipTraceHistory) : lead.skipTraceHistory)[0]?.timestamp 
                    : '');
                
                return (
                  <tr key={lead.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {lead.ownerAddress}
                      </div>
                      <div className="text-sm text-gray-500">
                        {lead.ownerCity}, {lead.ownerState}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        lead.skipTraceStatus === 'COMPLETED' 
                          ? 'bg-green-100 text-green-800'
                          : lead.skipTraceStatus === 'FAILED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {lead.skipTraceStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lead.phones?.length || 0} phones, {lead.emails?.length || 0} emails
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {date ? new Date(date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <a
                        href={`/lead/${lead.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
