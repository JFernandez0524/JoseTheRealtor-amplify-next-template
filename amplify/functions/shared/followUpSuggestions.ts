import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

type FollowUpAction = 'SEND_CMA' | 'BOOK_CALL' | 'WAIT' | 'CLOSE_OUT' | 'SEND_VALUATION';

export interface FollowUpSuggestion {
  type: FollowUpAction;
  reasoning: string;
  draftMessage?: string;
  urgency: 'immediate' | 'within_24h' | 'within_week' | 'low';
  confidence: number; // 0-100
}

/**
 * Suggest next best action for a lead based on conversation history and context
 * 
 * AI suggests actions, humans approve and execute (never auto-trigger)
 */
export async function suggestNextAction(
  leadId: string,
  conversationHistory: Array<{ role: string; content: string }>,
  leadScore: number,
  daysSinceLastContact: number,
  leadType: string,
  propertyValue?: number
): Promise<FollowUpSuggestion> {
  
  const prompt = `Analyze this real estate lead conversation and suggest the next best action.

LEAD CONTEXT:
- Lead ID: ${leadId}
- Type: ${leadType}
- AI Score: ${leadScore}/100
- Days since last contact: ${daysSinceLastContact}
${propertyValue ? `- Property Value: $${propertyValue.toLocaleString()}` : ''}

CONVERSATION HISTORY (last 10 messages):
${conversationHistory.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n')}

AVAILABLE ACTIONS:
- SEND_CMA: Send comparative market analysis (for sellers ready to see comps)
- SEND_VALUATION: Send property value estimate (for sellers asking about value)
- BOOK_CALL: Schedule phone consultation (for engaged, qualified leads)
- WAIT: Follow up in 3-7 days (for leads needing time)
- CLOSE_OUT: Lead is not viable (clearly not interested or already working with someone)

RULES:
- If they asked about value → SEND_VALUATION
- If they're comparing options → SEND_CMA
- If they're engaged and asking questions → BOOK_CALL
- If they said "not now" or "busy" → WAIT
- If they said "not interested" or "have an agent" → CLOSE_OUT
- High urgency (foreclosure, probate) → prioritize BOOK_CALL

Respond in JSON format:
{
  "type": "ACTION_TYPE",
  "reasoning": "Brief explanation why this action makes sense",
  "draftMessage": "Optional message to send (keep it casual, 1-2 sentences)",
  "urgency": "immediate|within_24h|within_week|low",
  "confidence": 85
}`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini', // Using 4o-mini for decision-making (4.1-mini when available)
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, // Low for consistency in decision-making
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const suggestion = JSON.parse(response.data.choices[0].message.content);
    
    // Validate response structure
    if (!suggestion.type || !suggestion.reasoning) {
      throw new Error('Invalid suggestion format from OpenAI');
    }

    console.log(`💡 Follow-up suggestion for ${leadId}: ${suggestion.type} (${suggestion.confidence}% confidence)`);
    
    return suggestion;
  } catch (error: any) {
    console.error('Failed to generate follow-up suggestion:', error);
    
    // Fallback suggestion based on simple rules
    if (daysSinceLastContact > 7) {
      return {
        type: 'WAIT',
        reasoning: 'Lead has gone cold, wait for them to re-engage',
        urgency: 'low',
        confidence: 50
      };
    }
    
    if (leadScore > 70) {
      return {
        type: 'BOOK_CALL',
        reasoning: 'High-scoring lead, worth a direct call',
        draftMessage: 'Hey! Quick question - would you be open to a 10-min call to discuss your options?',
        urgency: 'within_24h',
        confidence: 60
      };
    }
    
    return {
      type: 'WAIT',
      reasoning: 'Unable to analyze conversation, default to waiting',
      urgency: 'within_week',
      confidence: 40
    };
  }
}
