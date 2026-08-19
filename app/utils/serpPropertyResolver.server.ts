// app/utils/serpPropertyResolver.server.ts
/**
 * SERP Property & Listing Status Resolver
 *
 * Uses Serper (Google Search API) to resolve:
 * 1. Zillow ZPID & URL (to bypass address mismatch errors in Bridge API)
 * 2. Real-time listing status ('active' | 'sold' | 'pending' | 'off_market')
 * 3. Recent MLS sale info (lastSaleAmount, lastSaleDate, mlsNumber)
 * 4. Property details (beds, baths, sqft, yearBuilt, propertyType, hoaFee, annualTaxes, 55+ community tag)
 *
 * Integrates directly with `analyzeBridgeProperty` via `zpid` for 100% reliable Zestimates.
 */
import axios from 'axios';

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_URL = 'https://google.serper.dev/search';

export interface SerpOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
  attributes?: Record<string, string>;
}

export interface SerpPropertyData {
  zpid?: string;
  zillowUrl?: string;
  listingStatus: 'active' | 'sold' | 'pending' | 'off_market';
  listPrice?: number;
  lastSaleAmount?: number;
  lastSaleDate?: string; // YYYY-MM-DD
  mlsNumber?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  propertyType?: string;
  hoaFee?: number;
  annualTaxes?: number;
  is55Plus?: boolean;
  community?: string;
  rawSnippets?: string[];
}

export interface SerpResolutionResult {
  success: boolean;
  data: SerpPropertyData | null;
  bridgeValuation?: any | null;
  error?: string;
}

/**
 * Format date string (e.g. "May 7, 2026", "05/20/2026", "2026-05-07") to YYYY-MM-DD
 */
export function normalizeDateToIso(dateStr?: string | null): string | undefined {
  if (!dateStr) return undefined;
  const cleaned = dateStr.trim();
  const isoMatch = /^\d{4}-\d{2}-\d{2}/.exec(cleaned);
  if (isoMatch) return isoMatch[0];

  const parsed = new Date(cleaned);
  if (isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

/**
 * Parses numeric currency strings like "$1,050,000", "$200K", "$360000" into numbers.
 */
export function parseCurrencyAmount(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[$,\s]/g, '').toLowerCase();
  if (cleaned.endsWith('k')) {
    const num = parseFloat(cleaned.slice(0, -1));
    return isNaN(num) ? undefined : Math.round(num * 1000);
  }
  if (cleaned.endsWith('m')) {
    const num = parseFloat(cleaned.slice(0, -1));
    return isNaN(num) ? undefined : Math.round(num * 1000000);
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/**
 * Pure parsing function to extract structured property intelligence from search organic results.
 */
export function parseSerpResults(
  _query: string,
  organic: SerpOrganicResult[]
): SerpPropertyData {
  const result: SerpPropertyData = {
    listingStatus: 'off_market',
    rawSnippets: [],
  };

  if (!organic || organic.length === 0) {
    return result;
  }

  let foundSold = false;
  let foundActive = false;
  let foundPending = false;
  let dateHasExplicitDay = false;

  const hasExplicitDay = (str?: string) =>
    str ? /[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/.test(str) : false;

  for (const item of organic) {
    const title = item.title || '';
    const link = item.link || '';
    const snippet = item.snippet || '';
    const text = `${title} ${snippet}`;
    if (snippet) result.rawSnippets?.push(snippet);

    // 1. Extract Zillow ZPID & URL
    if (link.includes('zillow.com')) {
      const zpidMatch = link.match(/\/(\d+)_zpid/);
      if (zpidMatch && !result.zpid) {
        result.zpid = zpidMatch[1];
        result.zillowUrl = link;
      }
    }

    // 2. Extract MLS Number
    if (!result.mlsNumber) {
      const mlsMatch = text.match(/MLS#?\s*([A-Za-z0-9]+)/i);
      if (mlsMatch) {
        result.mlsNumber = mlsMatch[1];
      }
    }

    // 3. Extract HOA / Association Fee
    if (result.hoaFee === undefined) {
      const hoaMatch = text.match(
        /(?:association\s+fee|hoa\s+fee|association|hoa):?\s*\$?([0-9,]+)/i
      );
      if (hoaMatch) {
        result.hoaFee = parseCurrencyAmount(hoaMatch[1]);
      }
    }

    // 4. Extract Annual Taxes
    if (result.annualTaxes === undefined) {
      const taxMatch = text.match(
        /(?:annual\s+tax\s+amount|annual\s+taxes?|property\s+taxes?):?\s*\$?([0-9,]+)/i
      );
      if (taxMatch) {
        result.annualTaxes = parseCurrencyAmount(taxMatch[1]);
      }
    }

    // 5. Extract 55+ Community Tag
    if (!result.is55Plus) {
      if (/55\+\s*(?:adult|active)?\s*community|active\s+adult\s+community/i.test(text)) {
        result.is55Plus = true;
        result.community = '55+ Active Adult Community';
      }
    }

    // 6. Extract Beds
    if (result.beds === undefined) {
      const bedMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:beds?|bedrooms?|bd)\b/i);
      if (bedMatch) {
        result.beds = parseFloat(bedMatch[1]);
      }
    }

    // 7. Extract Baths
    if (result.baths === undefined) {
      const bathMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:baths?|bathrooms?|ba)\b/i);
      if (bathMatch) {
        result.baths = parseFloat(bathMatch[1]);
      }
    }

    // 8. Extract Sqft
    if (result.sqft === undefined) {
      const sqftMatch = text.match(/([0-9,]+)\s*(?:sq\s*ft|sqft|square\s*feet)\b/i);
      if (sqftMatch) {
        result.sqft = parseCurrencyAmount(sqftMatch[1]);
      }
    }

    // 9. Extract Year Built
    if (result.yearBuilt === undefined) {
      const yrMatch = text.match(/(?:built\s+in|year\s+built:?)\s*(\d{4})\b/i);
      if (yrMatch) {
        result.yearBuilt = parseInt(yrMatch[1], 10);
      }
    }

    // 10. Extract Property Type
    if (!result.propertyType) {
      const styleMatch = text.match(/(?:style|type):\s*([^.,;\n]+)/i);
      if (styleMatch) {
        result.propertyType = styleMatch[1].trim();
      } else if (/\bcondo\b|\bco-op\b/i.test(text)) {
        result.propertyType = 'Condo/Co-op';
      } else if (/\btownhouse\b|\btownhome\b/i.test(text)) {
        result.propertyType = 'Townhouse';
      } else if (/\bsingle\s+family\b|\branch\b/i.test(text)) {
        result.propertyType = 'Single Family';
      }
    }

    // 11. Sold Detection & Sale Price/Date
    const soldPriceMatch = text.match(/(?:sold\s+(?:for\s+)?|last\s+sold\s+(?:for\s+)?)\$?([0-9,]+|[0-9]+[km])/i);
    const soldDateMatch = text.match(/(?:sold\s+.*?on|last\s+sold\s+.*?in|sold\s+on)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|[A-Za-z]+\s+\d{4})/i);

    if (/\bsold\b/i.test(text) && !/not\s+sold/i.test(text)) {
      foundSold = true;
      if (soldPriceMatch && result.lastSaleAmount === undefined) {
        result.lastSaleAmount = parseCurrencyAmount(soldPriceMatch[1]);
      }
      if (soldDateMatch) {
        const rawDateStr = soldDateMatch[1];
        const isPrecise = hasExplicitDay(rawDateStr);
        const parsedIso = normalizeDateToIso(rawDateStr);
        if (parsedIso) {
          if (!result.lastSaleDate || (!dateHasExplicitDay && isPrecise)) {
            result.lastSaleDate = parsedIso;
            if (isPrecise) dateHasExplicitDay = true;
          }
        }
      }
    }

    // 12. Active / For Sale Detection & List Price
    if (
      /for\s+sale|active\s+listing|listed\s+(?:at|for)|zillow\s+has\s+\d+\s+photos/i.test(text) &&
      !/is\s+currently\s+not\s+for\s+sale|off\s*market/i.test(text)
    ) {
      foundActive = true;
      const listPriceMatch =
        text.match(/(?:listed\s+at|listed\s+for|for\s+sale\s*(?:at|for|:)?|of\s+this)\s*\$?([0-9,]+|[0-9]+[km])/i) ||
        text.match(/\$([0-9,]{5,})/);
      if (listPriceMatch && result.listPrice === undefined) {
        result.listPrice = parseCurrencyAmount(listPriceMatch[1]);
      }
    }

    // 13. Pending Detection
    if (/\bpending\b|\bcontingent\b|\bunder\s+contract\b/i.test(text)) {
      foundPending = true;
    }
  }

  // Assign Final Listing Status
  if (foundActive && !foundSold) {
    result.listingStatus = 'active';
  } else if (foundSold) {
    result.listingStatus = 'sold';
  } else if (foundPending) {
    result.listingStatus = 'pending';
  } else {
    result.listingStatus = 'off_market';
  }

  return result;
}

/**
 * Full execution: Search Serper, parse listing intelligence, and fetch Bridge API Zestimate via ZPID.
 */
export async function resolvePropertyWithSerp(params: {
  address: string;
  city: string;
  state: string;
  zip?: string;
}): Promise<SerpResolutionResult> {
  const { address, city, state, zip } = params;
  const serperApiKey = process.env.SERPER_API_KEY || SERPER_API_KEY;

  if (!serperApiKey) {
    console.warn('⚠️ [SERP_RESOLVER] SERPER_API_KEY is not configured in environment.');
    return {
      success: false,
      data: null,
      error: 'SERPER_API_KEY not configured',
    };
  }

  const query = `${address}, ${city}, ${state} ${zip || ''} zillow redfin realtor`.trim();

  try {
    console.log(`🔎 [SERP_RESOLVER] Querying Serper: "${query}"`);
    const res = await axios.post(
      SERPER_URL,
      {
        q: query,
        num: 5,
        gl: 'us',
        hl: 'en',
      },
      {
        headers: {
          'X-API-KEY': serperApiKey,
          'Content-Type': 'application/json',
        },
        timeout: 6000,
      }
    );

    const organic: SerpOrganicResult[] = res.data?.organic || [];
    const parsedData = parseSerpResults(query, organic);

    console.log('✅ [SERP_RESOLVER] Extracted property intel:', {
      zpid: parsedData.zpid,
      listingStatus: parsedData.listingStatus,
      lastSaleAmount: parsedData.lastSaleAmount,
      lastSaleDate: parsedData.lastSaleDate,
      listPrice: parsedData.listPrice,
      mlsNumber: parsedData.mlsNumber,
      hoaFee: parsedData.hoaFee,
      is55Plus: parsedData.is55Plus,
    });

    let bridgeValuation = null;
    if (parsedData.zpid) {
      console.log(`🔗 [SERP_RESOLVER] Fetching Bridge valuation via ZPID: ${parsedData.zpid}`);
      try {
        const { analyzeBridgeProperty } = await import('./bridge.server');
        const bridgeRes = await analyzeBridgeProperty({
          zpid: parsedData.zpid,
          street: address,
          city,
          state,
          zip,
        });
        if (bridgeRes.success && bridgeRes.valuation) {
          bridgeValuation = bridgeRes.valuation;
          console.log(`✅ [SERP_RESOLVER] Bridge Zestimate: $${bridgeValuation.zestimate}`);
        }
      } catch (bridgeErr: any) {
        console.warn(`⚠️ [SERP_RESOLVER] Bridge lookup by ZPID failed:`, bridgeErr.message);
      }
    }

    return {
      success: true,
      data: parsedData,
      bridgeValuation,
    };
  } catch (error: any) {
    console.error('❌ [SERP_RESOLVER] Error querying Serper:', error.message);
    return {
      success: false,
      data: null,
      error: error.message,
    };
  }
}
