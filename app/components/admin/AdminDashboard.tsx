'use client';

import { useState } from 'react';
import { type Schema } from '@/amplify/data/resource';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { 
  HiOutlineUsers, 
  HiOutlineDocumentText, 
  HiOutlineChartBar,
  HiOutlineShieldCheck,
  HiOutlineTrash
} from 'react-icons/hi2';

type UserAccount = Schema['UserAccount']['type'];
type PropertyLead = Schema['PropertyLead']['type'];

interface AdminDashboardProps {
  initialUsers: UserAccount[];
  initialLeads: PropertyLead[];
  currentUserId: string;
}

export default function AdminDashboard({ initialUsers, initialLeads, currentUserId }: AdminDashboardProps) {
  const [users, setUsers] = useState(initialUsers);
  const [leads] = useState(initialLeads);
  const [loading, setLoading] = useState(false);

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
  const invalidLeads = leads.filter(lead => lead.validationStatus === 'INVALID' || (lead.validationErrors && lead.validationErrors.length > 0));
  const totalCredits = users.reduce((sum, user) => sum + (user.credits || 0), 0);
  const totalSkips = users.reduce((sum, user) => sum + (user.totalSkipsPerformed || 0), 0);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <HiOutlineUsers className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <HiOutlineDocumentText className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Leads</p>
              <p className="text-2xl font-bold text-gray-900">{totalLeads}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <HiOutlineTrash className="h-8 w-8 text-red-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Invalid Leads</p>
              <p className="text-2xl font-bold text-gray-900">{invalidLeads.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <HiOutlineChartBar className="h-8 w-8 text-purple-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Credits</p>
              <p className="text-2xl font-bold text-gray-900">{totalCredits}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Skip Trace Failures Section */}
      {(() => {
        const failedLeads = leads.filter(lead => 
          lead.skipTraceStatus === 'FAILED' || lead.skipTraceStatus === 'NO_MATCH'
        );
        
        // Get today's failures from history
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

        if (failedLeads.length === 0) return null;

        return (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-yellow-900 mb-4">
              ⚠️ Skip Trace Failures ({failedLeads.length} total, {todayFailures.length} today)
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {failedLeads.slice(0, 50).map(lead => {
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
                        View Details →
                      </a>
                    </div>
                  </div>
                );
              })}
              {failedLeads.length > 50 && (
                <p className="text-sm text-gray-500 text-center pt-2">
                  Showing first 50 of {failedLeads.length} failed leads
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Invalid Leads Section */}
      {invalidLeads.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-red-900 mb-4">⚠️ Invalid Leads Requiring Review</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {invalidLeads.map(lead => (
              <div key={lead.id} className="bg-white p-3 rounded border border-red-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {lead.ownerFirstName} {lead.ownerLastName} - {lead.ownerAddress}
                    </p>
                    <p className="text-sm text-gray-600">Type: {lead.type}</p>
                    {lead.validationErrors && lead.validationErrors.length > 0 && (
                      <ul className="text-sm text-red-600 mt-1">
                        {lead.validationErrors.map((error, idx) => (
                          <li key={idx}>• {error}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{lead.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Admin Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh Data
          </button>
          
          <button
            onClick={() => {
              const csvContent = users.map(user => 
                `${user.email},${user.credits || 0},${user.totalSkipsPerformed || 0},${user.totalLeadsSynced || 0}`
              ).join('\n');
              const blob = new Blob([`Email,Credits,Skips,Syncs\n${csvContent}`], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'users-export.csv';
              a.click();
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Export Users CSV
          </button>

          <button
            onClick={() => {
              const csvContent = leads.slice(0, 1000).map(lead => 
                `${lead.ownerAddress || ''},${lead.ownerCity || ''},${lead.ownerState || ''},${lead.type || ''},${lead.skipTraceStatus || ''}`
              ).join('\n');
              const blob = new Blob([`Address,City,State,Type,Status\n${csvContent}`], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'leads-export.csv';
              a.click();
            }}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Export Leads CSV
          </button>

          <button
            onClick={async () => {
              if (!confirm('Fix all failed GHL syncs? This will search GHL for existing contacts and create them if missing.')) return;
              
              setLoading(true);
              try {
                const response = await fetch('/api/v1/fix-failed-syncs', {
                  method: 'POST',
                });
                const result = await response.json();
                
                if (response.ok) {
                  const body = result.body || {};
                  alert(
                    `✅ Found & Updated: ${body.fixed || 0}\n` +
                    `🆕 Created New: ${body.created || 0}\n` +
                    `❌ Failed: ${body.failed || 0}\n` +
                    `📊 Total: ${body.total || 0}`
                  );
                  window.location.reload();
                } else {
                  alert(`Error: ${result.error || 'Failed to fix syncs'}`);
                }
              } catch (err: any) {
                alert(`Error: ${err.message}`);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Fixing...' : '🔧 Fix Failed Syncs'}
          </button>
        </div>
      </div>

      {/* User Management */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Credits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Skips Performed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Leads Synced
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user.email}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {user.owner?.slice(0, 8)}...
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.credits || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.totalSkipsPerformed || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.totalLeadsSynced || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {user.owner === currentUserId ? (
                      <span className="text-gray-500 text-sm">Current User</span>
                    ) : (
                      <button
                        onClick={() => promoteUser(user.owner || '', user.email)}
                        disabled={loading}
                        className="text-blue-600 hover:text-blue-900 mr-4 disabled:opacity-50"
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
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Leads</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Property
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leads.slice(0, 10).map((lead) => (
                <tr key={lead.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {lead.ownerAddress}
                    </div>
                    <div className="text-sm text-gray-500">
                      {lead.ownerCity}, {lead.ownerState} {lead.ownerZip}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {lead.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      lead.skipTraceStatus === 'COMPLETED' 
                        ? 'bg-green-100 text-green-800'
                        : lead.skipTraceStatus === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {lead.skipTraceStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : 'N/A'}
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
