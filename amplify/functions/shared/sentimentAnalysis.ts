/**
 * AI SENTIMENT ANALYSIS
 * 
 * Analyzes incoming messages to determine lead intent for queue management.
 * Uses existing GHL conversation_sentiment field (vjhwCk3Ns0ekDEbMsuy5).
 * 
 * Maps sentiment to queue actions:
 * - DISENGAGING → STOP (lead wants to opt out)
 * - FRUSTRATED + wrong info keywords → WRONG_INFO (wrong contact)
 * - POSITIVE/NEUTRAL/URGENT → CONVERSATION (continue engagement)
 */

import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export type LeadIntent = 'STOP' | 'WRONG_INFO' | 'CONVERSATION';
export type ConversationSentiment = 'POSITIVE' | 'NEUTRAL' | 'FRUSTRATED' | 'URGENT' | 'DISENGAGING';

export interface SentimentAnalysis {
  intent: LeadIntent;
  sentiment: ConversationSentiment;
  confidence: number;
  reason: string;
}

/**
 * Analyze lead's message to determine intent and sentiment
 * Uses existing detectSentiment logic from conversationHandler
 * 
 * @param message - The message from the lead
 * @returns Sentiment analysis with intent classification
 */
export async function analyzeLeadIntent(message: string): Promise<SentimentAnalysis> {
  // Detect sentiment using existing logic
  const sentiment = await detectSentiment(message);
  
  // Map sentiment to intent
  let intent: LeadIntent = 'CONVERSATION';
  let reason = '';
  
  if (sentiment === 'DISENGAGING') {
    intent = 'STOP';
    reason = 'Lead is disengaging - wants to stop communication';
  } else {
    // Check for wrong info keywords
    const wrongInfoKeywords = ['wrong number', 'wrong email', 'wrong person', 'not me', 'incorrect', 'you have the wrong'];
    const hasWrongInfo = wrongInfoKeywords.some(kw => message.toLowerCase().includes(kw));
    
    if (hasWrongInfo) {
      intent = 'WRONG_INFO';
      reason = 'Wrong contact information detected';
    } else {
      intent = 'CONVERSATION';
      reason = `Lead is ${sentiment?.toLowerCase() || 'engaging'} in conversation`;
    }
  }
  
  console.log(`🤖 [SENTIMENT] Intent: ${intent}, Sentiment: ${sentiment} - ${reason}`);
  
  return {
    intent,
    sentiment: sentiment || 'NEUTRAL',
    confidence: 0.9,
    reason
  };
}

/**
 * Detect conversation sentiment (reused from conversationHandler)
 * Classifies as: POSITIVE | NEUTRAL | FRUSTRATED | URGENT | DISENGAGING
 */
async function detectSentiment(message: string): Promise<ConversationSentiment | null> {
  if (message.length <= 10) return null;
  
  // Check for objection keywords first (fast path)
  const objectionKeywords = ['not interested', 'stop', 'remove', 'unsubscribe', 'leave me alone', 'busy', 'later'];
  if (objectionKeywords.some(kw => message.toLowerCase().includes(kw))) {
    return 'DISENGAGING';
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: 'Classify the user\'s message as: POSITIVE | NEUTRAL | FRUSTRATED | URGENT | DISENGAGING\n\nOnly return the label.'
        }, {
          role: 'user',
          content: message
        }],
        temperature: 0,
        max_tokens: 10
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const sentiment = response.data.choices[0].message.content.trim().toUpperCase();
    if (['POSITIVE', 'NEUTRAL', 'FRUSTRATED', 'URGENT', 'DISENGAGING'].includes(sentiment)) {
      return sentiment as ConversationSentiment;
    }
    return 'NEUTRAL';
  } catch (error: any) {
    console.error('❌ [SENTIMENT] Analysis failed:', error.message);
    return null;
  }
}
