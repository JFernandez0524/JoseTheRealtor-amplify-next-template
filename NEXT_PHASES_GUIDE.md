# Quick Start Guide: Next AI Features

## Phase 2: Direct Mail AI Generator

### Goal
Generate personalized direct mail letters for leads marked as DIRECT_MAIL status.

### Implementation Steps

1. **Create Direct Mail Generator** (`/app/utils/ai/directMailGenerator.ts`)
```typescript
import Anthropic from '@anthropic-ai/sdk';

export async function generateDirectMailLetter(lead: Lead): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  
  const prompt = `Generate a personalized direct mail letter for:
  - Owner: ${lead.ownerFirstName} ${lead.ownerLastName}
  - Property: ${lead.ownerAddress}, ${lead.ownerCity}, ${lead.ownerState}
  - Type: ${lead.type}
  - Value: $${lead.zestimate}
  
  Write a compassionate, professional letter offering to buy their property.`;
  
  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  
  return message.content[0].text;
}
```

2. **Create API Route** (`/app/api/v1/ai/generate-letter/route.ts`)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateDirectMailLetter } from '@/app/utils/ai/directMailGenerator';
import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

export async function POST(request: NextRequest) {
  const { leadId } = await request.json();
  const { data: lead } = await cookiesClient.models.PropertyLead.get({ id: leadId });
  
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  
  const letter = await generateDirectMailLetter(lead);
  
  return NextResponse.json({ letter });
}
```

3. **Add Button to Lead Detail Page**
```typescript
{lead.manualStatus === 'DIRECT_MAIL' && (
  <button onClick={handleGenerateLetter}>
    📧 Generate Direct Mail Letter
  </button>
)}
```

---

## Phase 3: Predictive Analytics

### Goal
Predict deal probability, timeline, and offer range using historical data.

### Implementation Steps

1. **Create Analytics Engine** (`/app/utils/ai/predictiveAnalytics.ts`)
```typescript
export function predictDealProbability(lead: Lead): number {
  // Factors: aiScore, contact availability, property value, lead age
  const baseScore = lead.aiScore || 50;
  const hasContact = (lead.phones?.length || 0) > 0 ? 20 : 0;
  const isActive = lead.manualStatus === 'ACTIVE' ? 10 : 0;
  
  return Math.min(100, baseScore + hasContact + isActive);
}

export function predictTimeline(lead: Lead): string {
  const probability = predictDealProbability(lead);
  
  if (probability > 70) return '30-60 days';
  if (probability > 40) return '60-90 days';
  return '90+ days';
}

export function suggestOfferRange(lead: Lead): { min: number; max: number } {
  const zestimate = lead.zestimate || 0;
  
  // 70% rule for wholesaling
  const max = Math.round(zestimate * 0.70);
  const min = Math.round(zestimate * 0.60);
  
  return { min, max };
}
```

2. **Add to Lead Detail Page**
```typescript
const analytics = {
  probability: predictDealProbability(lead),
  timeline: predictTimeline(lead),
  offerRange: suggestOfferRange(lead),
};

<div className="bg-blue-50 p-4 rounded">
  <h3>📊 Predictive Analytics</h3>
  <p>Deal Probability: {analytics.probability}%</p>
  <p>Expected Timeline: {analytics.timeline}</p>
  <p>Suggested Offer: ${analytics.offerRange.min.toLocaleString()} - ${analytics.offerRange.max.toLocaleString()}</p>
</div>
```

---

## Phase 4: Market Trends Dashboard

### Goal
Show aggregate market data by county/zip for competitive intelligence.

### Implementation Steps

1. **Create Market Analysis** (`/app/utils/ai/marketAnalysis.ts`)
```typescript
export function analyzeMarketTrends(leads: Lead[]) {
  const byCounty = leads.reduce((acc, lead) => {
    const county = lead.ownerCounty || 'Unknown';
    if (!acc[county]) acc[county] = [];
    acc[county].push(lead);
    return acc;
  }, {} as Record<string, Lead[]>);
  
  return Object.entries(byCounty).map(([county, countyLeads]) => ({
    county,
    totalLeads: countyLeads.length,
    avgValue: countyLeads.reduce((sum, l) => sum + (l.zestimate || 0), 0) / countyLeads.length,
    highPriority: countyLeads.filter(l => l.aiPriority === 'HIGH').length,
  }));
}
```

2. **Create Market Trends Component**
```typescript
export function MarketTrendsCard({ leads }: { leads: Lead[] }) {
  const trends = analyzeMarketTrends(leads);
  
  return (
    <div className="bg-white p-6 rounded shadow">
      <h2>📈 Market Trends</h2>
      {trends.map(trend => (
        <div key={trend.county}>
          <h3>{trend.county} County</h3>
          <p>Leads: {trend.totalLeads}</p>
          <p>Avg Value: ${trend.avgValue.toLocaleString()}</p>
          <p>High Priority: {trend.highPriority}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## Phase 5: Automated Offer Generator

### Goal
Calculate ARV, repair costs, and generate offer letters automatically.

### Implementation Steps

1. **Create Offer Calculator** (`/app/utils/ai/offerGenerator.ts`)
```typescript
export function calculateOffer(lead: Lead) {
  const arv = lead.zestimate || 0; // After Repair Value
  const estimatedRepairs = arv * 0.15; // Assume 15% repairs
  const maxOffer = (arv * 0.70) - estimatedRepairs; // 70% rule
  
  return {
    arv,
    estimatedRepairs,
    maxOffer: Math.round(maxOffer),
    profitMargin: Math.round(arv - maxOffer - estimatedRepairs),
  };
}

export async function generateOfferLetter(lead: Lead, offer: any): Promise<string> {
  // Use Claude to generate professional offer letter
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  
  const prompt = `Generate a professional offer letter:
  - Property: ${lead.ownerAddress}
  - ARV: $${offer.arv}
  - Offer Amount: $${offer.maxOffer}
  - Cash offer, quick close`;
  
  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  
  return message.content[0].text;
}
```

---

## Phase 6: Email Drip Campaigns

### Goal
Automated email sequences integrated with GoHighLevel.

### Implementation Steps

1. **Create Campaign Templates** (`/app/utils/ai/emailCampaigns.ts`)
```typescript
export const dripCampaigns = {
  preforeclosure: [
    { day: 0, subject: 'We Can Help Save Your Home', template: 'intro' },
    { day: 3, subject: 'Quick Cash Offer - No Obligation', template: 'offer' },
    { day: 7, subject: 'Last Chance to Avoid Foreclosure', template: 'urgency' },
  ],
  probate: [
    { day: 0, subject: 'Our Condolences - We Can Help', template: 'compassion' },
    { day: 5, subject: 'Simplify Estate Settlement', template: 'solution' },
    { day: 10, subject: 'Fair Cash Offer for Estate Property', template: 'offer' },
  ],
};

export async function sendDripEmail(lead: Lead, campaignStep: any) {
  // Integrate with GHL email API
  const response = await fetch('https://rest.gohighlevel.com/v1/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contactId: lead.ghlContactId,
      subject: campaignStep.subject,
      body: await generateEmailBody(lead, campaignStep.template),
    }),
  });
  
  return response.json();
}
```

---

## Phase 7: Voice AI Integration

### Goal
Automated phone calls using Bland AI or Vapi.

### Implementation Steps

1. **Create Voice AI Handler** (`/app/utils/ai/voiceAI.ts`)
```typescript
export async function initiateCall(lead: Lead) {
  const response = await fetch('https://api.bland.ai/v1/calls', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.BLAND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone_number: lead.phones?.[0],
      task: `You are calling ${lead.ownerFirstName} about their property at ${lead.ownerAddress}. 
             Introduce yourself as a real estate investor interested in making a cash offer.`,
      voice: 'maya',
      record: true,
    }),
  });
  
  return response.json();
}

export async function processCallTranscript(callId: string, leadId: string) {
  // Fetch transcript from Bland AI
  const transcript = await fetchTranscript(callId);
  
  // Use Claude to analyze sentiment and extract key info
  const analysis = await analyzeCallWithClaude(transcript);
  
  // Update lead status based on call outcome
  await updateLeadFromCall(leadId, analysis);
}
```

---

## Environment Variables Needed

Add to `.env.local`:
```env
# AI Services
ANTHROPIC_API_KEY=your_anthropic_key

# Voice AI (choose one)
BLAND_API_KEY=your_bland_key
VAPI_API_KEY=your_vapi_key

# Email (if not using GHL)
SENDGRID_API_KEY=your_sendgrid_key
```

---

## Priority Order Recommendation

1. **Phase 2** (Direct Mail) - Quick win, high user value
2. **Phase 3** (Predictive Analytics) - Enhances decision-making
3. **Phase 5** (Offer Generator) - Automates core workflow
4. **Phase 4** (Market Trends) - Strategic insights
5. **Phase 6** (Email Campaigns) - Requires GHL setup
6. **Phase 7** (Voice AI) - Most complex, highest impact

---

**Current Status**: Phase 1 Complete ✅  
**Next Recommended**: Phase 2 (Direct Mail AI)
