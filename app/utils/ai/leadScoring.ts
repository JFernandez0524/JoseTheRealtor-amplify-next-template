// app/utils/ai/leadScoring.ts
import type { Schema } from '../../../amplify/data/resource';

type Lead = Schema['PropertyLead']['type'];

export interface LeadScore {
  score: number; // 0-100
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  factors: {
    equity: number;
    value: number;
    timeline: number;
    location: number;
    contact: number;
  };
  insights: string[];
}

/**
 * Calculate AI-powered lead score (0-100)
 */
export function calculateLeadScore(lead: Lead): LeadScore {
  const factors = {
    equity: calculateEquityScore(lead),
    value: calculateValueScore(lead),
    timeline: calculateTimelineScore(lead),
    location: calculateLocationScore(lead),
    contact: calculateContactScore(lead),
  };

  // Weighted average
  const score = Math.round(
    factors.equity * 0.3 +
    factors.value * 0.25 +
    factors.timeline * 0.2 +
    factors.location * 0.15 +
    factors.contact * 0.1
  );

  const priority = score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
  const insights = generateInsights(lead, factors, score);

  return { score, priority, factors, insights };
}

function calculateEquityScore(lead: Lead): number {
  const zestimate = lead.zestimate || lead.estimatedValue || 0;
  if (zestimate === 0) return 50; // Unknown = medium score

  // High equity = high score
  if (zestimate > 400000) return 90;
  if (zestimate > 300000) return 80;
  if (zestimate > 200000) return 70;
  if (zestimate > 150000) return 60;
  return 40;
}

function calculateValueScore(lead: Lead): number {
  const zestimate = lead.zestimate || lead.estimatedValue || 0;
  if (zestimate === 0) return 30;

  // Higher value = better deal potential
  if (zestimate > 500000) return 95;
  if (zestimate > 350000) return 85;
  if (zestimate > 250000) return 75;
  if (zestimate > 150000) return 60;
  return 40;
}

function calculateTimelineScore(lead: Lead): number {
  const createdAt = lead.createdAt ? new Date(lead.createdAt) : new Date();
  const ageInDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  // Fresh leads = higher score
  if (ageInDays <= 7) return 90;
  if (ageInDays <= 14) return 80;
  if (ageInDays <= 30) return 70;
  if (ageInDays <= 60) return 50;
  return 30;
}

function calculateLocationScore(lead: Lead): number {
  const state = lead.ownerState?.toUpperCase();
  const county = lead.ownerCounty?.toLowerCase();

  // High-value states
  const highValueStates = ['CA', 'NY', 'FL', 'TX', 'WA', 'CO'];
  if (highValueStates.includes(state || '')) return 80;

  // Medium-value states
  const mediumValueStates = ['GA', 'NC', 'VA', 'AZ', 'NV', 'OR'];
  if (mediumValueStates.includes(state || '')) return 65;

  return 50; // Default
}

function calculateContactScore(lead: Lead): number {
  const hasPhone = (lead.phones?.length || 0) > 0;
  const hasEmail = (lead.emails?.length || 0) > 0;
  const skipTraceStatus = lead.skipTraceStatus?.toUpperCase();

  if (hasPhone && hasEmail) return 100;
  if (hasPhone) return 80;
  if (hasEmail) return 60;
  if (skipTraceStatus === 'COMPLETED') return 70;
  if (skipTraceStatus === 'PENDING') return 40;
  return 20; // No contact info
}

function generateInsights(lead: Lead, factors: any, score: number): string[] {
  const insights: string[] = [];

  // High priority insights
  if (score >= 70) {
    insights.push('🔥 High-priority lead - contact immediately');
  }

  // Equity insights
  const zestimate = lead.zestimate || lead.estimatedValue || 0;
  if (zestimate > 400000) {
    insights.push(`💰 High-value property ($${(zestimate / 1000).toFixed(0)}k)`);
  }

  // Timeline insights
  const createdAt = lead.createdAt ? new Date(lead.createdAt) : new Date();
  const ageInDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  if (ageInDays <= 7) {
    insights.push('🆕 Fresh lead - act fast');
  } else if (ageInDays > 30) {
    insights.push('⏰ Aging lead - follow up urgently');
  }

  // Contact insights
  const hasPhone = (lead.phones?.length || 0) > 0;
  if (!hasPhone && lead.skipTraceStatus !== 'COMPLETED') {
    insights.push('📞 Skip trace needed for contact info');
  }

  // Status insights
  if (lead.listingStatus === 'pending') {
    insights.push('⏳ Deal in progress - follow up');
  }

  // Zestimate age
  if (lead.zillowLastUpdated) {
    const zestimateAge = Math.floor((Date.now() - new Date(lead.zillowLastUpdated).getTime()) / (1000 * 60 * 60 * 24));
    if (zestimateAge > 180) {
      insights.push('🔄 Refresh Zestimate for current value');
    }
  }

  return insights.slice(0, 3); // Max 3 insights
}

/**
 * Get top leads by score
 */
export function getTopLeads(leads: Lead[], limit: number = 5): Lead[] {
  return leads
    .map(lead => ({ lead, score: calculateLeadScore(lead).score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.lead);
}

/**
 * Get leads that need urgent attention
 */
export function getUrgentLeads(leads: Lead[]): Lead[] {
  return leads.filter(lead => {
    const createdAt = lead.createdAt ? new Date(lead.createdAt) : new Date();
    const ageInDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    // Urgent if: >30 days old AND high value AND not contacted
    return (
      ageInDays > 30 &&
      (lead.zestimate || lead.estimatedValue || 0) > 200000 &&
      lead.listingStatus !== 'sold' &&
      lead.listingStatus !== 'skip'
    );
  }).slice(0, 5);
}

/**
 * Get best ROI opportunities
 */
export function getBestROILeads(leads: Lead[]): Lead[] {
  return leads
    .filter(lead => {
      const zestimate = lead.zestimate || lead.estimatedValue || 0;
      const hasContact = (lead.phones?.length || 0) > 0;
      return zestimate > 250000 && hasContact && lead.listingStatus === 'active';
    })
    .sort((a, b) => (b.zestimate || 0) - (a.zestimate || 0))
    .slice(0, 5);
}
