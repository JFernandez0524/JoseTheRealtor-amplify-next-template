import { describe, it, expect } from 'vitest';
import { getLeadTypeContext } from '../../app/utils/ai/emailConversationHandler';

describe('getLeadTypeContext', () => {
  it('correctly maps PROBATE leads and NEVER mentions foreclosure', () => {
    const variations = ['PROBATE', 'probate', 'Probate', 'probate_lead', 'PROBATE LEAD'];
    for (const v of variations) {
      const ctx = getLeadTypeContext(v);
      expect(ctx.normalizedType).toBe('PROBATE');
      expect(ctx.displayType).toBe('estate / probate');
      expect(ctx.situationContext).toContain('settling estates');
      expect(ctx.touch4Empathy).toContain('settling an estate');
      expect(ctx.touch6Urgency).toContain('probate estates have legal timelines');

      // Crucial: Foreclosure must NEVER be present anywhere in probate context
      const allText = Object.values(ctx).join(' ').toLowerCase();
      expect(allText).not.toContain('foreclosure');
      expect(allText).not.toContain('auction');
    }
  });

  it('correctly maps PREFORECLOSURE leads and includes appropriate foreclosure/auction context', () => {
    const variations = ['PREFORECLOSURE', 'preforeclosure', 'Preforeclosure', 'PRE FORECLOSURE', 'pre-foreclosure', 'FORECLOSURE'];
    for (const v of variations) {
      const ctx = getLeadTypeContext(v);
      expect(ctx.normalizedType).toBe('PREFORECLOSURE');
      expect(ctx.displayType).toBe('pre-foreclosure');
      expect(ctx.situationContext).toContain('avoid foreclosure');
      expect(ctx.touch4Empathy).toContain('foreclosure');
      expect(ctx.touch6Urgency).toContain('foreclosure and auction timelines');
    }
  });

  it('correctly maps FSBO leads and NEVER mentions foreclosure', () => {
    const variations = ['FSBO', 'fsbo', 'FOR SALE BY OWNER', 'for-sale-by-owner'];
    for (const v of variations) {
      const ctx = getLeadTypeContext(v);
      expect(ctx.normalizedType).toBe('FSBO');
      expect(ctx.displayType).toBe('for-sale-by-owner');
      expect(ctx.touch4Empathy).toContain('showings');
      const allText = Object.values(ctx).join(' ').toLowerCase();
      expect(allText).not.toContain('foreclosure');
      expect(allText).not.toContain('probate');
    }
  });

  it('correctly maps TAX DELINQUENT leads and NEVER mentions foreclosure', () => {
    const variations = ['TAX DELINQUENT', 'tax delinquent', 'TAX_DELINQUENT'];
    for (const v of variations) {
      const ctx = getLeadTypeContext(v);
      expect(ctx.normalizedType).toBe('TAX DELINQUENT');
      expect(ctx.touch4Empathy).toContain('tax liens');
      const allText = Object.values(ctx).join(' ').toLowerCase();
      expect(allText).not.toContain('foreclosure');
      expect(allText).not.toContain('probate');
    }
  });

  it('correctly maps VACANT leads and NEVER mentions foreclosure', () => {
    const variations = ['VACANT', 'vacant', 'vacant property'];
    for (const v of variations) {
      const ctx = getLeadTypeContext(v);
      expect(ctx.normalizedType).toBe('VACANT');
      expect(ctx.touch4Empathy).toContain('empty property');
      const allText = Object.values(ctx).join(' ').toLowerCase();
      expect(allText).not.toContain('foreclosure');
      expect(allText).not.toContain('probate');
    }
  });

  it('correctly maps DRIVING FOR DOLLARS and SELL AS IS leads and NEVER mentions foreclosure', () => {
    const variations = ['DRIVING FOR DOLLARS', 'driving for dollars', 'SELL AS IS', 'sell as is'];
    for (const v of variations) {
      const ctx = getLeadTypeContext(v);
      expect(ctx.normalizedType).toBe('SELL AS IS');
      expect(ctx.touch4Empathy).toContain('repairs');
      const allText = Object.values(ctx).join(' ').toLowerCase();
      expect(allText).not.toContain('foreclosure');
      expect(allText).not.toContain('probate');
    }
  });

  it('defaults missing, null, or OTHER lead types to neutral context without foreclosure or probate', () => {
    const variations = [null, undefined, '', 'OTHER', 'other', 'GENERAL INQUIRY', 'random'];
    for (const v of variations) {
      const ctx = getLeadTypeContext(v);
      expect(ctx.displayType).toBe('property');
      expect(ctx.situationContext).toContain('explore their selling options');
      const allText = Object.values(ctx).join(' ').toLowerCase();
      expect(allText).not.toContain('foreclosure');
      expect(allText).not.toContain('probate');
    }
  });
});
