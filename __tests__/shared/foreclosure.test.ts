import { describe, it, expect } from 'vitest';
import {
  classifyForeclosureStage,
  isActiveForeclosure,
  classifyForeclosureStageWithRecency,
} from '../../app/utils/foreclosure';

// Helpers to build ISO dates relative to a fixed "fresh filing" for recency tests.
const daysAgo = (from: string, days: number) =>
  new Date(new Date(from).getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const FRESH = '2026-07-02'; // matches the sample county file recording date

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

describe('classifyForeclosureStageWithRecency', () => {
  it('promotes a stale DEAD record to ACTIVE when it predates the fresh county filing', () => {
    const r = classifyForeclosureStageWithRecency({
      foreclosureStatus: 'Notice of Rescission',
      countyFilingDate: FRESH,
      foreclosureRecordingDate: '2023-04-06', // BatchData record from years earlier
    });
    expect(r.baseStage).toBe('DEAD');
    expect(r.stage).toBe('ACTIVE');
    expect(r.stale).toBe(true);
  });

  it('keeps DEAD when the rescission is recent (not stale)', () => {
    const r = classifyForeclosureStageWithRecency({
      foreclosureStatus: 'Notice of Rescission',
      countyFilingDate: FRESH,
      foreclosureRecordingDate: daysAgo(FRESH, 30), // within the staleness window
    });
    expect(r.stage).toBe('DEAD');
    expect(r.stale).toBe(false);
  });

  it('falls back to createdAt as the anchor for legacy leads without countyFilingDate', () => {
    const r = classifyForeclosureStageWithRecency({
      foreclosureStatus: 'Rescission Recording',
      createdAt: '2026-07-01T12:00:00.000Z',
      foreclosureData: { filingDate: '2023-01-01T00:00:00.000Z' },
    });
    expect(r.stage).toBe('ACTIVE');
    expect(r.stale).toBe(true);
  });

  it('does not promote non-DEAD stages, and never marks them stale', () => {
    const active = classifyForeclosureStageWithRecency({
      foreclosureStatus: 'Notice of Default',
      countyFilingDate: FRESH,
      foreclosureRecordingDate: '2020-01-01',
    });
    expect(active.stage).toBe('ACTIVE');
    expect(active.stale).toBe(false);
  });

  it('is not stale when there is no date to compare', () => {
    const r = classifyForeclosureStageWithRecency({ foreclosureStatus: 'Notice of Rescission' });
    expect(r.stage).toBe('DEAD');
    expect(r.stale).toBe(false);
  });
});
