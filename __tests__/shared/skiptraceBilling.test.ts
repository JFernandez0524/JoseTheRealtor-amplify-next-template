import { describe, it, expect } from 'vitest';
import {
  billableSkipCount,
  BILLABLE_SKIP_STATUSES,
  creditsFor,
  dollarsFor,
  DOLLARS_PER_CREDIT,
  SKIPTRACE_CREDITS_PER_MATCH,
  ENRICHMENT_CREDITS_PER_MATCH,
} from '../../amplify/functions/shared/skiptraceBilling';

// Pure billing rule — BatchData bills per matched record, never for NO_MATCH.

describe('billableSkipCount', () => {
  it('charges for matched records (SUCCESS + NO_QUALITY_CONTACTS)', () => {
    expect(billableSkipCount(['SUCCESS'])).toBe(1);
    expect(billableSkipCount(['NO_QUALITY_CONTACTS'])).toBe(1);
    expect(billableSkipCount(['SUCCESS', 'NO_QUALITY_CONTACTS', 'SUCCESS'])).toBe(3);
  });

  it('never charges for NO_MATCH (BatchData found nobody = free)', () => {
    expect(billableSkipCount(['NO_MATCH'])).toBe(0);
    expect(billableSkipCount(['NO_MATCH', 'NO_MATCH'])).toBe(0);
  });

  it('never charges for FAILED / ERROR / INVALID_GEO', () => {
    expect(billableSkipCount(['FAILED', 'ERROR', 'INVALID_GEO'])).toBe(0);
  });

  it('counts only the billable ones in a mixed batch', () => {
    // 2 SUCCESS + 1 NO_QUALITY billable; 2 NO_MATCH + 1 FAILED free → 3
    expect(
      billableSkipCount(['SUCCESS', 'NO_MATCH', 'NO_QUALITY_CONTACTS', 'NO_MATCH', 'FAILED', 'SUCCESS'])
    ).toBe(3);
  });

  it('tolerates null / undefined / unknown statuses', () => {
    expect(billableSkipCount([null, undefined, '', 'WHATEVER', 'SUCCESS'])).toBe(1);
  });

  it('BILLABLE set is exactly the two matched-record statuses', () => {
    expect([...BILLABLE_SKIP_STATUSES].sort()).toEqual(['NO_QUALITY_CONTACTS', 'SUCCESS']);
  });
});

describe('credit charge math', () => {
  it('rates are correct (skip 1/match, enrich 3/match, $0.10/credit)', () => {
    expect(SKIPTRACE_CREDITS_PER_MATCH).toBe(1);
    expect(ENRICHMENT_CREDITS_PER_MATCH).toBe(3);
    expect(DOLLARS_PER_CREDIT).toBe(0.1);
  });

  it('creditsFor = matched × rate, never negative', () => {
    expect(creditsFor(12, SKIPTRACE_CREDITS_PER_MATCH)).toBe(12); // skip: 12 × 1
    expect(creditsFor(4, ENRICHMENT_CREDITS_PER_MATCH)).toBe(12); // enrich: 4 × 3
    expect(creditsFor(0, ENRICHMENT_CREDITS_PER_MATCH)).toBe(0); // no match → no charge
    expect(creditsFor(-3, SKIPTRACE_CREDITS_PER_MATCH)).toBe(0);
  });

  it('dollarsFor converts credits at $0.10 each (2dp)', () => {
    expect(dollarsFor(12)).toBe(1.2); // 12 skip matches = $1.20
    expect(dollarsFor(12)).toBe(1.2); // 4 enrich matches × 3 = 12 credits = $1.20
    expect(dollarsFor(0)).toBe(0);
    expect(dollarsFor(3)).toBe(0.3); // 1 enrich match = 3 credits = $0.30
  });
});
