import { describe, it, expect } from 'vitest';
import {
  isDirectMailOnlyLead,
  isCallableLead,
  hasAnyContactChannel,
  hasConcludedSkipTrace,
  resolveDialablePhone,
} from '../../amplify/functions/shared/contactChannels';

// The rule: direct mail is the last resort, only for a lead whose skip trace concluded and found
// no mobile, no landline and no email. Both halves matter — the previous implementation mailed
// leads *because* they had an email, and mailed leads that were perfectly callable on a landline.

const lead = (o: Partial<Parameters<typeof isDirectMailOnlyLead>[0]> = {}) => ({
  phones: [],
  landlinePhones: [],
  emails: [],
  skipTraceStatus: 'COMPLETED',
  ...o,
});

describe('resolveDialablePhone', () => {
  it('prefers the mobile assigned to this contact', () => {
    expect(resolveDialablePhone('5551112222', ['5553334444'])).toBe('5551112222');
  });

  it('falls back to the first landline when there is no mobile', () => {
    expect(resolveDialablePhone('', ['5553334444', '5555556666'])).toBe('5553334444');
    expect(resolveDialablePhone(null, ['5553334444'])).toBe('5553334444');
  });

  it('returns null when there is nothing to dial', () => {
    expect(resolveDialablePhone('', [])).toBeNull();
    expect(resolveDialablePhone(null, null)).toBeNull();
    expect(resolveDialablePhone(undefined, undefined)).toBeNull();
  });

  it('ignores blank entries rather than returning an empty string', () => {
    // An empty string here would land in GHL's primary phone field and look like a real number.
    expect(resolveDialablePhone('   ', ['', '  ', '5557778888'])).toBe('5557778888');
    expect(resolveDialablePhone('', ['', null])).toBeNull();
  });
});

describe('hasConcludedSkipTrace', () => {
  it('is true only once a trace actually ran', () => {
    for (const s of ['COMPLETED', 'NO_MATCH', 'NO_QUALITY_CONTACTS']) {
      expect(hasConcludedSkipTrace(s)).toBe(true);
    }
  });

  it('is false while a trace is pending or never happened', () => {
    // "No contacts yet" is not "no contacts" — a trace may still find a phone or email.
    for (const s of ['PENDING', 'FAILED', 'NOT_ELIGIBLE', '', null, undefined]) {
      expect(hasConcludedSkipTrace(s)).toBe(false);
    }
  });

  it('is case-insensitive', () => {
    expect(hasConcludedSkipTrace('completed')).toBe(true);
  });
});

describe('isCallableLead', () => {
  it('counts a landline as callable', () => {
    expect(isCallableLead(lead({ landlinePhones: ['5553334444'] }))).toBe(true);
  });

  it('counts a mobile as callable', () => {
    expect(isCallableLead(lead({ phones: ['5551112222'] }))).toBe(true);
  });

  it('is false with only an email', () => {
    expect(isCallableLead(lead({ emails: ['a@b.com'] }))).toBe(false);
  });

  it('ignores blank and null entries', () => {
    expect(isCallableLead(lead({ phones: ['', '  '], landlinePhones: [null] }))).toBe(false);
  });
});

describe('isDirectMailOnlyLead', () => {
  it('mails a concluded trace that found nothing', () => {
    expect(isDirectMailOnlyLead(lead({ skipTraceStatus: 'NO_MATCH' }))).toBe(true);
    expect(isDirectMailOnlyLead(lead({ skipTraceStatus: 'NO_QUALITY_CONTACTS' }))).toBe(true);
  });

  it('does NOT mail a lead with a landline — it is callable', () => {
    // The old rule mailed these; a landline-reachable lead is not a mail lead.
    expect(isDirectMailOnlyLead(lead({
      skipTraceStatus: 'NO_QUALITY_CONTACTS',
      landlinePhones: ['5553334444'],
    }))).toBe(false);
  });

  it('does NOT mail a lead with an email', () => {
    // The old rule mailed a lead *because* it had an email and no phone — backwards.
    expect(isDirectMailOnlyLead(lead({ emails: ['a@b.com'] }))).toBe(false);
  });

  it('does NOT mail a lead with a mobile', () => {
    expect(isDirectMailOnlyLead(lead({ phones: ['5551112222'] }))).toBe(false);
  });

  it('does NOT mail an untraced lead, even with no contacts', () => {
    // 35 PENDING and 9 FAILED leads would otherwise start receiving mail before anyone had
    // looked for a phone number for them.
    expect(isDirectMailOnlyLead(lead({ skipTraceStatus: 'PENDING' }))).toBe(false);
    expect(isDirectMailOnlyLead(lead({ skipTraceStatus: 'FAILED' }))).toBe(false);
    expect(isDirectMailOnlyLead(lead({ skipTraceStatus: 'NOT_ELIGIBLE' }))).toBe(false);
  });

  it('needs every channel absent, not just one', () => {
    expect(isDirectMailOnlyLead(lead({ landlinePhones: ['x'], emails: ['a@b.com'] }))).toBe(false);
    expect(isDirectMailOnlyLead(lead({ phones: ['x'], emails: ['a@b.com'] }))).toBe(false);
  });

  it('treats blank-only arrays as no contact', () => {
    expect(isDirectMailOnlyLead(lead({ phones: [''], landlinePhones: [null], emails: ['  '] }))).toBe(true);
  });
});

describe('hasAnyContactChannel', () => {
  it('is true for any single channel', () => {
    expect(hasAnyContactChannel(lead({ phones: ['x'] }))).toBe(true);
    expect(hasAnyContactChannel(lead({ landlinePhones: ['x'] }))).toBe(true);
    expect(hasAnyContactChannel(lead({ emails: ['a@b.com'] }))).toBe(true);
  });

  it('is false when every channel is empty', () => {
    expect(hasAnyContactChannel(lead())).toBe(false);
  });
});
