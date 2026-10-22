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
    });
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
    }
  });

  it('rejects wrong lead type, blocked listing statuses, DNC, and repeat sends', () => {
    const list = THANKS_IO_LISTS.PREFORECLOSURE_AUCTION;
    expect(buildThanksIoRecipient(auctionLead({ type: 'PROBATE' }), list, NOW).ok).toBe(false);
    for (const status of ['active', 'sold', 'pending', 'skip']) {
      expect(buildThanksIoRecipient(auctionLead({ listingStatus: status }), list, NOW).ok).toBe(false);
    }
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
    }
  });
});
