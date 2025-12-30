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
            <HiOutlineChartBar className="h-8 w-8 text-purple-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Credits</p>
              <p className="text-2xl font-bold text-gray-900">{totalCredits}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <HiOutlineShieldCheck className="h-8 w-8 text-orange-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Skips</p>
              <p className="text-2xl font-bold text-gray-900">{totalSkips}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Admin Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
