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
  const safeMessage = typeof message === 'string' ? message : '';
  if (!safeMessage.trim()) {
    return {
      intent: 'CONVERSATION',
      sentiment: 'NEUTRAL',
      confidence: 1.0,
      reason: 'No message content provided'
    };
  }

  // Guard 1: Pure email address or phone number (e.g. "Ccavallone1@gmail.com" sent in response to "what is your email?")
  // This is active engagement providing contact details, NEVER an objection/STOP.
  const isPureEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeMessage.trim());
  if (isPureEmail) {
    return {
      intent: 'CONVERSATION',
      sentiment: 'POSITIVE',
      confidence: 1.0,
      reason: 'Lead provided email address',
    };
  }

  // Check for wrong info / authority mismatch keywords (including wrong email and tenant/landlord)
  const wrongInfoPatterns = [
    /\bnot\s+([a-z0-9'\s]+)?\bemail\b/i,
    /\bwrong\s+email\b/i,
    /\b(he|she|they)\s+(?:was|is)\s+my\s+(?:landlord|tenant)\b/i,
    /\b(?:my\s+old|former)\s+(?:landlord|tenant)\b/i,
    /\bused\s+to\s+rent\b/i,
    /\bwrong\s+number\b/i,
    /\bwrong\s+person\b/i,
    /\bnot\s+me\b/i,
    /\bincorrect\b/i,
    /\byou\s+have\s+the\s+wrong\b/i,
    /\bnot\s+my\s+(?:property|house|home)\b/i,
    /\bnot\s+(?:the\s+)?owner\b/i,
    /\bdon'?t\s+own\b/i,
    /\bdo\s+not\s+own\b/i,
    /\bnever\s+owned\b/i,
    /\bwrong\s+contact\b/i,
    /\bdoes(?:n't|\s+not)\s+belong\s+to\s+me\b/i,
    /\bnot\s+mine\b/i,
  ];

  const hasWrongInfo = wrongInfoPatterns.some((pattern) => pattern.test(safeMessage));
  if (hasWrongInfo) {
    console.log(`🤖 [SENTIMENT] Intent: WRONG_INFO, Sentiment: NEUTRAL - Wrong contact/email detected`);
    return {
      intent: 'WRONG_INFO',
      sentiment: 'NEUTRAL',
      confidence: 0.95,
      reason: 'Wrong contact information detected',
    };
  }

  // Detect sentiment using existing logic
  const sentiment = await detectSentiment(safeMessage);
  
  // Map sentiment to intent
  let intent: LeadIntent = 'CONVERSATION';
  let reason = '';
  
  if (sentiment === 'DISENGAGING') {
    intent = 'STOP';
    reason = 'Lead is disengaging - wants to stop communication';
  } else {
    intent = 'CONVERSATION';
    reason = `Lead is ${sentiment?.toLowerCase() || 'engaging'} in conversation`;
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
  const safeMessage = typeof message === 'string' ? message : '';
  if (!safeMessage.trim()) return null;

  // Standalone email address is engaging/providing contact info, NOT an objection
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeMessage.trim())) {
    return 'POSITIVE';
  }

  // Check for objection keywords first (fast, local). This MUST run before the short-message
  // guard below — otherwise literal opt-outs like "Stop" / "quit" (<= 10 chars) return null
  // and get misclassified as CONVERSATION, so the lead never gets marked DND and we attempt a
  // doomed AI reply to someone who just unsubscribed.
  const objectionKeywords = [
    'not interested', 'stop', 'remove', 'unsubscribe', 'leave me alone',
    'busy', 'later', 'not for sale', 'not selling', 'never selling',
    'realtor', 'listed', 'agent', 'already sold', 'sold'
  ];
  if (objectionKeywords.some(kw => safeMessage.toLowerCase().includes(kw))) {
    return 'DISENGAGING';
  }

  // Skip the (paid) OpenAI classification for trivially short, non-objection messages.
  if (safeMessage.length <= 10) return null;

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
