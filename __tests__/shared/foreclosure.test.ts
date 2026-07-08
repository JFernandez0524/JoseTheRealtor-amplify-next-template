import { describe, it, expect } from 'vitest';
import { classifyForeclosureStage, isActiveForeclosure } from '../../app/utils/foreclosure';

describe('classifyForeclosureStage', () => {
  it('classifies dead recordings (real value: "Rescission Recording")', () => {
    expect(classifyForeclosureStage('Rescission Recording')).toBe('DEAD');
    expect(classifyForeclosureStage('Notice of Rescission')).toBe('DEAD');
    expect(classifyForeclosureStage('Release')).toBe('DEAD');
    expect(classifyForeclosureStage('Reinstatement')).toBe('DEAD');
    expect(classifyForeclosureStage('Cancellation of Sale')).toBe('DEAD');
  });

  it('classifies auction-stage recordings (most urgent)', () => {
    expect(classifyForeclosureStage('Notice of Sale')).toBe('AUCTION');
    expect(classifyForeclosureStage('Notice of Trustee Sale')).toBe('AUCTION');
    expect(classifyForeclosureStage('Sheriff Sale')).toBe('AUCTION');
    expect(classifyForeclosureStage('Notice of Foreclosure Sale')).toBe('AUCTION');
  });

  it('classifies active (early) recordings', () => {
    expect(classifyForeclosureStage('Notice of Default')).toBe('ACTIVE');
    expect(classifyForeclosureStage('Lis Pendens')).toBe('ACTIVE');
    expect(classifyForeclosureStage('NOD')).toBe('ACTIVE');
  });

  it('dead overrides active keywords (a rescinded default is dead)', () => {
    expect(classifyForeclosureStage('Rescission of Notice of Default')).toBe('DEAD');
  });

  it('returns UNKNOWN for empty / null / unrecognized', () => {
    expect(classifyForeclosureStage('')).toBe('UNKNOWN');
    expect(classifyForeclosureStage(null)).toBe('UNKNOWN');
    expect(classifyForeclosureStage(undefined)).toBe('UNKNOWN');
    expect(classifyForeclosureStage('Something Else')).toBe('UNKNOWN');
  });
});

describe('isActiveForeclosure', () => {
  it('true for ACTIVE and AUCTION, false otherwise', () => {
    expect(isActiveForeclosure('Notice of Default')).toBe(true);
    expect(isActiveForeclosure('Notice of Sale')).toBe(true);
    expect(isActiveForeclosure('Rescission Recording')).toBe(false);
    expect(isActiveForeclosure('')).toBe(false);
    expect(isActiveForeclosure('Something Else')).toBe(false);
  });
});
