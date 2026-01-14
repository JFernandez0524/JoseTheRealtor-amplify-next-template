'use client';

import { useMemo } from 'react';
import { getTopLeads, getUrgentLeads, getBestROILeads, calculateLeadScore } from '@/app/utils/ai/leadScoring';
import type { Schema } from '@/amplify/data/resource';

type Lead = Schema['PropertyLead']['type'];

interface Props {
  leads: Lead[];
  onLeadClick?: (leadId: string) => void;
}

export function AIInsightsDashboard({ leads, onLeadClick }: Props) {
  const insights = useMemo(() => {
    const topLeads = getTopLeads(leads, 5);
    const urgentLeads = getUrgentLeads(leads);
    const bestROI = getBestROILeads(leads);

    return { topLeads, urgentLeads, bestROI };
  }, [leads]);

  if (leads.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🤖</span>
        <h2 className="text-xl font-bold text-gray-900">AI Insights</h2>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Top Leads */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>🔥</span> Top 5 Hottest Leads
          </h3>
          <div className="space-y-2">
            {insights.topLeads.map((lead) => {
              const score = calculateLeadScore(lead);
              return (
                <button
                  key={lead.id}
                  onClick={() => onLeadClick?.(lead.id)}
                  className="w-full text-left p-2 hover:bg-gray-50 rounded transition text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 truncate">
                      {lead.ownerFirstName} {lead.ownerLastName}
                    </span>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      score.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                      score.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {score.score}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 truncate">
                    {lead.ownerAddress}, {lead.ownerCity}
                  </div>
                  {lead.zestimate && (
                    <div className="text-xs text-green-600 font-semibold">
                      ${lead.zestimate.toLocaleString()}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Urgent Leads */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>⏰</span> Needs Urgent Attention
          </h3>
          <div className="space-y-2">
            {insights.urgentLeads.length === 0 ? (
              <p className="text-sm text-gray-500">No urgent leads</p>
            ) : (
              insights.urgentLeads.map((lead) => {
                const createdAt = lead.createdAt ? new Date(lead.createdAt) : new Date();
                const ageInDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
                
                return (
                  <button
                    key={lead.id}
                    onClick={() => onLeadClick?.(lead.id)}
                    className="w-full text-left p-2 hover:bg-gray-50 rounded transition text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 truncate">
                        {lead.ownerFirstName} {lead.ownerLastName}
                      </span>
                      <span className="text-xs text-red-600 font-semibold">
                        {ageInDays}d old
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {lead.ownerAddress}
                    </div>
                    {lead.zestimate && (
                      <div className="text-xs text-green-600 font-semibold">
                        ${lead.zestimate.toLocaleString()}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Best ROI */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>💰</span> Best ROI Opportunities
          </h3>
          <div className="space-y-2">
            {insights.bestROI.length === 0 ? (
              <p className="text-sm text-gray-500">No qualified leads yet</p>
            ) : (
              insights.bestROI.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => onLeadClick?.(lead.id)}
                  className="w-full text-left p-2 hover:bg-gray-50 rounded transition text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 truncate">
                      {lead.ownerFirstName} {lead.ownerLastName}
                    </span>
                    <span className="text-xs bg-green-100 text-green-800 font-semibold px-2 py-1 rounded">
                      Ready
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 truncate">
                    {lead.ownerCity}, {lead.ownerState}
                  </div>
                  {lead.zestimate && (
                    <div className="text-xs text-green-600 font-bold">
                      ${lead.zestimate.toLocaleString()}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-4 pt-4 border-t border-purple-200">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-purple-600">{leads.length}</div>
            <div className="text-xs text-gray-600">Total Leads</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {leads.filter(l => calculateLeadScore(l).priority === 'HIGH').length}
            </div>
            <div className="text-xs text-gray-600">High Priority</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {leads.filter(l => (l.phones?.length || 0) > 0).length}
            </div>
            <div className="text-xs text-gray-600">With Contact</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {insights.urgentLeads.length}
            </div>
            <div className="text-xs text-gray-600">Needs Action</div>
          </div>
        </div>
      </div>
    </div>
  );
}
