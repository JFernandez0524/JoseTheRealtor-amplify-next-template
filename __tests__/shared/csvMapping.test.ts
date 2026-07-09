import { describe, it, expect } from 'vitest';
import {
  canonicalFields,
  autoDetectMapping,
  missingRequired,
  resolveOwnerName,
  parseOwnershipName,
} from '../../app/utils/csvMapping';

// Real header rows from county files, to prove auto-detect maps arbitrary layouts.
const COUNTY_HEADERS = [
  'CASE NUMBER', 'RECORDING DATE', 'LOAN AMOUNT', 'BORROWER OR DEFENDANT NAME',
  'LENDER OR PLAINTIFF NAME', 'TRUSTEE OR DEPUTY NAME', 'SITUS ADDRESS', 'SITUS CITY',
  'SITUS COUNTY', 'STATE', 'SITUS ZIP', 'PARCEL ID NO',
];

describe('autoDetectMapping (preforeclosure)', () => {
  const fields = canonicalFields('PREFORECLOSURE');
  const mapping = autoDetectMapping(COUNTY_HEADERS, fields);

  it('maps the county headers to canonical fields', () => {
    expect(mapping.ownerAddress).toBe('SITUS ADDRESS');
    expect(mapping.ownerCity).toBe('SITUS CITY');
    expect(mapping.ownerState).toBe('STATE');
    expect(mapping.ownerZip).toBe('SITUS ZIP');
    expect(mapping.ownerFullName).toBe('BORROWER OR DEFENDANT NAME');
    expect(mapping.recordingDate).toBe('RECORDING DATE');
    expect(mapping.caseNumber).toBe('CASE NUMBER');
    expect(mapping.lender).toBe('LENDER OR PLAINTIFF NAME');
    expect(mapping.trustee).toBe('TRUSTEE OR DEPUTY NAME');
    expect(mapping.loanAmount).toBe('LOAN AMOUNT');
  });

  it('does not invent mappings for unrelated headers', () => {
    expect(mapping.phone).toBeUndefined();
    expect(mapping.estimatedValue).toBeUndefined();
  });

  it('maps a split first/last name file', () => {
    const m = autoDetectMapping(['First Name', 'Last Name', 'ownerAddress', 'ownerZip', 'ownerCity', 'ownerState'], fields);
    expect(m.ownerFirstName).toBe('First Name');
    expect(m.ownerLastName).toBe('Last Name');
    expect(m.ownerFullName).toBeUndefined();
  });

  it('uses each source header at most once', () => {
    const values = Object.values(mapping);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('missingRequired (either/or owner name)', () => {
  const fields = canonicalFields('PREFORECLOSURE');

  it('is satisfied by a combined full-name column', () => {
    const m = { ownerFullName: 'X', ownerAddress: 'A', ownerCity: 'C', ownerState: 'S', ownerZip: 'Z' };
    expect(missingRequired(m, fields)).toEqual([]);
  });

  it('is satisfied by split first + last', () => {
    const m = { ownerFirstName: 'F', ownerLastName: 'L', ownerAddress: 'A', ownerCity: 'C', ownerState: 'S', ownerZip: 'Z' };
    expect(missingRequired(m, fields)).toEqual([]);
  });

  it('flags a missing name when neither combined nor both split are mapped', () => {
    const m = { ownerFirstName: 'F', ownerAddress: 'A', ownerCity: 'C', ownerState: 'S', ownerZip: 'Z' };
    expect(missingRequired(m, fields)).toContain('ownerName');
  });

  it('flags missing address/zip', () => {
    const m = { ownerFullName: 'X' };
    const miss = missingRequired(m, fields);
    expect(miss).toContain('ownerAddress');
    expect(miss).toContain('ownerZip');
  });
});

describe('missingRequired (probate admin)', () => {
  const fields = canonicalFields('PROBATE');
  const base = {
    ownerFullName: 'Owner', ownerAddress: 'A', ownerCity: 'C', ownerState: 'S', ownerZip: 'Z',
  };

  it('requires admin address fields and an admin name', () => {
    const miss = missingRequired(base, fields);
    expect(miss).toContain('adminAddress');
    expect(miss).toContain('adminCity');
    expect(miss).toContain('adminState');
    expect(miss).toContain('adminZip');
    expect(miss).toContain('adminName');
  });

  it('passes when admin name (split) + full admin address are mapped', () => {
    const m = {
      ...base,
      adminFirstName: 'AF', adminLastName: 'AL',
      adminAddress: 'AA', adminCity: 'AC', adminState: 'AS', adminZip: 'AZ',
    };
    expect(missingRequired(m, fields)).toEqual([]);
  });

  it('does not require admin fields for preforeclosure', () => {
    const pf = canonicalFields('PREFORECLOSURE');
    const miss = missingRequired(base, pf);
    expect(miss).not.toContain('adminName');
    expect(miss).not.toContain('adminAddress');
  });
});

describe('resolveOwnerName', () => {
  it('splits a combined "First Last" name', () => {
    expect(resolveOwnerName({ full: 'Kelly Mooney' })).toEqual({ firstName: 'Kelly', lastName: 'Mooney', isEntity: false });
  });

  it('prefers split first/last when provided', () => {
    expect(resolveOwnerName({ first: 'ANNE MARIE', last: 'GRADY' })).toEqual({ firstName: 'Anne marie', lastName: 'Grady', isEntity: false });
  });

  it('flags entities and keeps the legal name intact', () => {
    const r = resolveOwnerName({ full: 'Showboat Properties LLC' });
    expect(r.isEntity).toBe(true);
    expect(r.firstName).toBe('');
    expect(r.lastName).toBe('Showboat Properties LLC');
  });

  it('detects an entity even when given as split columns', () => {
    const r = resolveOwnerName({ first: 'Delaware Valley', last: 'Opportunity Fund 231' });
    expect(r.isEntity).toBe(true);
  });

  it('handles empty input', () => {
    expect(resolveOwnerName({})).toEqual({ firstName: '', lastName: '', isEntity: false });
  });
});

describe('parseOwnershipName (LAST, FIRST)', () => {
  it('handles comma order', () => {
    expect(parseOwnershipName('MOONEY, KELLY')).toEqual({ firstName: 'Kelly', lastName: 'Mooney' });
  });
});
