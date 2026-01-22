# AI Features Implementation Plan

## ✅ Completed (Phase 1) - DONE!
1. ✅ Created `/app/utils/ai/leadScoring.ts` - AI scoring engine
2. ✅ Added AI fields to schema (aiScore, aiPriority, aiInsights, aiLastCalculated)
3. ✅ Created `/app/api/v1/ai/score-leads/route.ts` - API to calculate scores
4. ✅ Created `AIInsightsDashboard` component - Shows top leads, urgent, best ROI
5. ✅ Added AI Score column to LeadTable (after Type column)
6. ✅ Added AI Priority filter to DashboardFilters
7. ✅ Integrated AIInsightsDashboard into LeadDashboardClient
8. ✅ Added "Calculate AI Scores" button to dashboard
9. ✅ Updated sorting to include aiScore

## 🚧 TODO (Remaining Implementation)

### Phase 2: Direct Mail AI
- [ ] Create `/app/utils/ai/directMailGenerator.ts`
- [ ] Create `/app/api/v1/ai/generate-letter/route.ts`
- [ ] Add "Generate Letter" button for DIRECT_MAIL leads
- [ ] Export letters as PDF/Word

### Phase 3: Predictive Analytics
- [ ] Create `/app/utils/ai/predictiveAnalytics.ts`
- [ ] Add deal probability calculation
- [ ] Add expected timeline prediction
- [ ] Add suggested offer range calculation

### Phase 4: Market Trends
- [ ] Create `/app/utils/ai/marketAnalysis.ts`
- [ ] Aggregate data by county/zip
- [ ] Calculate average days to close
- [ ] Track price trends
- [ ] Show competition level

### Phase 5: Automated Offers
- [ ] Create `/app/utils/ai/offerGenerator.ts`
- [ ] Calculate ARV (After Repair Value)
- [ ] Estimate repair costs
- [ ] Apply 70% rule
- [ ] Generate offer letter PDF

### Phase 6: Email Campaigns
- [ ] Create drip campaign templates
- [ ] Integrate with GHL email API
- [ ] Personalize emails with AI
- [ ] Track open/click rates

### Phase 7: Voice AI
- [ ] Research Bland AI / Vapi integration
- [ ] Create phone call workflow
- [ ] Transcribe conversations
- [ ] Update lead status from calls

## Integration Points
- All utilities use existing `lead.server.ts` for data access
- All APIs use existing auth utilities
- All components integrate with existing dashboard
- No code duplication - reuse existing patterns
