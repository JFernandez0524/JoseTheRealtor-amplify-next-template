import { describe, it, expect } from 'vitest';
import { billableSkipCount, BILLABLE_SKIP_STATUSES } from '../../amplify/functions/shared/skiptraceBilling';

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
