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
  zestimate?: number;
  lastSaleAmount?: number;
  lastSaleDate?: string; // YYYY-MM-DD
  mlsNumber?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  propertyType?: string;
  isCondo?: boolean;
  hoaFee?: number;
  annualTaxes?: number;
  is55Plus?: boolean;
  community?: string;
  aiReasoning?: string;
  _hasConflict?: boolean;
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

  const shortDateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(cleaned);
  if (shortDateMatch) {
    const month = shortDateMatch[1].padStart(2, '0');
    const day = shortDateMatch[2].padStart(2, '0');
    const year = `20${shortDateMatch[3]}`;
    return `${year}-${month}-${day}`;
  }

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
 * Normalizes street directions and types to standard USPS abbreviations
 * matching Zillow's indexing format (e.g. "42 West Louis Place" -> "42 W Louis Pl").
 */
export function normalizeStreetForSearch(address: string): string {
  if (!address) return '';
  return address
    .replace(/\bNorth\b/gi, 'N')
    .replace(/\bSouth\b/gi, 'S')
    .replace(/\bEast\b/gi, 'E')
    .replace(/\bWest\b/gi, 'W')
    .replace(/\bStreet\b/gi, 'St')
    .replace(/\bAvenue\b/gi, 'Ave')
    .replace(/\bPlace\b/gi, 'Pl')
    .replace(/\bPlaza\b/gi, 'Plz')
    .replace(/\bRoad\b/gi, 'Rd')
    .replace(/\bDrive\b/gi, 'Dr')
    .replace(/\bLane\b/gi, 'Ln')
    .replace(/\bCourt\b/gi, 'Ct')
    .replace(/\bBoulevard\b/gi, 'Blvd')
    .replace(/\bCircle\b/gi, 'Cir')
    .replace(/\bTerrace\b/gi, 'Ter')
    .replace(/\bParkway\b/gi, 'Pkwy')
    .replace(/\bHighway\b/gi, 'Hwy')
    .trim();
}

/**
 * Extracts house number and core street name to prevent search result leakage from neighboring homes.
 */
export function extractAddressParts(addr: string): { streetNum: string; baseNum: string; coreStreet: string } {
  if (!addr) return { streetNum: '', baseNum: '', coreStreet: '' };
  const streetNumMatch = addr.trim().match(/^(\d+[A-Za-z]?)\b/);
  const streetNum = streetNumMatch ? streetNumMatch[1] : '';
  const baseNum = streetNum.replace(/[A-Za-z]+$/, '');

  let rest = addr.replace(/^\d+[A-Za-z]?\b/, '').trim();
  rest = rest.replace(/^(?:North|South|East|West|N|S|E|W)\.?\s+/i, '');
  if (rest.includes(',')) {
    rest = rest.split(',')[0].trim();
  }
  rest = rest.replace(/\b(?:Street|St|Avenue|Ave|Place|Pl|Plaza|Plz|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Boulevard|Blvd|Circle|Cir|Terrace|Ter|Way|Highway|Hwy|Parkway|Pkwy|Pike|Trail|Trl|Route|Rte|Loop|Run|Row|Path|Walk|Unit|Apt|#|Suite|Ste)\b.*$/i, '').trim();

  return { streetNum, baseNum, coreStreet: rest };
}

/**
 * Verifies that a search result's title, link, or snippet actually matches the target property,
 * accepting both full Google Address Validation format and USPS abbreviated format, while
 * strictly rejecting results from neighboring homes with different house numbers or streets.
 */
export function isResultMatchingAddress(
  item: SerpOrganicResult,
  targetAddress: string
): boolean {
  const { streetNum, baseNum, coreStreet } = extractAddressParts(targetAddress);
  if (!streetNum && !coreStreet) return true; // If address cannot be extracted, don't filter out

  const title = (item.title || '').toLowerCase();
  const link = (item.link || '').toLowerCase();
  const snippet = (item.snippet || '').toLowerCase();

  const numPattern = baseNum && baseNum !== streetNum ? `(?:${streetNum}|${baseNum})` : streetNum;
  const numRegex = new RegExp(`\\b${numPattern}\\b`, 'i');
  const streetRegex = coreStreet ? new RegExp(`\\b${coreStreet}\\b`, 'i') : null;

  // 🛡️ Strict house number check: if the title or link contains a distinct house number
  // immediately preceding the street name that differs from target streetNum / baseNum, reject immediately.
  // (Prevents neighboring homes like "5 Meadows Lane" or "396B Hystrix Plz" from matching when target is "7 Meadows Lane" or "392B Hystrix Plz")
  if (coreStreet) {
    const numMatch = (title + ' ' + link).match(new RegExp(`\\b(\\d+[A-Za-z]?)[-\\s]+(?:(?:n|s|e|w|north|south|east|west)[-\\s]+)?${coreStreet}\\b`, 'i'));
    if (numMatch) {
      const extractedNum = numMatch[1].toLowerCase();
      const targetNum = streetNum.toLowerCase();
      const targetBase = baseNum.toLowerCase();
      if (extractedNum !== targetNum && extractedNum !== targetBase) {
        return false;
      }
    }
  }

  const titleOrLinkHasNum = numRegex.test(title) || numRegex.test(link);
  const titleOrLinkHasStreet = streetRegex ? (streetRegex.test(title) || streetRegex.test(link)) : true;

  if (titleOrLinkHasNum && titleOrLinkHasStreet) {
    return true;
  }

  // Fallback: check snippet if snippet contains the target number and street,
  // provided title/link does not point to a conflicting house number on the same street.
  if (numRegex.test(snippet) && (streetRegex ? streetRegex.test(snippet) : true)) {
    const hasConflictingNumInTitleOrLink = coreStreet
      ? new RegExp(`\\b(\\d+[A-Za-z]?)[-\\s]+(?:(?:n|s|e|w|north|south|east|west)[-\\s]+)?${coreStreet}\\b`, 'i').test(title + ' ' + link)
      : false;
    if (!hasConflictingNumInTitleOrLink) {
      return true;
    }
  }

  return false;
}

/**
 * Pure parsing function to extract structured property intelligence from search organic results.
 */
export function parseSerpResults(
  targetAddressOrQuery: string,
  organic: SerpOrganicResult[]
): SerpPropertyData {
  const result: SerpPropertyData = {
    listingStatus: 'off_market',
    rawSnippets: [],
  };

  if (!organic || organic.length === 0) {
    return result;
  }

  let isExplicitOffMarket = false;
  let foundPending = false;
  let foundActive = false;
  let foundRecentSold = false;
  let dateHasExplicitDay = false;

  const hasExplicitDay = (str?: string) =>
    str ? /[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}/.test(str) : false;

  for (const item of organic) {
    // 🛡️ Guardrail: Verify that the search result matches the target property address
    // Rejects neighboring properties (e.g. 41 W Henry Pl or 38 W Louis Pl when searching for 42 West Louis Pl)
    if (!isResultMatchingAddress(item, targetAddressOrQuery)) {
      continue;
    }

    const title = item.title || '';
    const link = item.link || '';
    const snippet = item.snippet || '';
    const text = `${title} ${snippet}`;
    if (snippet) result.rawSnippets?.push(snippet);

    const hasMlsInTitle = /\|\s*MLS\s*#?[A-Za-z0-9]+/i.test(title);

    // 1. Extract Zillow ZPID & URL
    if (link.includes('zillow.com')) {
      if (!result.zillowUrl) {
        result.zillowUrl = link;
      }
      const zpidMatch = link.match(/\/(\d+)_zpid/);
      if (zpidMatch && !result.zpid) {
        result.zpid = zpidMatch[1];
        result.zillowUrl = link;
      }
    }

    // 2. Extract MLS Number
    if (!result.mlsNumber) {
      const mlsMatch = text.match(/MLS\s*#?\s*([A-Za-z0-9]+)/i);
      if (mlsMatch) {
        result.mlsNumber = mlsMatch[1];
      }
    }

    // 2b. Extract Zestimate
    if (result.zestimate === undefined) {
      const zestimateMatch =
        text.match(/\$([0-9,]+|[0-9]+[km])\s*(?:Zestimate|zestimate)/i) ||
        text.match(/(?:Zestimate|zestimate)[^$]*\$([0-9,]+|[0-9]+[km])/i);
      if (zestimateMatch) {
        result.zestimate = parseCurrencyAmount(zestimateMatch[1]);
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
      } else if (/\bcondos?\b|\bco-op\b|\bcondominiums?\b/i.test(text)) {
        result.propertyType = 'Condo/Co-op';
      } else if (/\btownhouse\b|\btownhome\b/i.test(text)) {
        result.propertyType = 'Townhouse';
      } else if (/\bsingle\s+family\b|\branch\b/i.test(text)) {
        result.propertyType = 'Single Family';
      }
    }
    if (!result.isCondo) {
      if (
        (result.propertyType && /\bcondos?\b|\bco-op\b|\bcondominiums?\b/i.test(result.propertyType)) ||
        /\bcondos?\b|\bco-op\b|\bcondominiums?\b/i.test(text)
      ) {
        result.isCondo = true;
      }
    }

    // 11. Explicit Off-Market Signals
    if (/is\s+(?:currently\s+)?not\s+for\s+sale|is\s+currently\s+off\s*market|off\s*market/i.test(text)) {
      isExplicitOffMarket = true;
    }

    // 12. Pending Detection (takes precedence over active / photo counts)
    if (
      /\b(?:is\s+pending|pending\s+sale|contingent|under\s+contract)\b/i.test(text) ||
      (/\bpending\b/i.test(title) && !/not\s+pending/i.test(title))
    ) {
      foundPending = true;
    }

    // 13. Sold Detection & Sale Price/Date
    const soldPriceMatch = text.match(/(?:sold\s+(?:for\s+)?|last\s+sold\s+(?:for\s+)?)\$?([0-9.]+[km]|[0-9,]+)/i);
    const soldDateMatch = text.match(/(?:sold\s+.*?on|last\s+sold\s+.*?in|sold\s+on|sold\s+in|sold\s+)\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]+\s+\d{4})/i);

    if (soldPriceMatch) {
      const parsedAmount = parseCurrencyAmount(soldPriceMatch[1]);
      if (parsedAmount) {
        if (result.lastSaleAmount === undefined || (result.lastSaleAmount < 10000 && parsedAmount >= 10000)) {
          result.lastSaleAmount = parsedAmount;
        }
      }
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

    const isSoldListingIndicator =
      /(?:^|\b)(?:sold\s*[-:]|recently\s+sold|just\s+sold|sold\s+\d{1,2}\/\d{1,2}\/\d{2,4})\b/i.test(title) ||
      /(?:^|\b)(?:sold\s*[-:]|recently\s+sold|just\s+sold|sold\s+\d{1,2}\/\d{1,2}\/\d{2,4})\b/i.test(snippet) ||
      /(?:sold\s+(?:for\s+)?\$[0-9,]+)/i.test(snippet);

    if (isSoldListingIndicator || (/\bsold\b/i.test(text) && !/not\s+sold/i.test(text))) {
      if (result.lastSaleDate) {
        const saleTime = new Date(result.lastSaleDate).getTime();
        const daysAgo = (Date.now() - saleTime) / (1000 * 60 * 60 * 24);
        // Closed sale within 730 days (2 years), or within 3 years with MLS#
        if (daysAgo <= 730 || (daysAgo <= 1095 && result.mlsNumber)) {
          foundRecentSold = true;
        }
      } else if (isSoldListingIndicator && !isExplicitOffMarket) {
        foundRecentSold = true;
      }
    }

    // 14. Active / For Sale Detection & List Price
    const listPriceMatch =
      text.match(/(?:photos\s+of\s+this\s+)\$([0-9.]+[km]|[0-9,]+)/i) ||
      text.match(/(?:listed\s+(?:at|for)|list\s+price(?:\s+is|\s+of|:)?|for\s+sale\s*(?:at|for|:)?)\s*\$?([0-9.]+[km]|[0-9,]+)/i) ||
      text.match(/(?:for\s+sale:?\s*)\$([0-9,]{5,})/i) ||
      snippet.match(/^\s*(?:[A-Za-z]+\s+\d{1,2},?\s+\d{4}\s*[-—]\s*)?\$([0-9.]+[km]|[0-9,]+)\s+\d+\s+beds?/i);
    if (listPriceMatch) {
      const parsedList = parseCurrencyAmount(listPriceMatch[1]);
      if (parsedList) {
        if (result.listPrice === undefined || (result.listPrice < 10000 && parsedList >= 10000)) {
          result.listPrice = parsedList;
        }
      }
    }

    const hasActiveIndicator =
      hasMlsInTitle ||
      /(?:^|\b)(?:for\s+sale\s*[-:]|active\s+listing|currently\s+listed\s+(?:for|at)|is\s+for\s+sale)\b/i.test(text) ||
      (/zillow\s+has\s+\d+\s+photos\s+of\s+this\s+\$[0-9,]+/i.test(text)) ||
      (/^\s*(?:[A-Za-z]+\s+\d{1,2},?\s+\d{4}\s*[-—]\s*)?\$[0-9,]+\s+\d+\s+beds/i.test(snippet) && !isExplicitOffMarket);

    if ((hasMlsInTitle || hasActiveIndicator) && !isExplicitOffMarket && !foundPending) {
      foundActive = true;
    }
  }

  // Detect conflicting signals across portals to trigger AI disambiguation
  const allSnippetsText = organic.map((r) => `${r.title || ''} ${r.snippet || ''}`).join(' ');
  const hasSoldSignal = foundRecentSold || !!result.lastSaleAmount || /sold\s+for\s+\$|last\s+sold\s+\$/i.test(allSnippetsText);
  const hasActiveSignal = foundActive || /active\s+mls|for\s+sale/i.test(allSnippetsText);
  result._hasConflict =
    (isExplicitOffMarket && hasSoldSignal) ||
    (isExplicitOffMarket && hasActiveSignal) ||
    (foundActive && foundRecentSold) ||
    (foundPending && (foundActive || foundRecentSold));

  // Assign Final Listing Status based on authoritative hierarchy:
  // 1. Pending (e.g. 15 Ocean Ave is pending)
  // 2. Recently sold within active transaction window (active transaction outcome)
  // 3. Explicit off-market (e.g. 1126 17th Ave or 207 Atlantic St is currently not for sale)
  // 4. Active listing (e.g. MLS in title, active for sale)
  // 5. Default to off-market
  if (foundPending) {
    result.listingStatus = 'pending';
  } else if (foundRecentSold) {
    result.listingStatus = 'sold';
  } else if (isExplicitOffMarket) {
    result.listingStatus = 'off_market';
  } else if (foundActive) {
    result.listingStatus = 'active';
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
  skipBridgeLookup?: boolean;
  useAi?: boolean;
}): Promise<SerpResolutionResult> {
  const { address, city, state, zip, skipBridgeLookup = false, useAi = false } = params;
  const serperApiKey = process.env.SERPER_API_KEY || SERPER_API_KEY;

  if (!serperApiKey) {
    console.warn('⚠️ [SERP_RESOLVER] SERPER_API_KEY is not configured in environment.');
    return {
      success: false,
      data: null,
      error: 'SERPER_API_KEY not configured',
    };
  }

  const normalizedStreet = normalizeStreetForSearch(address);
  const streetQuery =
    normalizedStreet.toLowerCase() !== address.toLowerCase()
      ? `("${address}" OR "${normalizedStreet}")`
      : `"${address}"`;

  const query = `${streetQuery} ${city} ${state} ${zip || ''}`.trim();

  try {
    console.log(`🔎 [SERP_RESOLVER] Querying Serper: "${query}"`);
    const res = await axios.post(
      SERPER_URL,
      {
        q: query,
        num: 8,
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
    const parsedData = parseSerpResults(address, organic);

    // 🤖 SMART HYBRID AI: Disambiguate when conflict detected or explicitly requested
    if (useAi || parsedData._hasConflict) {
      try {
        const { interpretSerpWithAi } = await import('./ai/serpInterpreter.server');
        const aiResult = await interpretSerpWithAi({
          address,
          city,
          state,
          zip,
          items: organic,
        });

        if (aiResult) {
          parsedData.listingStatus = aiResult.listingStatus;
          if (aiResult.lastSaleAmount != null) parsedData.lastSaleAmount = aiResult.lastSaleAmount;
          if (aiResult.lastSaleDate) parsedData.lastSaleDate = aiResult.lastSaleDate;
          if (aiResult.listPrice != null) parsedData.listPrice = aiResult.listPrice;
          if (aiResult.mlsNumber) parsedData.mlsNumber = aiResult.mlsNumber;
          if (aiResult.propertyType) parsedData.propertyType = aiResult.propertyType;
          if (aiResult.isCondo) parsedData.isCondo = true;
          if (aiResult.is55Plus) parsedData.is55Plus = true;
          if (aiResult.hoaFee != null) parsedData.hoaFee = aiResult.hoaFee;
          parsedData.aiReasoning = aiResult.reasoning;
        }
      } catch (aiErr: any) {
        console.warn('⚠️ [SERP_RESOLVER] AI disambiguation fallback:', aiErr?.message || aiErr);
      }
    }

    console.log('✅ [SERP_RESOLVER] Extracted property intel:', {
      zpid: parsedData.zpid,
      listingStatus: parsedData.listingStatus,
      zestimate: parsedData.zestimate,
      lastSaleAmount: parsedData.lastSaleAmount,
      lastSaleDate: parsedData.lastSaleDate,
      listPrice: parsedData.listPrice,
      mlsNumber: parsedData.mlsNumber,
      hoaFee: parsedData.hoaFee,
      is55Plus: parsedData.is55Plus,
      aiReasoning: parsedData.aiReasoning,
    });

    let bridgeValuation = null;
    if (parsedData.zpid && !skipBridgeLookup) {
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
