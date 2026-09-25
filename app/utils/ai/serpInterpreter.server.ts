import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export interface AiSerpInterpretation {
  listingStatus: 'active' | 'pending' | 'sold' | 'off_market';
  lastSaleAmount?: number | null;
  lastSaleDate?: string | null;
  listPrice?: number | null;
  mlsNumber?: string | null;
  propertyType?: string | null;
  isCondo?: boolean;
  is55Plus?: boolean;
  hoaFee?: number | null;
  confidence?: number;
  reasoning: string;
}

export interface SerpSearchResultItem {
  title?: string;
  link?: string;
  snippet?: string;
}

/**
 * Interprets Google search results from Zillow, Redfin, Realtor.com, etc.
 * using OpenAI gpt-4o-mini to accurately extract listing status and resolve conflicting portals.
 */
export async function interpretSerpWithAi(params: {
  address: string;
  city: string;
  state: string;
  zip?: string;
  items: SerpSearchResultItem[];
}): Promise<AiSerpInterpretation | null> {
  const apiKey = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ [SERP_AI] OPENAI_API_KEY is not configured; skipping AI SERP interpretation.');
    return null;
  }

  if (!params.items || params.items.length === 0) {
    return null;
  }

  const promptText = `Property Target:
Address: ${params.address}, ${params.city}, ${params.state} ${params.zip || ''}

Search Result Snippets:
${params.items
  .slice(0, 8)
  .map(
    (item, idx) =>
      `[Result ${idx + 1}]
Source: ${item.link || 'unknown'}
Title: ${item.title || ''}
Snippet: ${item.snippet || ''}`,
  )
  .join('\n\n')}

Analyze these snippets to determine the property's true current status and specifications.`;

  const systemPrompt = `You are a real estate MLS intelligence specialist analyzing public search engine listings (Zillow, Realtor.com, Redfin, Homes.com) for a target property.

Portals often display conflicting text:
- Zillow boilerplate: Zillow displays "is currently not for sale" for any property not actively on market, even when recently sold.
- Closed Sales: Redfin and Realtor frequently report authoritative closed MLS sales (e.g. "sold for $900,000 on Jun 6, 2025. MLS# 22508202" or "Last sold $900K in 2025"). When a property closed on MLS with a sale price and date/year, its listingStatus is "sold".
- Active: Marked "for sale", active MLS listing, or currently asking a list price.
- Pending: Marked "pending", "under contract", or "contingent".
- Off Market: Unlisted residential home with no recent sale transaction.

Respond ONLY with valid JSON with this exact schema:
{
  "listingStatus": "active" | "pending" | "sold" | "off_market",
  "lastSaleAmount": number | null,
  "lastSaleDate": string | null (YYYY-MM-DD or YYYY if month unknown),
  "listPrice": number | null,
  "mlsNumber": string | null,
  "propertyType": string | null (e.g. "Single Family", "Condo/Co-op", "Townhouse"),
  "isCondo": boolean,
  "is55Plus": boolean,
  "hoaFee": number | null (monthly HOA fee),
  "confidence": number (between 0.0 and 1.0),
  "reasoning": string (1 concise sentence explaining your status deduction and citing the source)
}`;

  try {
    console.log(`🤖 [SERP_AI] Summoning gpt-4o-mini to interpret SERP for: ${params.address}, ${params.city}`);
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptText },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 300,
        temperature: 0,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 7000, // 7-second guardrail
      },
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed: AiSerpInterpretation = JSON.parse(content);
    console.log(`✅ [SERP_AI] AI Status: ${parsed.listingStatus} | Reasoning: ${parsed.reasoning}`);
    return parsed;
  } catch (err: any) {
    console.warn(`⚠️ [SERP_AI] AI SERP interpretation failed: ${err?.message || err}`);
    return null;
  }
}
