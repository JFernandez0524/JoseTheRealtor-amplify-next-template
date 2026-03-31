'use client';

import { useState, useEffect } from 'react';
import { type Schema } from '@/amplify/data/resource';
import { client } from '@/app/utils/aws/data/frontEndClient';
import {
  HiOutlineUsers,
  HiOutlineDocumentText,
  HiOutlineChartBar,
  HiOutlineTrash,
} from 'react-icons/hi2';

type UserAccount = Schema['UserAccount']['type'];
type PropertyLead = Schema['PropertyLead']['type'];

interface AdminDashboardProps {
  initialUsers: UserAccount[];
  initialLeads: PropertyLead[];
  currentUserId: string;
}

export default function AdminDashboard({
  initialUsers,
  initialLeads,
  currentUserId,
}: AdminDashboardProps) {
  const [users, setUsers] = useState(initialUsers);
  const [leads] = useState(initialLeads);
  const [loading, setLoading] = useState(false);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [emailStats, setEmailStats] = useState<{
    total: number;
    addedToday: number;
    byStatus: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    fetch('/api/v1/admin/outreach-queue-stats')
      .then(r => r.json())
      .then(setEmailStats)
      .catch(console.error);
  }, []);

  const promoteUser = async (userId: string, email: string) => {
    if (!confirm(`Promote ${email} to ADMINS group?`)) return;

    setLoading(true);
    try {
      const { errors } = await client.mutations.addUserToGroup({
        userId,
        groupName: 'ADMINS',
      });

      if (errors) {
        alert(`Promotion failed: ${errors[0].message}`);
      } else {
        alert(`${email} promoted to ADMINS successfully!`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const totalUsers = users.length;
  const totalLeads = leads.length;
  const invalidLeads = leads.filter(
    (lead) =>
      lead.validationStatus === 'INVALID' ||
      (lead.validationErrors && lead.validationErrors.length > 0),
  );
  const totalCredits = users.reduce(
    (sum, user) => sum + (user.credits || 0),
    0,
  );
  const totalSkips = users.reduce(
    (sum, user) => sum + (user.totalSkipsPerformed || 0),
    0,
  );

  // Skip Trace Analytics
  const skipTracedLeads = leads.filter(l => l.skipTraceStatus !== 'PENDING');
  const completedLeads = leads.filter(l => l.skipTraceStatus === 'COMPLETED');
  const failedLeads = leads.filter(l => 
    l.skipTraceStatus === 'FAILED' || 
    l.skipTraceStatus === 'NO_MATCH' || 
    l.skipTraceStatus === 'NO_QUALITY_CONTACTS'
  );
  
  const successRate = skipTracedLeads.length > 0 
    ? ((completedLeads.length / skipTracedLeads.length) * 100).toFixed(1)
    : '0.0';
  
  // Contact breakdown
  const phonesOnly = completedLeads.filter(l => 
    l.phones && l.phones.length > 0 && (!l.emails || l.emails.length === 0)
  );
  const emailsOnly = completedLeads.filter(l => 
    l.emails && l.emails.length > 0 && (!l.phones || l.phones.length === 0)
  );
  const both = completedLeads.filter(l => 
    l.phones && l.phones.length > 0 && l.emails && l.emails.length > 0
  );
  const neither = leads.filter(l => 
    l.skipTraceStatus === 'NO_QUALITY_CONTACTS' || 
    (l.skipTraceStatus === 'COMPLETED' && (!l.phones || l.phones.length === 0) && (!l.emails || l.emails.length === 0))
  );
  
  // Cost analysis
  const estimatedCost = (totalSkips * 0.10).toFixed(2);
  
  // Time-based (last 7 and 30 days)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const last7Days = leads.filter(l => 
    l.skipTraceCompletedAt && new Date(l.skipTraceCompletedAt) >= sevenDaysAgo
  );
  const last30Days = leads.filter(l => 
    l.skipTraceCompletedAt && new Date(l.skipTraceCompletedAt) >= thirtyDaysAgo
  );

  return (
    <div className='space-y-6'>
      {/* Stats Cards */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <div className='bg-white p-6 rounded-lg shadow-sm border'>
          <div className='flex items-center'>
            <HiOutlineUsers className='h-8 w-8 text-blue-500' />
            <div className='ml-4'>
              <p className='text-sm font-medium text-gray-500'>Total Users</p>
              <p className='text-2xl font-bold text-gray-900'>{totalUsers}</p>
            </div>
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg shadow-sm border'>
          <div className='flex items-center'>
            <HiOutlineDocumentText className='h-8 w-8 text-green-500' />
            <div className='ml-4'>
              <p className='text-sm font-medium text-gray-500'>Total Leads</p>
              <p className='text-2xl font-bold text-gray-900'>{totalLeads}</p>
            </div>
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg shadow-sm border'>
          <div className='flex items-center'>
            <HiOutlineTrash className='h-8 w-8 text-red-500' />
            <div className='ml-4'>
              <p className='text-sm font-medium text-gray-500'>Invalid Leads</p>
              <p className='text-2xl font-bold text-gray-900'>
                {invalidLeads.length}
              </p>
            </div>
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg shadow-sm border'>
          <div className='flex items-center'>
            <HiOutlineChartBar className='h-8 w-8 text-purple-500' />
            <div className='ml-4'>
              <p className='text-sm font-medium text-gray-500'>Total Credits</p>
              <p className='text-2xl font-bold text-gray-900'>{totalCredits}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Skip Trace Analytics */}
      <div className='bg-white rounded-lg shadow-sm border p-6'>
        <h2 className='text-lg font-semibold text-gray-900 mb-4'>
          📊 Skip Trace Analytics
        </h2>
        
        {/* Success Rate Cards */}
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-6'>
          <div className='bg-green-50 p-4 rounded-lg border border-green-200'>
            <p className='text-sm font-medium text-green-600'>Success Rate</p>
            <p className='text-3xl font-bold text-green-900'>{successRate}%</p>
            <p className='text-xs text-green-600 mt-1'>
              {completedLeads.length} / {skipTracedLeads.length} completed
            </p>
          </div>
          
          <div className='bg-blue-50 p-4 rounded-lg border border-blue-200'>
            <p className='text-sm font-medium text-blue-600'>Total Skips</p>
            <p className='text-3xl font-bold text-blue-900'>{totalSkips}</p>
            <p className='text-xs text-blue-600 mt-1'>
              ${estimatedCost} estimated cost
            </p>
          </div>
          
          <div className='bg-purple-50 p-4 rounded-lg border border-purple-200'>
            <p className='text-sm font-medium text-purple-600'>Last 7 Days</p>
            <p className='text-3xl font-bold text-purple-900'>{last7Days.length}</p>
            <p className='text-xs text-purple-600 mt-1'>skip traces completed</p>
          </div>
          
          <div className='bg-orange-50 p-4 rounded-lg border border-orange-200'>
            <p className='text-sm font-medium text-orange-600'>Last 30 Days</p>
            <p className='text-3xl font-bold text-orange-900'>{last30Days.length}</p>
            <p className='text-xs text-orange-600 mt-1'>skip traces completed</p>
          </div>
        </div>
        
        {/* Contact Quality Breakdown */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div>
            <h3 className='text-sm font-semibold text-gray-700 mb-3'>Contact Breakdown</h3>
            <div className='space-y-2'>
              <div className='flex justify-between items-center p-3 bg-gray-50 rounded'>
                <span className='text-sm text-gray-700'>📞 Phones Only</span>
                <span className='font-bold text-gray-900'>{phonesOnly.length}</span>
              </div>
              <div className='flex justify-between items-center p-3 bg-gray-50 rounded'>
                <span className='text-sm text-gray-700'>📧 Emails Only</span>
                <span className='font-bold text-gray-900'>{emailsOnly.length}</span>
              </div>
              <div className='flex justify-between items-center p-3 bg-green-50 rounded border border-green-200'>
                <span className='text-sm text-green-700'>✅ Both Phone & Email</span>
                <span className='font-bold text-green-900'>{both.length}</span>
              </div>
              <div className='flex justify-between items-center p-3 bg-red-50 rounded border border-red-200'>
                <span className='text-sm text-red-700'>❌ No Contacts</span>
                <span className='font-bold text-red-900'>{neither.length}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className='text-sm font-semibold text-gray-700 mb-3'>Status Breakdown</h3>
            <div className='space-y-2'>
              <div className='flex justify-between items-center p-3 bg-green-50 rounded border border-green-200'>
                <span className='text-sm text-green-700'>✅ Completed</span>
                <span className='font-bold text-green-900'>{completedLeads.length}</span>
              </div>
              <div className='flex justify-between items-center p-3 bg-yellow-50 rounded border border-yellow-200'>
                <span className='text-sm text-yellow-700'>⏳ Pending</span>
                <span className='font-bold text-yellow-900'>
                  {leads.filter(l => l.skipTraceStatus === 'PENDING').length}
                </span>
              </div>
              <div className='flex justify-between items-center p-3 bg-red-50 rounded border border-red-200'>
                <span className='text-sm text-red-700'>❌ Failed</span>
                <span className='font-bold text-red-900'>
                  {leads.filter(l => l.skipTraceStatus === 'FAILED').length}
                </span>
              </div>
              <div className='flex justify-between items-center p-3 bg-gray-50 rounded'>
                <span className='text-sm text-gray-700'>🔍 No Match</span>
                <span className='font-bold text-gray-900'>
                  {leads.filter(l => l.skipTraceStatus === 'NO_MATCH').length}
                </span>
              </div>
              <div className='flex justify-between items-center p-3 bg-gray-50 rounded'>
                <span className='text-sm text-gray-700'>📭 No Quality Contacts</span>
                <span className='font-bold text-gray-900'>
                  {leads.filter(l => l.skipTraceStatus === 'NO_QUALITY_CONTACTS').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Outreach Queue Stats */}
      <div className='bg-white rounded-lg shadow-sm border p-6'>
        <h2 className='text-lg font-semibold text-gray-900 mb-4'>
          📧 Email Outreach Queue
        </h2>
        {!emailStats ? (
          <p className='text-sm text-gray-500'>Loading...</p>
        ) : (
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <div className='bg-blue-50 p-4 rounded-lg border border-blue-200 text-center'>
              <p className='text-sm text-blue-600'>Total</p>
              <p className='text-3xl font-bold text-blue-900'>{emailStats.total}</p>
            </div>
            <div className='bg-green-50 p-4 rounded-lg border border-green-200 text-center'>
              <p className='text-sm text-green-600'>Added Today</p>
              <p className='text-3xl font-bold text-green-900'>{emailStats.addedToday}</p>
            </div>
            {Object.entries(emailStats.byStatus).map(([status, count]) => (
              <div key={status} className='bg-gray-50 p-4 rounded-lg border text-center'>
                <p className='text-sm text-gray-500'>{status}</p>
                <p className='text-3xl font-bold text-gray-900'>{count}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detailed Failure Analysis */}
      {failedLeads.length > 0 && (
        <div className='bg-red-50 border border-red-200 rounded-lg p-6'>
          <h3 className='text-lg font-bold text-red-900 mb-4'>
            🔍 Failed Skip Trace Analysis ({failedLeads.length} leads)
          </h3>
          <p className='text-sm text-red-700 mb-4'>
            These leads failed skip trace when they shouldn&apos;t have. Click to expand and see raw data.
          </p>
          <div className='space-y-3 max-h-[600px] overflow-y-auto'>
            {failedLeads.map((lead) => {
              const isExpanded = expandedLeadId === lead.id;
              const history = lead.skipTraceHistory
                ? typeof lead.skipTraceHistory === 'string'
                  ? JSON.parse(lead.skipTraceHistory)
                  : lead.skipTraceHistory
                : [];
              const rawData = lead.rawSkipTraceData
                ? typeof lead.rawSkipTraceData === 'string'
                  ? JSON.parse(lead.rawSkipTraceData)
                  : lead.rawSkipTraceData
                : null;
              
              return (
                <div key={lead.id} className='bg-white rounded-lg border border-red-300 overflow-hidden'>
                  <div 
                    className='p-4 cursor-pointer hover:bg-red-50 transition-colors'
                    onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                  >
                    <div className='flex justify-between items-start'>
                      <div className='flex-1'>
                        <div className='flex items-center gap-2 mb-2'>
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            lead.skipTraceStatus === 'FAILED' ? 'bg-red-100 text-red-800' :
                            lead.skipTraceStatus === 'NO_MATCH' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {lead.skipTraceStatus}
                          </span>
                          <span className='text-xs text-gray-500'>{lead.type}</span>
                        </div>
                        <p className='font-semibold text-gray-900'>
                          {lead.ownerFirstName} {lead.ownerLastName}
                        </p>
                        <p className='text-sm text-gray-600'>
                          {lead.ownerAddress}, {lead.ownerCity}, {lead.ownerState} {lead.ownerZip}
                        </p>
                        {history.length > 0 && (
                          <p className='text-xs text-gray-500 mt-2'>
                            Last attempt: {new Date(history[history.length - 1].timestamp).toLocaleString()}
                            {history.length > 1 && ` (${history.length} total attempts)`}
                          </p>
                        )}
                      </div>
                      <div className='flex items-center gap-2'>
                        <a
                          href={`/lead/${lead.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className='text-xs text-blue-600 hover:text-blue-800'
                        >
                          View Lead →
                        </a>
                        <span className='text-gray-400'>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className='border-t border-red-200 p-4 bg-gray-50'>
                      <div className='space-y-4'>
                        {/* Search Parameters */}
                        <div>
                          <h4 className='font-semibold text-sm text-gray-900 mb-2'>Search Parameters:</h4>
                          <div className='bg-white p-3 rounded border text-xs font-mono'>
                            <div>Name: {lead.ownerFirstName} {lead.ownerLastName}</div>
                            <div>Address: {lead.ownerAddress}</div>
                            <div>City: {lead.ownerCity}</div>
                            <div>State: {lead.ownerState}</div>
                            <div>Zip: {lead.ownerZip}</div>
                            {lead.standardizedAddress && (
                              <div className='mt-2 pt-2 border-t'>
                                <div className='text-green-700'>Standardized Address:</div>
                                <pre className='text-xs whitespace-pre-wrap'>{JSON.stringify(lead.standardizedAddress, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Skip Trace History */}
                        {history.length > 0 && (
                          <div>
                            <h4 className='font-semibold text-sm text-gray-900 mb-2'>Skip Trace History:</h4>
                            <div className='bg-white p-3 rounded border space-y-2'>
                              {history.map((attempt: any, idx: number) => (
                                <div key={idx} className='text-xs border-b pb-2 last:border-b-0'>
                                  <div className='font-semibold'>{new Date(attempt.timestamp).toLocaleString()}</div>
                                  <div>Status: {attempt.status}</div>
                                  <div>Phones Found: {attempt.phonesFound || 0}</div>
                                  <div>Emails Found: {attempt.emailsFound || 0}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Raw Skip Trace Data */}
                        {rawData && (
                          <div>
                            <h4 className='font-semibold text-sm text-gray-900 mb-2'>Raw Skip Trace Data:</h4>
                            <div className='bg-white p-3 rounded border max-h-64 overflow-y-auto'>
                              <pre className='text-xs font-mono whitespace-pre-wrap'>
                                {JSON.stringify(rawData, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                        
                        {!rawData && (
                          <div className='text-xs text-gray-500 italic'>
                            No raw skip trace data available
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Skip Trace Failures Section */}
      {(() => {
        const oldFailedLeads = leads.filter(
          (lead) =>
            lead.skipTraceStatus === 'FAILED' ||
            lead.skipTraceStatus === 'NO_MATCH',
        );

        // Get today's failures from history
        const today = new Date().toISOString().split('T')[0];
        const todayFailures = oldFailedLeads.filter((lead) => {
          if (!lead.skipTraceHistory) return false;
          const history =
            typeof lead.skipTraceHistory === 'string'
              ? JSON.parse(lead.skipTraceHistory)
              : lead.skipTraceHistory;
          return history.some(
            (attempt: any) =>
              attempt.timestamp.startsWith(today) &&
              (attempt.status === 'FAILED' || attempt.status === 'NO_MATCH'),
          );
        });

        if (oldFailedLeads.length === 0) return null;

        return null; // Replaced by detailed failure analysis above
      })()}

      {/* Invalid Leads Section */}
      {invalidLeads.length > 0 && (
        <div className='bg-red-50 border border-red-200 rounded-lg p-6'>
          <h3 className='text-lg font-bold text-red-900 mb-4'>
            ⚠️ Invalid Leads Requiring Review
          </h3>
          <div className='space-y-2 max-h-96 overflow-y-auto'>
            {invalidLeads.map((lead) => (
              <div
                key={lead.id}
                className='bg-white p-3 rounded border border-red-200'
              >
                <div className='flex justify-between items-start'>
                  <div>
                    <p className='font-semibold text-gray-900'>
                      {lead.ownerFirstName} {lead.ownerLastName} -{' '}
                      {lead.ownerAddress}
                    </p>
                    <p className='text-sm text-gray-600'>Type: {lead.type}</p>
                    {lead.validationErrors &&
                      lead.validationErrors.length > 0 && (
                        <ul className='text-sm text-red-600 mt-1'>
                          {lead.validationErrors.map((error, idx) => (
                            <li key={idx}>• {error}</li>
                          ))}
                        </ul>
                      )}
                  </div>
                  <span className='text-xs text-gray-500'>{lead.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Actions */}
      <div className='bg-white rounded-lg shadow-sm border p-6'>
        <h2 className='text-lg font-semibold text-gray-900 mb-4'>
          Admin Actions
        </h2>
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          <button
            onClick={() => window.location.reload()}
            className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors'
          >
            Refresh Data
          </button>

          <button
            onClick={() => {
              const csvContent = users
                .map(
                  (user) =>
                    `${user.email},${user.credits || 0},${user.totalSkipsPerformed || 0},${user.totalLeadsSynced || 0}`,
                )
                .join('\n');
              const blob = new Blob(
                [`Email,Credits,Skips,Syncs\n${csvContent}`],
                { type: 'text/csv' },
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'users-export.csv';
              a.click();
            }}
            className='bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors'
          >
            Export Users CSV
          </button>

          <button
            onClick={() => {
              const csvContent = leads
                .slice(0, 1000)
                .map(
                  (lead) =>
                    `${lead.ownerAddress || ''},${lead.ownerCity || ''},${lead.ownerState || ''},${lead.type || ''},${lead.skipTraceStatus || ''}`,
                )
                .join('\n');
              const blob = new Blob(
                [`Address,City,State,Type,Status\n${csvContent}`],
                { type: 'text/csv' },
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'leads-export.csv';
              a.click();
            }}
            className='bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors'
          >
            Export Leads CSV
          </button>

          <button
            onClick={async () => {
              if (!confirm('Fix all failed GHL syncs? This will search GHL for existing contacts and create them if missing.')) return;
              
              setLoading(true);
              try {
                const { generateClient } = await import('aws-amplify/data');
                const dataClient = generateClient();
                
                // @ts-ignore - Custom query types not yet generated
                const { data, errors } = await dataClient.queries.fixFailedSyncs();
                
                if (errors) {
                  alert(`Error: ${errors[0].message}`);
                } else if (data) {
                  const result = JSON.parse(data as string);
                  alert(
                    `✅ Found & Updated: ${result.fixed || 0}\n` +
                    `🆕 Created New: ${result.created || 0}\n` +
                    `❌ Failed: ${result.failed || 0}\n` +
                    `📊 Total: ${result.total || 0}`
                  );
                  window.location.reload();
                }
              } catch (err: any) {
                alert(`Error: ${err.message}`);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className='bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {loading ? '⏳ Fixing...' : '🔧 Fix Failed Syncs'}
          </button>
        </div>
      </div>

      {/* User Management */}
      <div className='bg-white rounded-lg shadow-sm border'>
        <div className='px-6 py-4 border-b'>
          <h2 className='text-lg font-semibold text-gray-900'>
            User Management
          </h2>
        </div>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  User
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Credits
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Skips Performed
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Leads Synced
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='text-sm font-medium text-gray-900'>
                      {user.email}
                    </div>
                    <div className='text-sm text-gray-500'>
                      ID: {user.owner?.slice(0, 8)}...
                    </div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                    {user.credits || 0}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                    {user.totalSkipsPerformed || 0}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                    {user.totalLeadsSynced || 0}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
                    {user.owner === currentUserId ? (
                      <span className='text-gray-500 text-sm'>
                        Current User
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          promoteUser(user.owner || '', user.email)
                        }
                        disabled={loading}
                        className='text-blue-600 hover:text-blue-900 mr-4 disabled:opacity-50'
                      >
                        Promote to Admin
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity */}
      <div className='bg-white rounded-lg shadow-sm border'>
        <div className='px-6 py-4 border-b'>
          <h2 className='text-lg font-semibold text-gray-900'>Recent Leads</h2>
        </div>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Property
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Type
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Status
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Created
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {leads.slice(0, 10).map((lead) => (
                <tr key={lead.id}>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='text-sm font-medium text-gray-900'>
                      {lead.ownerAddress}
                    </div>
                    <div className='text-sm text-gray-500'>
                      {lead.ownerCity}, {lead.ownerState} {lead.ownerZip}
                    </div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800'>
                      {lead.type}
                    </span>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        lead.skipTraceStatus === 'COMPLETED'
                          ? 'bg-green-100 text-green-800'
                          : lead.skipTraceStatus === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {lead.skipTraceStatus}
                    </span>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {lead.createdAt
                      ? new Date(lead.createdAt).toLocaleDateString()
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
