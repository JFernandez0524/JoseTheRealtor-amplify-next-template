import { describe, it, expect } from 'vitest';
import { selectOwnerId } from '../../amplify/functions/shared/tenantResolver';

// selectOwnerId is pure — it encodes the multi-tenant safety property that a contact is
// only attributed to a tenant when every matched record agrees on exactly one owner.
// (resolveOwnerByGhlContactId itself needs DynamoDB and is exercised via manual/e2e testing.)

describe('selectOwnerId', () => {
  it('returns the sole owner when exactly one candidate matches', () => {
    expect(selectOwnerId([{ owner: 'user-a' }])).toBe('user-a');
  });

  it('returns the owner when multiple candidates all share the same owner', () => {
    expect(
      selectOwnerId([{ owner: 'user-a' }, { owner: 'user-a' }]),
    ).toBe('user-a');
  });

  it('returns null when there are no candidates (unknown contact)', () => {
    expect(selectOwnerId([])).toBeNull();
  });

  it('returns null when candidates disagree on owner (never guess a tenant)', () => {
    // The critical safety case: acting here would touch the wrong tenant's data.
    expect(
      selectOwnerId([{ owner: 'user-a' }, { owner: 'user-b' }]),
    ).toBeNull();
  });

  it('ignores candidates with a missing/empty owner', () => {
    expect(
      selectOwnerId([{ owner: null }, { owner: undefined }, { owner: 'user-a' }]),
    ).toBe('user-a');
  });

  it('returns null when every candidate lacks an owner', () => {
    expect(selectOwnerId([{ owner: null }, { owner: '' }])).toBeNull();
  });
});
