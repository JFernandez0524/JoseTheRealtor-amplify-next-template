import { describe, it, expect } from 'vitest';
import {
  computeForeclosureFinancials,
  resolvePropertyCounty,
  toIsoDateOnly,
} from '../../amplify/functions/shared/foreclosureFinancials';

describe('foreclosureFinancials', () => {
  describe('resolvePropertyCounty', () => {
    it('resolves county across flat ownerCounty, standardizedAddress, and sourceRawData for any lead type', () => {
      expect(resolvePropertyCounty({ ownerCounty: 'MIDDLESEX' })).toBe('Middlesex');
      expect(
        resolvePropertyCounty({
          ownerCounty: null,
          standardizedAddress: JSON.stringify({ county: 'UNION' }),
        }),
      ).toBe('Union');
      expect(
        resolvePropertyCounty({
          ownerCounty: null,
          sourceRawData: JSON.stringify({ county: 'monmouth' }),
        }),
      ).toBe('Monmouth');
      expect(resolvePropertyCounty({})).toBeNull();
    });
  });

  describe('toIsoDateOnly', () => {
    it('normalizes dates to YYYY-MM-DD', () => {
      expect(toIsoDateOnly('2026-11-18')).toBe('2026-11-18');
      expect(toIsoDateOnly('11/18/2026')).toBe('2026-11-18');
      expect(toIsoDateOnly(null)).toBeNull();
      expect(toIsoDateOnly('not-a-date')).toBeNull();
    });
  });

  describe('computeForeclosureFinancials', () => {
    it('calculates HIGH_EQUITY spread and percentage from Zestimate and scraper upset', () => {
      const fin = computeForeclosureFinancials({
        zestimate: 550000,
        sourceRawData: JSON.stringify({
          sales_date: '11/18/2026',
          approx_upset: '$310,000',
          estimated_upset: '$325,000',
          county: 'Middlesex',
        }),
      });

      expect(fin.saleDate).toBe('11/18/2026');
      expect(fin.isSheriffSale).toBe(true);
      expect(fin.foreclosureSubType).toBe('SHERIFF_SALE');
      expect(fin.baselineLabel).toBe('Upset');
      expect(fin.approxUpset).toBe(310000);
      expect(fin.estimatedUpset).toBe(325000);
      expect(fin.baselineUpset).toBe(325000);
      expect(fin.equitySpread).toBe(225000);
      expect(fin.equitySpreadPct).toBe(41);
      expect(fin.equityTier).toBe('HIGH_EQUITY');
      expect(fin.resolvedCounty).toBe('Middlesex');
    });

    it('calculates Lis Pendens equity spread from NJ LP CSV LOAN-AMOUNT and RECORDING-DATE without a sale date', () => {
      const fin = computeForeclosureFinancials({
        type: 'PREFORECLOSURE',
        zestimate: 425000,
        sourceRawData: JSON.stringify({
          'CASE NUMBER': 'F-10421-26',
          'RECORDING-DATE': '2026-09-23',
          'LOAN-AMOUNT': '$156,610.00',
          'BORROWER-OR-DEFENDANT-NAME': 'SHAWN MATTHEWS',
          'LENDER-OR-PLAINTIFF-NAME': 'FREEDOM MORTGAGE CORPORATION',
          'SITUS-COUNTY': 'CUMBERLAND',
        }),
      });

      expect(fin.saleDate).toBeNull();
      expect(fin.recordingDate).toBe('2026-09-23');
      expect(fin.isSheriffSale).toBe(false);
      expect(fin.foreclosureSubType).toBe('LIS_PENDENS');
      expect(fin.baselineLabel).toBe('Loan');
      expect(fin.baselineUpset).toBe(156610);
      expect(fin.equitySpread).toBe(268390);
      expect(fin.equitySpreadPct).toBe(63);
      expect(fin.equityTier).toBe('HIGH_EQUITY');
      expect(fin.resolvedCounty).toBe('Cumberland');
    });

    it('labels Tax_Fore and Condo Lis Pendens filings accurately', () => {
      const taxLp = computeForeclosureFinancials({
        type: 'PREFORECLOSURE',
        zestimate: 350000,
        sourceRawData: JSON.stringify({
          'CASE NUMBER': 'F-10640-26 Tax_Fore',
          'RECORDING-DATE': '2026-09-24',
          'LOAN-AMOUNT': '$497.00',
          'SITUS-COUNTY': 'BERGEN',
        }),
      });
      expect(taxLp.foreclosureSubType).toBe('LIS_PENDENS');
      expect(taxLp.baselineLabel).toBe('Tax Lien');
      expect(taxLp.baselineUpset).toBe(497);
      expect(taxLp.equitySpread).toBe(349503);

      const condoLp = computeForeclosureFinancials({
        type: 'PREFORECLOSURE',
        zestimate: 280000,
        sourceRawData: JSON.stringify({
          'CASE NUMBER': 'F-10668-26 Condo',
          'RECORDING-DATE': '2026-09-24',
          'LOAN-AMOUNT': '$9,773.00',
          'SITUS-COUNTY': 'PASSAIC',
        }),
      });
      expect(condoLp.foreclosureSubType).toBe('LIS_PENDENS');
      expect(condoLp.baselineLabel).toBe('HOA / Condo Lien');
      expect(condoLp.baselineUpset).toBe(9773);
      expect(condoLp.equitySpread).toBe(270227);
    });

    it('classifies UNDERWATER when upset exceeds Zestimate', () => {
      const fin = computeForeclosureFinancials({
        zestimate: 350000,
        foreclosureAmount: 420000,
      });

      expect(fin.equitySpread).toBe(-70000);
      expect(fin.equitySpreadPct).toBe(-20);
      expect(fin.equityTier).toBe('UNDERWATER');
    });

    it('classifies MODERATE_EQUITY when spread is positive but under $100k and under 30%', () => {
      const fin = computeForeclosureFinancials({
        zestimate: 400000,
        foreclosureAmount: 340000,
      });

      expect(fin.equitySpread).toBe(60000);
      expect(fin.equitySpreadPct).toBe(15);
      expect(fin.equityTier).toBe('MODERATE_EQUITY');
    });
  });
});
