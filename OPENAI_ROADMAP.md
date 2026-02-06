# OpenAI Implementation Roadmap - Prioritized

## Phase 1: Do Immediately (This Week)

### 1. ✅ Explicit Conversation Goals (DONE)
- Added ConversationGoal type
- Sentiment detection function created
- Ready for integration

### 2. 🔄 Responses API Migration (IN PROGRESS)
**Current:** Using `/v1/chat/completions`
**Target:** Using `/v1/responses`

**Changes needed:**
```typescript
// OLD (conversationHandler.ts line ~200)
const response = await axios.post(
  'https://api.openai.com/v1/chat/completions',
  {
    model: 'gpt-4o-mini',
    messages: conversationHistory,
    tools: availableTools,
    temperature: 0.7
  }
);

// NEW
const response = await axios.post(
  'https://api.openai.com/v1/responses',
  {
    model: 'gpt-4.1-mini', // Better reasoning, less hallucination
    input: conversationHistory,
    tools: availableTools,
    temperature: 0.6, // Slightly lower for consistency
    metadata: {
      leadId: context.contactId,
      channel: context.messageType,
      state: currentState,
      leadType: context.leadType
    }
  }
);
```

**Model Strategy:**
- `gpt-4.1-mini` → Main conversations (better reasoning)
- `gpt-4o-mini` → Email subject lines, short SMS nudges
- ❌ NO GPT-3.5 (weird behavior)

**Benefits:**
- Better tool calling
- Native multi-modal ready (voice, images later)
- Cleaner state handling
- Longer-term support

### 3. 📋 Follow-Up Suggestion Engine (HIGH ROI)

**Create:** `amplify/functions/shared/followUpSuggestions.ts`

```typescript
type FollowUpAction = 'SEND_CMA' | 'BOOK_CALL' | 'WAIT' | 'CLOSE_OUT' | 'SEND_VALUATION';

interface FollowUpSuggestion {
  type: FollowUpAction;
  reasoning: string;
  draftMessage?: string;
  urgency: 'immediate' | 'within_24h' | 'within_week' | 'low';
  confidence: number; // 0-100
}

export async function suggestNextAction(
  leadId: string,
  conversationHistory: any[],
  leadScore: number,
  daysSinceLastContact: number,
  leadType: string
): Promise<FollowUpSuggestion> {
  
  const prompt = `Analyze this real estate lead conversation and suggest the next best action.

LEAD CONTEXT:
- Type: ${leadType}
- AI Score: ${leadScore}/100
- Days since last contact: ${daysSinceLastContact}

CONVERSATION HISTORY:
${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

AVAILABLE ACTIONS:
- SEND_CMA: Send comparative market analysis
- SEND_VALUATION: Send property value estimate
- BOOK_CALL: Schedule phone consultation
- WAIT: Follow up in 3-7 days
- CLOSE_OUT: Lead is not viable

Respond in JSON format:
{
  "type": "ACTION_TYPE",
  "reasoning": "Why this action makes sense",
  "draftMessage": "Optional message to send",
  "urgency": "immediate|within_24h|within_week|low",
  "confidence": 85
}`;

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // Low for consistency
      response_format: { type: 'json_object' }
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return JSON.parse(response.data.choices[0].message.content);
}
```

**Integration:**
- Add to admin dashboard: "Get AI Suggestions" button
- Show suggestions in lead detail page
- Track which suggestions lead to conversions

**Safety:**
- ✅ AI suggests actions
- ✅ Human approves and executes
- ❌ AI never triggers actions directly

### 4. 🏷️ Sentiment Tagging (Lightweight)

**Already implemented!** Just need to:
1. Store sentiment in GHL custom field
2. Tag contacts: `sentiment:frustrated`, `sentiment:urgent`
3. Use for filtering and prioritization

---

## Phase 2: High Impact (Next 2 Weeks)

### 5. 📊 Predictive Lead Scoring (Behavior-Based)

**Enhance:** `app/utils/ai/leadScoring.ts`

**Add behavioral signals:**
```typescript
interface BehaviorSignals {
  responseTime: number; // Average minutes to respond
  messageLength: number; // Average words per message
  questionsAsked: number; // Shows engagement
  objections: string[]; // Tracks concerns
  positiveSignals: string[]; // "interested", "when can we meet"
}

// New scoring factors
const behaviorScore = {
  fastResponder: responseTime < 60 ? 15 : 0, // Responds within 1 hour
  engaged: messageLength > 10 ? 10 : 0, // Thoughtful responses
  curious: questionsAsked > 2 ? 10 : 0, // Asking questions = interest
  urgentLanguage: positiveSignals.includes('urgent') ? 15 : 0
};
```

**Update score dynamically:**
- After each message exchange
- Alert when lead becomes "hot" (score jumps 20+ points)
- Track score trajectory (improving vs declining)

### 6. 🎤 Voice Summaries → Structured Fields

**Create:** `amplify/functions/shared/voiceTranscription.ts`

```typescript
interface CallSummary {
  sellerMotivation: string;
  timeline: string;
  priceExpectation: string;
  objections: string[];
  commitments: string[];
  nextStep: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export async function transcribeAndStructure(audioUrl: string): Promise<CallSummary> {
  // Step 1: Transcribe with Whisper
  const transcription = await transcribeAudio(audioUrl);
  
  // Step 2: Extract structure with GPT-4.1-mini
  const prompt = `Extract structured information from this sales call transcript.

TRANSCRIPT:
${transcription}

Extract and return JSON:
{
  "sellerMotivation": "Why they're selling",
  "timeline": "When they need to sell",
  "priceExpectation": "What they expect to get",
  "objections": ["concern 1", "concern 2"],
  "commitments": ["what they agreed to"],
  "nextStep": "agreed next action",
  "sentiment": "positive|neutral|negative"
}`;

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return JSON.parse(response.data.choices[0].message.content);
}
```

**Benefits:**
- Queryable CRM data (not just notes)
- Track objections across all calls
- Identify patterns in successful closes

### 7. 📈 Analytics Dashboard (Conversion Per State)

**Add to admin dashboard:**
- Conversion rate by conversation state
- Average messages to booking
- Drop-off points in conversation flow
- Sentiment distribution
- Most common objections

---

## Phase 3: Advanced Features (Month 2)

### 8. 📄 CMA Generator (AI for Narrative, Not Numbers)

**Safe Implementation:**

```typescript
interface CMAData {
  subjectProperty: Property;
  comparables: Property[];
  marketTrends: MarketData;
}

export async function generateCMANarrative(data: CMAData): Promise<string> {
  // ✅ AI writes narrative
  // ❌ AI does NOT calculate prices
  
  const prompt = `Write a professional CMA narrative for this property.

SUBJECT PROPERTY:
${data.subjectProperty.address}
Value: $${data.subjectProperty.value} (calculated by system)

COMPARABLE SALES:
${data.comparables.map(c => `${c.address}: $${c.soldPrice}`).join('\n')}

MARKET TRENDS:
${data.marketTrends.summary}

Write a 2-3 paragraph narrative explaining:
1. How the subject property compares to recent sales
2. Market trends affecting value
3. Pricing recommendation context

DO NOT invent prices. Use only the provided numbers.`;

  // AI explains, system controls numbers
}
```

**Rule:** AI never invents prices. System calculates, AI explains.

### 9. 🧠 Objection Learning

**Track and improve:**
```typescript
interface ObjectionPattern {
  objection: string;
  frequency: number;
  successfulResponses: string[];
  conversionRate: number;
}

// Learn from successful conversations
// Fine-tune responses over time
// A/B test different approaches
```

### 10. 🔍 Safe Lead Enrichment

**SAFE signals only:**

```typescript
interface SafeEnrichment {
  signals: string[]; // Public record facts only
  confidence: 'high' | 'medium' | 'low';
  sources: string[]; // Where data came from
}

// ✅ SAFE
const safeSignals = [
  "Probate filing within last 90 days",
  "Out-of-state mailing address",
  "Property tax delinquent 2+ years",
  "Foreclosure auction scheduled",
  "Estate sale listing detected"
];

// ❌ UNSAFE - DO NOT DO
const unsafeSignals = [
  "Appears financially stressed", // Speculation
  "Likely motivated by divorce", // Guessing
  "Social media shows urgency" // Privacy violation
];
```

**Rule:** Public records only. Let agent infer tone, not facts.

---

## Cost Optimization Strategy

### Aggressive Caching
```typescript
// Cache system prompts (save 50%)
const cachedSystemPrompt = await cache.get('system_prompt_v1');

// Cache property data (avoid repeated API calls)
const cachedZestimate = await cache.get(`zestimate_${address}`);

// Cache conversation context (only last 5 messages)
const recentMessages = conversationHistory.slice(-5);
```

### Model Selection
- **gpt-4.1-mini** → Main conversations ($0.15/1M input)
- **gpt-4o-mini** → Short copy, subject lines ($0.15/1M input)
- ❌ **NO GPT-3.5** → Weird behavior, not worth savings

### Estimated Monthly Costs (1000 leads)
- Conversations: $20-30
- Lead scoring: $5
- Follow-up suggestions: $8
- Voice transcription: $15
- **Total: $48-58/month**

---

## Implementation Checklist

### Week 1
- [ ] Migrate to Responses API
- [ ] Integrate conversation goals into system prompt
- [ ] Add sentiment tagging to GHL
- [ ] Build follow-up suggestion engine
- [ ] Test with 10 real conversations

### Week 2
- [ ] Add behavioral signals to lead scoring
- [ ] Create analytics dashboard
- [ ] Implement voice transcription structure
- [ ] A/B test response styles by sentiment
- [ ] Monitor conversion rate changes

### Week 3-4
- [ ] Build CMA narrative generator
- [ ] Add objection tracking
- [ ] Implement safe enrichment signals
- [ ] Fine-tune based on data
- [ ] Document best practices

---

## Success Metrics

**Track these:**
- Conversion rate by conversation state
- Average messages to booking
- Sentiment distribution
- Follow-up suggestion accuracy
- Cost per conversation
- ROI per lead source

**Target Improvements:**
- 10-20% conversion boost (from goals)
- 30% faster booking time (from urgency detection)
- 50% reduction in abandoned conversations (from sentiment)
- 25% cost reduction (from caching)

---

## Key Principles

1. **AI suggests, humans decide** - Never auto-trigger actions
2. **Public records only** - No speculation on personal situations
3. **AI explains, system calculates** - Never let AI invent numbers
4. **Explicit goals** - Stop "chatting", start driving outcomes
5. **Sentiment-aware** - Adapt tone to user state
6. **Continuous learning** - Track what works, iterate

---

## Bottom Line

You're not building a chatbot.
You're building a **digital acquisition agent**.

Your architecture already reflects that. These improvements make it even more effective.
