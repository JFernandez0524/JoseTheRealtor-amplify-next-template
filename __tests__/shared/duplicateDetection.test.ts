import { describe, it, expect } from 'vitest';
import { makeAddressKey } from '@/app/utils/leadValidation';

describe('Duplicate Detection Logic', () => {
  it('correctly identifies genuine duplicate property addresses even with formatting differences', () => {
    // Marion Mockridge: 24 COEYMAN AVENUE, NUTLEY, NJ 07110 vs 24 Coeyman Ave, Nutley
    const incomingCsvPropKey = makeAddressKey('24 COEYMAN AVENUE', '7110');
    const existingDbPropKey = makeAddressKey('24 Coeyman Ave.', '07110');

    expect(incomingCsvPropKey).toBe('24 coeyman ave|07110');
    expect(existingDbPropKey).toBe('24 coeyman ave|07110');
    expect(incomingCsvPropKey).toBe(existingDbPropKey);
  });

  it('does NOT flag different properties as duplicates when they share an administrator/attorney', () => {
    // Ruth Kaplan (Property: 567B NUTLEY DRIVE, MONROE) vs Lorraine Lebo (Property: 9a John Hancock Drive, Monroe)
    // Both had Administrator mailing address: 9 Tigers Court, Hamilton 08619
    const ruthKaplanPropKey = makeAddressKey('567B NUTLEY DRIVE', '8831');
    const lorraineLeboPropKey = makeAddressKey('9a John Hancock Drive', '08831');
    const sharedAdminKey = makeAddressKey('9 Tigers Court', '08619');

    // Property keys must be distinct
    expect(ruthKaplanPropKey).toBe('567b nutley dr|08831');
    expect(lorraineLeboPropKey).toBe('9a john hancock dr|08831');
    expect(ruthKaplanPropKey).not.toBe(lorraineLeboPropKey);

    // Property keys must not equal admin key
    expect(ruthKaplanPropKey).not.toBe(sharedAdminKey);
    expect(lorraineLeboPropKey).not.toBe(sharedAdminKey);

    // James Conover (Property: 37 FORD AVENUE, FREEHOLD) vs Vincent Supienski (Property: 22 Hollywood Avenue, Leonardo)
    // Both had attorney James Homiak with office/mailing address: 6 Bayhill Road, Leonardo 07737
    const jamesConoverPropKey = makeAddressKey('37 FORD AVENUE', '7728');
    const vincentSupienskiPropKey = makeAddressKey('22 Hollywood Avenue', '07737');
    const homiakAdminKey = makeAddressKey('6 Bayhill Road', '07737');

    expect(jamesConoverPropKey).toBe('37 ford ave|07728');
    expect(vincentSupienskiPropKey).toBe('22 hollywood ave|07737');
    expect(jamesConoverPropKey).not.toBe(vincentSupienskiPropKey);

    expect(jamesConoverPropKey).not.toBe(homiakAdminKey);
  });

  it('accurately maintains preloaded existing property keys set', () => {
    const existingAddressKeys = new Set<string>();

    // Seed existing database leads by physical property address
    const existingLeads = [
      { id: 'lead-mockridge', ownerAddress: '24 Coeyman Ave', ownerZip: '07110', mailingAddress: '106 Willow St', mailingZip: '07704' },
      { id: 'lead-lebo', ownerAddress: '9a John Hancock Drive', ownerZip: '08831', mailingAddress: '9 Tigers Court', mailingZip: '08619' },
      { id: 'lead-supienski', ownerAddress: '22 Hollywood Avenue', ownerZip: '07737', mailingAddress: '6 Bayhill Road', mailingZip: '07737' },
    ];

    for (const lead of existingLeads) {
      const propKey = makeAddressKey(lead.ownerAddress, lead.ownerZip);
      if (propKey) existingAddressKeys.add(propKey);
    }

    // Verify existing property keys are in the set
    expect(existingAddressKeys.has('24 coeyman ave|07110')).toBe(true);
    expect(existingAddressKeys.has('9a john hancock dr|08831')).toBe(true);
    expect(existingAddressKeys.has('22 hollywood ave|07737')).toBe(true);

    // Verify admin mailing addresses are NOT in the set
    expect(existingAddressKeys.has('9 tigers ct|08619')).toBe(false);
    expect(existingAddressKeys.has('6 bayhill rd|07737')).toBe(false);
    expect(existingAddressKeys.has('106 willow st|07704')).toBe(false);

    // Incoming upload simulation
    const rowMockridge = makeAddressKey('24 COEYMAN AVENUE', '7110')!;
    const rowRuthKaplan = makeAddressKey('567B NUTLEY DRIVE', '8831')!;
    const rowJamesConover = makeAddressKey('37 FORD AVENUE', '7728')!;

    // Mockridge MUST be caught as duplicate
    expect(existingAddressKeys.has(rowMockridge)).toBe(true);

    // Ruth Kaplan and James Conover MUST NOT be caught as duplicates
    expect(existingAddressKeys.has(rowRuthKaplan)).toBe(false);
    expect(existingAddressKeys.has(rowJamesConover)).toBe(false);
  });
});
