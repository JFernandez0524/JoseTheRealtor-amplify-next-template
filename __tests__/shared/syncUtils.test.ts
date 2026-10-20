import { describe, it, expect } from 'vitest';
import { validateLeadForSync } from '../../amplify/functions/shared/syncUtils';

describe('validateLeadForSync', () => {
  it('validates off_market lead with completed skip trace as valid', () => {
    const lead = {
      listingStatus: 'off_market',
      skipTraceStatus: 'COMPLETED',
    };
    expect(validateLeadForSync(lead)).toEqual({ isValid: true });
  });

  it('validates lead with missing listingStatus (defaults to off-market) with completed skip trace as valid', () => {
    const lead = {
      skipTraceStatus: 'COMPLETED',
    };
    expect(validateLeadForSync(lead)).toEqual({ isValid: true });
  });

  it('rejects lead with listingStatus = "sold"', () => {
    const lead = {
      listingStatus: 'sold',
      skipTraceStatus: 'COMPLETED',
    };
    const result = validateLeadForSync(lead);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('listing status is \'sold\'');
  });

  it('rejects lead with non-off-market listing statuses (active, pending, fsbo, auction)', () => {
    const statuses = ['active', 'pending', 'fsbo', 'auction', 'door_knock', 'skip'];
    for (const status of statuses) {
      const lead = {
        listingStatus: status,
        skipTraceStatus: 'COMPLETED',
      };
      const result = validateLeadForSync(lead);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain(`listing status is '${status}'`);
    }
  });

  it('rejects lead if skip trace is not completed even if off_market', () => {
    const lead = {
      listingStatus: 'off_market',
      skipTraceStatus: 'PENDING',
    };
    const result = validateLeadForSync(lead);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('Skip trace not completed');
  });

  it('accepts NO_QUALITY_CONTACTS (Direct Mail Only) for off_market leads and rejects NO_MATCH', () => {
    expect(validateLeadForSync({ listingStatus: 'off_market', skipTraceStatus: 'NO_QUALITY_CONTACTS' })).toEqual({ isValid: true });
    const noMatchResult = validateLeadForSync({ listingStatus: 'off_market', skipTraceStatus: 'NO_MATCH' });
    expect(noMatchResult.isValid).toBe(false);
    expect(noMatchResult.reason).toContain('Skip trace not completed');
  });

  it('rejects lead with ACTIVE_MLS label even if listingStatus is unset', () => {
    const lead = {
      leadLabels: ['ACTIVE_MLS', 'ABSENTEE'],
      skipTraceStatus: 'COMPLETED',
    };
    const result = validateLeadForSync(lead);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('ACTIVE_MLS');
  });

  it('rejects lead with RECENTLY_SOLD label even if listingStatus is unset', () => {
    const lead = {
      leadLabels: ['RECENTLY_SOLD'],
      skipTraceStatus: 'COMPLETED',
    };
    const result = validateLeadForSync(lead);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('RECENTLY_SOLD');
  });

  it('normalizes listingStatus case and whitespace (e.g. OFF_MARKET)', () => {
    const lead = {
      listingStatus: ' OFF_MARKET ',
      skipTraceStatus: 'COMPLETED',
    };
    expect(validateLeadForSync(lead)).toEqual({ isValid: true });
  });
});
