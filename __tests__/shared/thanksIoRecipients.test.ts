import { describe, it, expect } from 'vitest';
import {
  THANKS_IO_LISTS,
  buildThanksIoRecipient,
  getThanksIoList,
  parseSaleDate,
  thanksIoListTag,
} from '../../amplify/functions/shared/thanksIoRecipients';

const NOW = new Date(2026, 9, 22); // Oct 22, 2026

const auctionLead = (overrides: Record<string, any> = {}) => ({
  id: 'lead-1',
  type: 'PREFORECLOSURE',
  ownerFirstName: 'DOUGLAS',
  ownerLastName: 'BAUER',
  ownerAddress: '9 WARREN COURT',
  ownerCity: 'OLD BRIDGE',
  ownerState: 'NJ',
  ownerZip: '08857',
  listingStatus: 'off_market',
  zestimate: 745200,
  foreclosureAuctionDate: '2026-12-02',
  foreclosureAmount: 399000,
  ghlContactId: 'ghl-123',
  ...overrides,
});

describe('getThanksIoList', () => {
  it('resolves known list ids and rejects unknown ones', () => {
    expect(getThanksIoList(337586)?.key).toBe('PREFORECLOSURE_AUCTION');
    expect(getThanksIoList(309826)?.key).toBe('PREFORECLOSURE_LIS_PENDENS');
    expect(getThanksIoList(302546)?.key).toBe('PROBATE');
    expect(getThanksIoList(1)).toBeNull();
  });
});

describe('parseSaleDate', () => {
  it('parses US and ISO formats', () => {
    expect(parseSaleDate('12/2/2026')?.getDate()).toBe(2);
    expect(parseSaleDate('2026-12-02')?.getMonth()).toBe(11);
    expect(parseSaleDate('garbage')).toBeNull();
  });
});

describe('buildThanksIoRecipient', () => {
  it('builds an auction payload with sale date and equity', () => {
    const res = buildThanksIoRecipient(auctionLead(), THANKS_IO_LISTS.PREFORECLOSURE_AUCTION, NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payload).toMatchObject({
      mailing_list_id: 337586,
      name: 'Douglas Bauer',
      company: 'Or Current Resident',
      address: '9 Warren Court',
      city: 'Old Bridge',
      province: 'NJ',
      postal_code: '08857',
      custom1: 'ghl-123',
      custom2: '745200',
      custom3: '9 Warren Court',
      custom4: 'Old Bridge',
      custom5: 'December 2, 2026',
      custom6: '$346,200',
      custom7: '399000',
      custom8: '2026-12-02',
    });
  });

  it('keeps QR landing fields URL-safe and consistent with the printed equity', () => {
    const res = buildThanksIoRecipient(auctionLead(), THANKS_IO_LISTS.PREFORECLOSURE_AUCTION, NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { custom2, custom6, custom7, custom8 } = res.payload;
    expect(custom7).toMatch(/^\d+$/);
    expect(custom8).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Landing page computes zest − debt; must equal the equity printed in the letter
    const pageEquity = Number(custom2) - Number(custom7);
    expect(`$${pageEquity.toLocaleString('en-US')}`).toBe(custom6);
  });

  it('mails absentee owners at their mailing address but keeps the property in custom3/4', () => {
    const res = buildThanksIoRecipient(
      auctionLead({ mailingAddress: '1 OTHER ST', mailingCity: 'NEWARK', mailingState: 'nj', mailingZip: '07102' }),
      THANKS_IO_LISTS.PREFORECLOSURE_AUCTION,
      NOW,
    );
    expect(res.ok && res.payload.address).toBe('1 Other St');
    expect(res.ok && res.payload.custom3).toBe('9 Warren Court');
  });

  it('rejects auction leads without a sale date or with a past sale date', () => {
    const noDate = buildThanksIoRecipient(
      auctionLead({ foreclosureAuctionDate: null }),
      THANKS_IO_LISTS.PREFORECLOSURE_AUCTION,
      NOW,
    );
    expect(noDate.ok).toBe(false);

    const past = buildThanksIoRecipient(
      auctionLead({ foreclosureAuctionDate: '2026-10-01' }),
      THANKS_IO_LISTS.PREFORECLOSURE_AUCTION,
      NOW,
    );
    expect(past.ok).toBe(false);
  });

  it('rejects leads without positive equity on equity-based lists', () => {
    const res = buildThanksIoRecipient(
      auctionLead({ foreclosureAuctionDate: null, foreclosureAmount: 900000 }),
      THANKS_IO_LISTS.PREFORECLOSURE_LIS_PENDENS,
      NOW,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/equity/i);
  });

  it('allows lis pendens leads with equity and omits the sale date', () => {
    const res = buildThanksIoRecipient(
      auctionLead({ foreclosureAuctionDate: null }),
      THANKS_IO_LISTS.PREFORECLOSURE_LIS_PENDENS,
      NOW,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.custom5).toBeUndefined();
      expect(res.payload.custom6).toBe('$346,200');
      expect(res.payload.custom7).toBe('399000');
      expect(res.payload.custom8).toBeUndefined();
    }
  });

  it('strictly requires off-market listing status, rejecting all other statuses', () => {
    const list = THANKS_IO_LISTS.PREFORECLOSURE_AUCTION;
    expect(buildThanksIoRecipient(auctionLead({ listingStatus: 'off_market' }), list, NOW).ok).toBe(true);
    expect(buildThanksIoRecipient(auctionLead({ listingStatus: 'off market' }), list, NOW).ok).toBe(true);
    for (const status of ['active', 'sold', 'pending', 'skip', 'fsbo', 'auction', 'door_knock', 'unknown', '']) {
      const res = buildThanksIoRecipient(auctionLead({ listingStatus: status }), list, NOW);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.reason).toMatch(/only off-market/i);
    }
  });

  it('rejects leads with < 30% equity on auction list, but accepts >= 30%', () => {
    const list = THANKS_IO_LISTS.PREFORECLOSURE_AUCTION;
    // 46% equity ($745,200 zestimate, $399,000 debt -> $346,200 spread)
    expect(buildThanksIoRecipient(auctionLead(), list, NOW).ok).toBe(true);

    // 10% equity ($600,000 zestimate, $540,000 debt -> $60,000 spread)
    const lowEquity = buildThanksIoRecipient(
      auctionLead({ zestimate: 600000, foreclosureAmount: 540000 }),
      list,
      NOW,
    );
    expect(lowEquity.ok).toBe(false);
    if (!lowEquity.ok) expect(lowEquity.reason).toMatch(/below the required 30% minimum/i);
  });

  it('handles Call Outcome correctly: allows Wrong Number for mail, blocks terminal dispositions', () => {
    const list = THANKS_IO_LISTS.PREFORECLOSURE_AUCTION;

    // Wrong number -> phone issue, mail IS allowed
    const wrongNum = buildThanksIoRecipient(
      auctionLead({ ghlOutreachData: { callOutcome: 'Wrong Number / Disconnected / Invalid Number' } }),
      list,
      NOW,
    );
    expect(wrongNum.ok).toBe(true);

    // Terminal prospect/property dispositions -> mail BLOCKED
    for (const outcome of [
      'Not Interested',
      'not for sale',
      'DNC',
      'do not call',
      'Unsubscribe',
      'Sold Already',
      'Listed With Realtor',
    ]) {
      const blocked = buildThanksIoRecipient(
        auctionLead({ ghlOutreachData: { callOutcome: outcome } }),
        list,
        NOW,
      );
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) expect(blocked.reason).toMatch(new RegExp(`Call Outcome is "${outcome}"`, 'i'));
    }

    // Normal non-negative outcomes -> mail allowed
    for (const normal of ['Left Voicemail', 'No Answer', 'Spoke - Follow Up']) {
      const okRes = buildThanksIoRecipient(
        auctionLead({ ghlOutreachData: { callOutcome: normal } }),
        list,
        NOW,
      );
      expect(okRes.ok).toBe(true);
    }
  });

  it('rejects wrong lead type, DNC labels, and repeat sends', () => {
    const list = THANKS_IO_LISTS.PREFORECLOSURE_AUCTION;
    expect(buildThanksIoRecipient(auctionLead({ type: 'PROBATE' }), list, NOW).ok).toBe(false);
    expect(buildThanksIoRecipient(auctionLead({ leadLabels: ['DNC'] }), list, NOW).ok).toBe(false);
    expect(
      buildThanksIoRecipient(auctionLead({ customTags: [thanksIoListTag(337586)] }), list, NOW).ok,
    ).toBe(false);
  });

  it('addresses probate letters to the admin at the admin address', () => {
    const res = buildThanksIoRecipient(
      {
        id: 'p1',
        type: 'PROBATE',
        ownerFirstName: 'Jane',
        ownerLastName: 'Doe',
        ownerAddress: '5 Elm St',
        ownerCity: 'Edison',
        ownerState: 'NJ',
        ownerZip: '08817',
        adminFirstName: 'john',
        adminLastName: 'doe',
        adminAddress: '77 Oak Ave',
        adminCity: 'Trenton',
        adminState: 'NJ',
        adminZip: '08608',
      },
      THANKS_IO_LISTS.PROBATE,
      NOW,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.name).toBe('John Doe');
      expect(res.payload.address).toBe('77 Oak Ave');
      expect(res.payload.custom3).toBe('5 Elm St');
      expect(res.payload.custom7).toBeUndefined();
      expect(res.payload.custom8).toBeUndefined();
    }
  });

  it('allows arbitrary lead types (tax delinquent, absentee, vacant) on dynamic user lists', () => {
    const dynamicList = {
      id: 999999,
      label: 'My Custom Absentee Postcards',
    };

    // Tax Delinquent lead
    const taxLead = {
      id: 'tax-1',
      type: 'TAX_DELINQUENT',
      ownerFirstName: 'Robert',
      ownerLastName: 'Smith',
      ownerAddress: '100 Main St',
      ownerCity: 'Freehold',
      ownerState: 'NJ',
      ownerZip: '07728',
      listingStatus: 'off_market',
      zestimate: 450000,
    };
    const taxRes = buildThanksIoRecipient(taxLead, dynamicList, NOW);
    expect(taxRes.ok).toBe(true);
    if (taxRes.ok) {
      expect(taxRes.payload.mailing_list_id).toBe(999999);
      expect(taxRes.payload.name).toBe('Robert Smith');
      expect(taxRes.payload.address).toBe('100 Main St');
      expect(taxRes.payload.custom2).toBe('450000');
    }

    // Absentee Owner lead
    const absenteeLead = {
      id: 'absentee-1',
      type: 'ABSENTEE_OWNER',
      ownerFirstName: 'Mary',
      ownerLastName: 'Johnson',
      ownerAddress: '12 Rental Way',
      ownerCity: 'Toms River',
      ownerState: 'NJ',
      ownerZip: '08753',
      mailingAddress: '55 Florida Sun Blvd',
      mailingCity: 'Miami',
      mailingState: 'FL',
      mailingZip: '33101',
      listingStatus: 'off_market',
    };
    const absenteeRes = buildThanksIoRecipient(absenteeLead, dynamicList, NOW);
    expect(absenteeRes.ok).toBe(true);
    if (absenteeRes.ok) {
      expect(absenteeRes.payload.name).toBe('Mary Johnson');
      expect(absenteeRes.payload.address).toBe('55 Florida Sun Blvd');
      expect(absenteeRes.payload.city).toBe('Miami');
      expect(absenteeRes.payload.province).toBe('FL');
      expect(absenteeRes.payload.custom3).toBe('12 Rental Way');
    }
  });
});
