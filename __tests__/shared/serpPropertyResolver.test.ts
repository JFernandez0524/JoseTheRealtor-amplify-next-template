// __tests__/shared/serpPropertyResolver.test.ts
import { describe, it, expect } from 'vitest';
import {
  parseSerpResults,
  normalizeDateToIso,
  parseCurrencyAmount,
  normalizeStreetForSearch,
  extractAddressParts,
  isResultMatchingAddress,
  type SerpOrganicResult,
} from '@/app/utils/serpPropertyResolver.server';

describe('serpPropertyResolver', () => {
  describe('normalizeDateToIso', () => {
    it('converts various date formats to YYYY-MM-DD', () => {
      expect(normalizeDateToIso('May 7, 2026')).toBe('2026-05-07');
      expect(normalizeDateToIso('May 20, 2026')).toBe('2026-05-20');
      expect(normalizeDateToIso('Jul 18, 2026')).toBe('2026-07-18');
      expect(normalizeDateToIso('2026-04-15')).toBe('2026-04-15');
      expect(normalizeDateToIso('05/20/2026')).toBe('2026-05-20');
      expect(normalizeDateToIso('06/03/26')).toBe('2026-06-03');
      expect(normalizeDateToIso('')).toBeUndefined();
      expect(normalizeDateToIso(null)).toBeUndefined();
      expect(normalizeDateToIso('invalid-date')).toBeUndefined();
    });
  });

  describe('parseCurrencyAmount', () => {
    it('parses currency strings into numbers', () => {
      expect(parseCurrencyAmount('$1,050,000')).toBe(1050000);
      expect(parseCurrencyAmount('$200,000')).toBe(200000);
      expect(parseCurrencyAmount('$200K')).toBe(200000);
      expect(parseCurrencyAmount('$1.05M')).toBe(1050000);
      expect(parseCurrencyAmount('$360000')).toBe(360000);
      expect(parseCurrencyAmount('285')).toBe(285);
      expect(parseCurrencyAmount('')).toBeUndefined();
      expect(parseCurrencyAmount(null)).toBeUndefined();
    });
  });

  describe('parseSerpResults', () => {
    it('correctly parses Sold property (Paramus example)', () => {
      const organic: SerpOrganicResult[] = [
        {
          title: '833 Koman Dr, Paramus, NJ 07652 | Zillow',
          link: 'https://www.zillow.com/homedetails/833-Koman-Dr-Paramus-NJ-07652/37943567_zpid/',
          snippet:
            '833 Koman Dr, Paramus, NJ 07652 is currently not for sale. The -- sqft single family home is a 3 beds, 3 baths property. $796,900 Annual tax amount: $11,946.',
        },
        {
          title: '833 Koman Dr, Paramus, NJ 07652 - 3 beds/2.5 baths - Redfin',
          link: 'https://www.redfin.com/NJ/Paramus/833-Koman-Dr-07652/home/37829415',
          snippet:
            'Sold: 3 beds, 2.5 baths ranch located at 833 Koman Dr, Paramus, NJ 07652 sold for $1050000 on May 7, 2026. MLS# 26010670. Elegant classic custom built ranch ...',
        },
      ];

      const result = parseSerpResults('833 Koman Dr Paramus NJ', organic);

      expect(result.zpid).toBe('37943567');
      expect(result.zillowUrl).toContain('37943567_zpid');
      expect(result.listingStatus).toBe('sold');
      expect(result.lastSaleAmount).toBe(1050000);
      expect(result.lastSaleDate).toBe('2026-05-07');
      expect(result.mlsNumber).toBe('26010670');
      expect(result.beds).toBe(3);
      expect(result.baths).toBe(3);
      expect(result.annualTaxes).toBe(11946);
    });

    it('correctly parses Sold Condo with HOA fee (Somerset example)', () => {
      const organic: SerpOrganicResult[] = [
        {
          title: '26 Beaconsfield Pl #26, Somerset, NJ 08873 | Zillow',
          link: 'https://www.zillow.com/homedetails/26-Beaconsfield-Pl-UNIT-26-Somerset-NJ-08873/39100123_zpid/',
          snippet:
            '26 Beaconsfield Pl #26, Somerset, NJ 08873 is a condo home that contains 724 sq ft and was built in 1987. This home last sold for $200,000 in May 2026.',
        },
        {
          title: '26 Beaconsfield Pl, Somerset, NJ 08873 - Redfin',
          link: 'https://www.redfin.com/NJ/Somerset/26-Beaconsfield-Pl-08873/home/39100123',
          snippet:
            '1 bed, 1 bath house located at 26 Beaconsfield Pl, Somerset, NJ 08873-4760 sold for $200000 on May 20, 2026. MLS# 4021293. Style: Condo/Co-op Year Built: 1987 ..',
        },
        {
          title: '26 Beaconsfield Pl, Franklin Twp, NJ 08873 - Realtor.com',
          link: 'https://www.realtor.com/realestateandhomes-detail/26-Beaconsfield-Pl_Franklin-Twp_NJ_08873',
          snippet:
            'Last sold for $200,000 1bed 1bath 26 Beaconsfield Pl, Franklin Twp, NJ 08873. Condos Year built 1987 Last sold $200K in 2026. Association Fee: 285 Association.',
        },
      ];

      const result = parseSerpResults('26 Beaconsfield Pl Somerset NJ', organic);

      expect(result.zpid).toBe('39100123');
      expect(result.listingStatus).toBe('sold');
      expect(result.lastSaleAmount).toBe(200000);
      expect(result.lastSaleDate).toBe('2026-05-20');
      expect(result.mlsNumber).toBe('4021293');
      expect(result.hoaFee).toBe(285);
      expect(result.beds).toBe(1);
      expect(result.baths).toBe(1);
      expect(result.sqft).toBe(724);
      expect(result.yearBuilt).toBe(1987);
      expect(result.propertyType).toBe('Condo/Co-op');
    });

    it('correctly parses Active For-Sale listing with 55+ Community (Little Egg Harbor example)', () => {
      const organic: SerpOrganicResult[] = [
        {
          title: '90 Briarwood Dr, Little Egg Harbor, NJ 08087 | Zillow',
          link: 'https://www.zillow.com/homedetails/90-Briarwood-Dr-Little-Egg-Harbor-NJ-08087/39555666_zpid/',
          snippet:
            'Jul 18, 2026 — Zillow has 55 photos of this $360000 2 beds, 2 baths, 1756 sqft single family home located at 90 Briarwood Dr, Little Egg Harbor, NJ 08087 ..',
        },
        {
          title: '90 Briarwood Dr, Tuckerton, NJ 08087 | Realtor.com',
          link: 'https://www.realtor.com/realestateandhomes-detail/90-Briarwood-Dr_Tuckerton_NJ_08087',
          snippet:
            'Aug 10, 2026 — For Sale: View 55 photos for 90 Briarwood Dr, this 2 bed, 2 bath, 1756 sqft. single family home in Tuckerton, NJ listed at $360000.',
        },
        {
          title: '90 Briarwood Dr, Tuckerton, NJ 08087 - Homes.com',
          link: 'https://www.homes.com/property/90-briarwood-dr-tuckerton-nj/12345/',
          snippet:
            '90 Briarwood Dr, Tuckerton, NJ 08087 - 1756 sqft home built in 2000 . 2 Beds 2 Baths 1,756 Sq Ft $205. Active Adult Community Pool Forced … 55+ Adult Community. $360,000.00',
        },
      ];

      const result = parseSerpResults('90 Briarwood Dr Little Egg Harbor NJ', organic);

      expect(result.zpid).toBe('39555666');
      expect(result.listingStatus).toBe('active');
      expect(result.listPrice).toBe(360000);
      expect(result.beds).toBe(2);
      expect(result.baths).toBe(2);
      expect(result.sqft).toBe(1756);
      expect(result.yearBuilt).toBe(2000);
      expect(result.is55Plus).toBe(true);
      expect(result.community).toBe('55+ Active Adult Community');
    });

    it('correctly parses Pending property with photos and list price (15 Ocean Ave, Manasquan example)', () => {
      const organic: SerpOrganicResult[] = [
        {
          title: '15 Ocean Avenue, Manasquan, NJ 08736 | Zillow',
          link: 'https://www.zillow.com/homedetails/15-Ocean-Avenue-Manasquan-NJ-08736/39255123_zpid/',
          snippet:
            'Aug 25, 2026 — 15 Ocean Avenue, Manasquan, NJ 08736 is pending. Zillow has 26 photos of this 3 beds, 2 baths, 1026 sqft single family home with a list price of $995,000.00.',
        },
        {
          title: '15 Ocean Ave, Manasquan, NJ 08736 | Realtor.com',
          link: 'https://www.realtor.com/realestateandhomes-detail/15-Ocean-Ave_Manasquan_NJ_08736',
          snippet:
            '15 Ocean Ave, Manasquan, NJ 08736 is pending. Single family, 3 beds, 2 baths, 1026 sq ft. List price: $995,000.',
        },
      ];

      const result = parseSerpResults('15 Ocean Avenue Manasquan NJ', organic);

      expect(result.zpid).toBe('39255123');
      expect(result.listingStatus).toBe('pending');
      expect(result.listPrice).toBe(995000);
      expect(result.beds).toBe(3);
      expect(result.baths).toBe(2);
      expect(result.sqft).toBe(1026);
    });

    it('correctly keeps off-market status for historical sale older than 180 days (1126 17th Ave, Wall example)', () => {
      const organic: SerpOrganicResult[] = [
        {
          title: '1126 17th Ave, Wall Township, NJ 07719 | Zillow',
          link: 'https://www.zillow.com/homedetails/1126-17th-Ave-Wall-Township-NJ-07719/39300111_zpid/',
          snippet:
            '1126 17th Ave, Wall Township, NJ 07719 is currently not for sale. The 1360 Square Feet single family home is a 2 beds, 2 baths property. $716,600.00.',
        },
        {
          title: '1126 17th Ave, Wall Township, NJ 07719 - Realtor.com',
          link: 'https://www.realtor.com/realestateandhomes-detail/1126-17th-Ave_Wall-Township_NJ_07719',
          snippet:
            '1126 17th Ave, Wall Township, NJ 07719. Single family home, 1360 sqft. Last sold for $136,000 on June 3, 1987.',
        },
      ];

      const result = parseSerpResults('1126 17th Ave Wall Township NJ', organic);

      expect(result.zpid).toBe('39300111');
      expect(result.listingStatus).toBe('off_market');
      expect(result.lastSaleAmount).toBe(136000);
      expect(result.lastSaleDate).toBe('1987-06-03');
      expect(result.beds).toBe(2);
      expect(result.baths).toBe(2);
      expect(result.sqft).toBe(1360);
    });

    it('correctly parses off-market property with explicit not for sale (207 Atlantic St, Keyport example)', () => {
      const organic: SerpOrganicResult[] = [
        {
          title: '207 Atlantic St, Keyport, NJ 07735 | Zillow',
          link: 'https://www.zillow.com/homedetails/207-Atlantic-St-Keyport-NJ-07735/39200456_zpid/',
          snippet:
            '207 Atlantic St, Keyport, NJ 07735 is currently not for sale. The 1738 Square Feet single family home is a 3 beds, 2 baths property. $503,000.00.',
        },
      ];

      const result = parseSerpResults('207 Atlantic St Keyport NJ', organic);

      expect(result.zpid).toBe('39200456');
      expect(result.listingStatus).toBe('off_market');
      expect(result.beds).toBe(3);
      expect(result.baths).toBe(2);
      expect(result.sqft).toBe(1738);
    });

    it('correctly parses Active listing from Zillow with MLS in title, list price and Zestimate (78 Clinton Ave, Eatontown example)', () => {
      const organic: SerpOrganicResult[] = [
        {
          title: '78 Clinton Avenue, Eatontown, NJ 07724 | MLS #22629187 | Zillow',
          link: 'https://www.zillow.com/homedetails/78-Clinton-Ave-Eatontown-NJ-07724/39270519_zpid/',
          snippet:
            'Zillow has 22 photos of this $500000 2 beds, 2 baths, 1655 sqft single family home located at 78 Clinton Avenue, Eatontown, NJ 07724 built in 1946. 6,098 Square Feet Lot $526,300 Zestimate ...',
        },
      ];

      const result = parseSerpResults('78 Clinton Avenue Eatontown NJ', organic);

      expect(result.zpid).toBe('39270519');
      expect(result.listingStatus).toBe('active');
      expect(result.mlsNumber).toBe('22629187');
      expect(result.listPrice).toBe(500000);
      expect(result.zestimate).toBe(526300);
      expect(result.beds).toBe(2);
      expect(result.baths).toBe(2);
      expect(result.sqft).toBe(1655);
      expect(result.yearBuilt).toBe(1946);
    });

    it('skips neighboring property results and parses target property (e.g. 42 West Louis Place)', () => {
      const organic: SerpOrganicResult[] = [
        {
          title: '38 W Louis Pl, Iselin, NJ 08830 - Zillow',
          link: 'https://www.zillow.com/homedetails/38-W-Louis-Pl-Iselin-NJ-08830/38901235_zpid/',
          snippet: '38 W Louis Pl, Iselin, NJ 08830 is currently not for sale. 4 beds, 2 baths, $600,000.',
        },
        {
          title: '42 W Louis Pl, Iselin, NJ 08830 - Zillow',
          link: 'https://www.zillow.com/homedetails/42-W-Louis-Pl-Iselin-NJ-08830/38901234_zpid/',
          snippet: '42 W Louis Pl, Iselin, NJ 08830 is currently not for sale. 3 beds, 2 baths property. $750,000.',
        },
      ];

      const result = parseSerpResults('42 West Louis Place', organic);

      expect(result.zpid).toBe('38901234');
      expect(result.zillowUrl).toContain('38901234_zpid');
      expect(result.listingStatus).toBe('off_market');
      expect(result.beds).toBe(3);
      expect(result.baths).toBe(2);
    });

    it('handles empty results gracefully', () => {
      const result = parseSerpResults('Empty Address', []);
      expect(result.listingStatus).toBe('off_market');
      expect(result.zpid).toBeUndefined();
    });
  });

  describe('normalizeStreetForSearch', () => {
    it('normalizes street directions and types to standard USPS abbreviations', () => {
      expect(normalizeStreetForSearch('42 West Louis Place')).toBe('42 W Louis Pl');
      expect(normalizeStreetForSearch('100 North Main Street')).toBe('100 N Main St');
      expect(normalizeStreetForSearch('50 East Grand Avenue')).toBe('50 E Grand Ave');
      expect(normalizeStreetForSearch('12 South Ocean Boulevard')).toBe('12 S Ocean Blvd');
      expect(normalizeStreetForSearch('78 Clinton Road')).toBe('78 Clinton Rd');
      expect(normalizeStreetForSearch('15 Park Court')).toBe('15 Park Ct');
      expect(normalizeStreetForSearch('300 Route 9 Parkway')).toBe('300 Route 9 Pkwy');
      expect(normalizeStreetForSearch('5 Garden Plaza')).toBe('5 Garden Plz');
    });

    it('handles empty or blank addresses', () => {
      expect(normalizeStreetForSearch('')).toBe('');
      expect(normalizeStreetForSearch(null as any)).toBe('');
    });
  });

  describe('extractAddressParts', () => {
    it('extracts street number, base number, and core street name', () => {
      expect(extractAddressParts('42 West Louis Place')).toEqual({
        streetNum: '42',
        baseNum: '42',
        coreStreet: 'Louis',
      });
      expect(extractAddressParts('100 North Main Street Apt 4B')).toEqual({
        streetNum: '100',
        baseNum: '100',
        coreStreet: 'Main',
      });
      expect(extractAddressParts('42A South Broad St')).toEqual({
        streetNum: '42A',
        baseNum: '42',
        coreStreet: 'Broad',
      });
    });

    it('handles empty or invalid addresses gracefully', () => {
      expect(extractAddressParts('')).toEqual({
        streetNum: '',
        baseNum: '',
        coreStreet: '',
      });
    });
  });

  describe('isResultMatchingAddress', () => {
    const targetAddress = '42 West Louis Place';

    it('matches search result with full Google address format', () => {
      const item: SerpOrganicResult = {
        title: '42 West Louis Place, Iselin, NJ 08830 | Zillow',
        link: 'https://www.zillow.com/homedetails/42-West-Louis-Pl-Iselin-NJ-08830/38901234_zpid/',
        snippet: '42 West Louis Place, Iselin, NJ 08830 is currently not for sale.',
      };
      expect(isResultMatchingAddress(item, targetAddress)).toBe(true);
    });

    it('matches search result with USPS abbreviated address format', () => {
      const item: SerpOrganicResult = {
        title: '42 W Louis Pl, Iselin, NJ 08830 - Zillow',
        link: 'https://www.zillow.com/homedetails/42-W-Louis-Pl-Iselin-NJ-08830/38901234_zpid/',
        snippet: '42 W Louis Pl, Iselin, NJ 08830 is currently not for sale.',
      };
      expect(isResultMatchingAddress(item, targetAddress)).toBe(true);
    });

    it('matches when address details are only in the URL link slug', () => {
      const item: SerpOrganicResult = {
        title: 'Zillow Real Estate Listing',
        link: 'https://www.zillow.com/homedetails/42-W-Louis-Pl-Iselin-NJ-08830/38901234_zpid/',
        snippet: 'Single family home in Iselin NJ.',
      };
      expect(isResultMatchingAddress(item, targetAddress)).toBe(true);
    });

    it('strictly rejects neighboring home with different house number', () => {
      const item: SerpOrganicResult = {
        title: '38 W Louis Pl, Iselin, NJ 08830 - Zillow',
        link: 'https://www.zillow.com/homedetails/38-W-Louis-Pl-Iselin-NJ-08830/38901235_zpid/',
        snippet: '38 W Louis Pl, Iselin, NJ 08830 is currently not for sale.',
      };
      expect(isResultMatchingAddress(item, targetAddress)).toBe(false);
    });

    it('strictly rejects neighboring home on a different street', () => {
      const item: SerpOrganicResult = {
        title: '41 W Henry Pl, Iselin, NJ 08830 - Zillow',
        link: 'https://www.zillow.com/homedetails/41-W-Henry-Pl-Iselin-NJ-08830/38901236_zpid/',
        snippet: '41 W Henry Pl, Iselin, NJ 08830 is currently not for sale.',
      };
      expect(isResultMatchingAddress(item, targetAddress)).toBe(false);
    });

    it('strictly rejects neighboring home with same house number on different street', () => {
      const item: SerpOrganicResult = {
        title: '42 W Henry Pl, Iselin, NJ 08830 - Zillow',
        link: 'https://www.zillow.com/homedetails/42-W-Henry-Pl-Iselin-NJ-08830/38901237_zpid/',
        snippet: '42 W Henry Pl, Iselin, NJ 08830 is currently not for sale.',
      };
      expect(isResultMatchingAddress(item, targetAddress)).toBe(false);
    });

    it('strictly rejects neighboring home (5 Meadows Lane) when target is 7 Meadows Lane even if snippet mentions 7 Meadows', () => {
      const item: SerpOrganicResult = {
        title: '5 Meadows Lane, Whiting, NJ 08759 | MLS #22628015 | Zillow',
        link: 'https://www.zillow.com/homedetails/5-Meadows-Ln-Whiting-NJ-08759/52687073_zpid/',
        snippet: '7 Meadows Ln, Whiting, NJ 08759. Off Market. Save. 7 Meadows Ln, Whiting, NJ 08759 · $390,800. 2 bd. 2 ba. 1.6k sqft. 3 Meadows Ln, Whiting, NJ ...',
      };
      expect(isResultMatchingAddress(item, '7 Meadows Lane')).toBe(false);
    });

    it('matches target address from Zillow sold search page when snippet has exact address', () => {
      const item: SerpOrganicResult = {
        title: 'Recently Sold Homes in 08701 - 2755 Transactions',
        link: 'https://www.zillow.com/lakewood-nj-08701/sold/6_p/',
        snippet: '874A Balmoral Court, Lakewood, NJ 08701. WEICHERT REALTORS-BRICK, Janet Ettore. More. Sold 06/03/26. Save. 874A Balmoral Court, Lakewood, NJ 08701. Loading...',
      };
      expect(isResultMatchingAddress(item, '874a Balmoral Court')).toBe(true);
    });
  });

  describe('parseSerpResults extended', () => {
    it('correctly parses 14 Ann Ct condo snippet as Condo/Co-op and isCondo', () => {
      const organic: SerpOrganicResult[] = [
        {
          title: '14 Ann Ct, Tinton Falls, NJ 07724 | Zillow',
          link: 'https://www.zillow.com/homedetails/14-Ann-Ct-Tinton-Falls-NJ-07724/39255999_zpid/',
          snippet:
            '14 Ann Ct, Tinton Falls, NJ 07724 is currently not for sale. The 1616 Square Feet condo home is a 1 bed, 2 baths property. This home was built in 1980 and',
        },
      ];
      const result = parseSerpResults('14 Ann Ct, Tinton Falls, NJ', organic);
      expect(result.propertyType).toBe('Condo/Co-op');
      expect(result.isCondo).toBe(true);
      expect(result.beds).toBe(1);
      expect(result.baths).toBe(2);
      expect(result.sqft).toBe(1616);
      expect(result.yearBuilt).toBe(1980);
      expect(result.listingStatus).toBe('off_market');
    });

    it('prioritizes Sold over older MLS active title for 392B Hystrix Plz example', () => {
      const organic: SerpOrganicResult[] = [
        {
          title: '392B Hystrix Plz, Monroe Township, NJ 08831 | MLS #2702647R',
          link: 'https://www.zillow.com/homedetails/392B-Hystrix-Plz-Monroe-Township-NJ-08831/39098412_zpid/',
          snippet: 'Zillow has 25 photos of this $299900 2 beds, 2 baths, 1380 sqft single family home located at 392B Hystrix Plz, Monroe Township, NJ 08831 ...',
          date: 'Aug 25, 2026',
        },
        {
          title: '392-B Hystrix Plz, Monroe Township, NJ 08831 - Redfin',
          link: 'https://www.redfin.com/NJ/Monroe-Township/392-Hystrix-Plz-08831/home/204643915',
          snippet: 'Sold: 2 beds, 2 baths located at 392-B Hystrix Plz, Monroe Township, NJ 08831 sold for $305,000 on Sep 15, 2026.',
        },
      ];
      const result = parseSerpResults('392B Hystrix Plz, Monroe Township, NJ', organic);
      expect(result.listingStatus).toBe('sold');
      expect(result.lastSaleAmount).toBe(305000);
      expect(result.lastSaleDate).toBe('2026-09-15');
      expect(result.mlsNumber).toBe('2702647R');
    });

    it('correctly classifies sold property over Zillow not-for-sale boilerplate (1426 Northstream Parkway example)', () => {
      const organic: SerpOrganicResult[] = [
        {
          title: '1426 Northstream Parkway, Point Pleasant Beach, NJ 08742 | Zillow',
          link: 'https://www.zillow.com/homedetails/1426-Northstream-Pkwy-Point-Pleasant-Boro-NJ-08742/39294812_zpid/',
          snippet:
            '1426 Northstream Parkway, Point Pleasant Beach, NJ 08742 is currently not for sale. The 2570 Square Feet single family home is a 4 beds, 3 baths property.',
        },
        {
          title: '1426 Northstream Pkwy, Point Pleasant, NJ 08742 - Realtor.com',
          link: 'https://www.realtor.com/realestateandhomes-detail/1426-Northstream-Pkwy_Point-Pleasant_NJ_08742',
          snippet:
            '4 bed, 3 bath, 2570 sqft. single family home. Single Family Year built 1964 Last sold $900K in 2025 Price per sqft $350 Garage. Year Built: 1964 Building Area ...',
        },
        {
          title: '1426 Northstream Pkwy, Point Pleasant Boro, NJ 08742 - Redfin',
          link: 'https://www.redfin.com/NJ/Point-Pleasant-Boro/1426-Northstream-Pkwy-08742/home/39294812',
          snippet:
            '4 beds, 3 baths, 2570 sq. ft. house located at 1426 Northstream Pkwy, Point Pleasant Boro, NJ 08742 sold for $900000 on Jun 6, 2025. MLS# 22508202.',
        },
      ];

      const result = parseSerpResults('1426 Northstream Parkway, Point Pleasant, NJ 08742', organic);
      expect(result.listingStatus).toBe('sold');
      expect(result.lastSaleAmount).toBe(900000);
      expect(result.lastSaleDate).toBe('2025-06-06');
      expect(result.mlsNumber).toBe('22508202');
      expect(result.beds).toBe(4);
      expect(result.baths).toBe(3);
      expect(result.sqft).toBe(2570);
      expect(result.yearBuilt).toBe(1964);
      expect(result.propertyType).toBe('Single Family');
    });

    it('correctly classifies sold property from Zillow search result page with 2-digit year (874A Balmoral Court example)', () => {
      const organic: SerpOrganicResult[] = [
        {
          title: '874A Balmoral Court, Lakewood, NJ 08701',
          link: 'https://www.zillow.com/homedetails/874A-Balmoral-Ct-Lakewood-NJ-08701/39644891_zpid/',
          snippet:
            '874A Balmoral Court, Lakewood, NJ 08701 is currently not for sale. The 858 Square Feet single family home is a 2 beds, 1 bath property.',
        },
        {
          title: 'Recently Sold Homes in 08701 - 2755 Transactions',
          link: 'https://www.zillow.com/lakewood-nj-08701/sold/6_p/',
          snippet:
            '874A Balmoral Court, Lakewood, NJ 08701. WEICHERT REALTORS-BRICK, Janet Ettore. More. Sold 06/03/26. Save. 874A Balmoral Court, Lakewood, NJ 08701. Loading...',
        },
      ];

      const result = parseSerpResults('874a Balmoral Court', organic);
      expect(result.listingStatus).toBe('sold');
      expect(result.lastSaleDate).toBe('2026-06-03');
      expect(result.zpid).toBe('39644891');
      expect(result.beds).toBe(2);
      expect(result.baths).toBe(1);
      expect(result.sqft).toBe(858);
      expect(result.propertyType).toBe('Single Family');
    });
  });
});
