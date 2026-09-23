// __tests__/shared/serpPropertyResolver.test.ts
import { describe, it, expect } from 'vitest';
import {
  parseSerpResults,
  normalizeDateToIso,
  parseCurrencyAmount,
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

    it('handles empty results gracefully', () => {
      const result = parseSerpResults('Empty Address', []);
      expect(result.listingStatus).toBe('off_market');
      expect(result.zpid).toBeUndefined();
    });
  });
});
