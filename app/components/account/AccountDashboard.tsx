'use client';

import { useState } from 'react';
import { type Schema } from '@/amplify/data/resource';
import { 
  HiOutlineDocumentText, 
  HiOutlineChartBar,
  HiOutlineClock,
  HiOutlineExclamationCircle
} from 'react-icons/hi2';
import EmailAnalytics from '@/app/components/profile/EmailAnalytics';

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
    ((lead.phones?.length || 0) > 0 || (lead.emails?.length || 0) > 0)
  ).length;
  
  // Count successful GHL syncs
  const totalSynced = leads.filter(lead => 
    lead.ghlSyncStatus === 'SUCCESS'
  ).length;
  
  const credits = initialAccount?.credits || 0;

  const today = new Date().toISOString().split('T')[0];

  const noResultsCount = leads.filter(lead =>
    lead.skipTraceStatus === 'FAILED' ||
    lead.skipTraceStatus === 'NO_MATCH' ||
    lead.skipTraceStatus === 'NO_QUALITY_CONTACTS'
  ).length;

  // True errors: BatchData couldn't process or find the lead
  const failedLeads = leads.filter(lead =>
    lead.skipTraceStatus === 'FAILED' || lead.skipTraceStatus === 'NO_MATCH'
  );
  const todayFailures = failedLeads.filter(lead => {
    if (!lead.skipTraceHistory) return false;
    const history = typeof lead.skipTraceHistory === 'string'
      ? JSON.parse(lead.skipTraceHistory)
      : lead.skipTraceHistory;
    return history.some((a: any) =>
      a.timestamp.startsWith(today) && (a.status === 'FAILED' || a.status === 'NO_MATCH')
    );
  });

  // No qualifying contacts — found but nothing usable (direct mail only)
  const noQualityLeads = leads.filter(lead =>
    lead.skipTraceStatus === 'NO_QUALITY_CONTACTS'
  );

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <HiOutlineExclamationCircle className="h-8 w-8 text-red-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">No Results</p>
              <p className="text-2xl font-bold text-gray-900">{noResultsCount}</p>
              <p className="text-xs text-gray-400">Failed · No Match · No Quality</p>
            </div>
          </div>
        </div>
      </div>

      {/* Skip Trace Issues */}
      {(failedLeads.length > 0 || noQualityLeads.length > 0) && (
        <div className="space-y-4">

          {/* Errors / No Match */}
          {failedLeads.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-base font-bold text-red-900 mb-1">
                Skip Trace Errors — {failedLeads.length} lead{failedLeads.length !== 1 ? 's' : ''}
              </h3>
              <p className="text-sm text-red-700 mb-4">
                {todayFailures.length > 0 && <span className="font-semibold">{todayFailures.length} today · </span>}
                These leads either had no owner records found or could not be processed. Click a lead to view details and retry.
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {failedLeads.slice(0, 20).map(lead => {
                  const history: any[] = lead.skipTraceHistory
                    ? (typeof lead.skipTraceHistory === 'string' ? JSON.parse(lead.skipTraceHistory) : lead.skipTraceHistory)
                    : [];
                  const last = history[history.length - 1];
                  const displayAddr = lead.type === 'PROBATE'
                    ? `${lead.adminAddress || lead.mailingAddress}, ${lead.mailingCity}, ${lead.mailingState}`
                    : `${lead.ownerAddress}, ${lead.ownerCity}, ${lead.ownerState}`;
                  return (
                    <div key={lead.id} className="bg-white p-3 rounded border border-red-200 flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{displayAddr}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                            lead.skipTraceStatus === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {lead.skipTraceStatus?.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-gray-500">{lead.type}</span>
                        </div>
                        {last?.reason && (
                          <p className="text-xs text-gray-500 mt-1">{last.reason}</p>
                        )}
                        {last?.timestamp && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Last attempt: {new Date(last.timestamp).toLocaleString()}
                            {history.length > 1 && ` · ${history.length} attempts`}
                          </p>
                        )}
                      </div>
                      <a href={`/lead/${lead.id}`} className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap">
                        View →
                      </a>
                    </div>
                  );
                })}
                {failedLeads.length > 20 && (
                  <p className="text-xs text-gray-500 text-center pt-2">Showing 20 of {failedLeads.length}</p>
                )}
              </div>
            </div>
          )}

          {/* No Qualifying Contacts */}
          {noQualityLeads.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <h3 className="text-base font-bold text-orange-900 mb-1">
                No Qualifying Contacts — {noQualityLeads.length} lead{noQualityLeads.length !== 1 ? 's' : ''}
              </h3>
              <p className="text-sm text-orange-700 mb-4">
                An owner was found but no mobile numbers (score 90+) or verified emails were returned. These leads have been marked for direct mail only.
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {noQualityLeads.slice(0, 20).map(lead => {
                  const history: any[] = lead.skipTraceHistory
                    ? (typeof lead.skipTraceHistory === 'string' ? JSON.parse(lead.skipTraceHistory) : lead.skipTraceHistory)
                    : [];
                  const last = history[history.length - 1];
                  const displayAddr = lead.type === 'PROBATE'
                    ? `${lead.adminAddress || lead.mailingAddress}, ${lead.mailingCity}, ${lead.mailingState}`
                    : `${lead.ownerAddress}, ${lead.ownerCity}, ${lead.ownerState}`;
                  return (
                    <div key={lead.id} className="bg-white p-3 rounded border border-orange-200 flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{displayAddr}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-orange-100 text-orange-800">
                            No Qualifying Contacts
                          </span>
                          <span className="text-xs text-gray-500">{lead.type}</span>
                        </div>
                        {last?.phonesFound > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            {last.phonesFound} phone{last.phonesFound !== 1 ? 's' : ''} found — none met quality threshold
                          </p>
                        )}
                        {last?.timestamp && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(last.timestamp).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <a href={`/lead/${lead.id}`} className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap">
                        View →
                      </a>
                    </div>
                  );
                })}
                {noQualityLeads.length > 20 && (
                  <p className="text-xs text-gray-500 text-center pt-2">Showing 20 of {noQualityLeads.length}</p>
                )}
              </div>
            </div>
          )}

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
                          : lead.skipTraceStatus === 'NO_MATCH'
                          ? 'bg-yellow-100 text-yellow-800'
                          : lead.skipTraceStatus === 'NO_QUALITY_CONTACTS'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {lead.skipTraceStatus?.replace(/_/g, ' ') ?? 'UNKNOWN'}
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

      {/* Email Analytics */}
      <EmailAnalytics />
    </div>
  );
}
