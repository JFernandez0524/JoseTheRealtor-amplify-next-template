import { describe, it, expect } from 'vitest';
import {
  dispositionAction,
  isTerminalDisposition,
  isDncDisposition,
  detectCallOutcomeFromMessage,
  callOutcomeForEndReason,
} from '../../amplify/functions/shared/dispositions';

describe('dispositionAction', () => {
  it('returns DNC for legal opt-out outcomes', () => {
    expect(dispositionAction('DNC')).toBe('DNC');
    expect(dispositionAction('Do Not Call')).toBe('DNC');
    expect(dispositionAction('unsubscribe')).toBe('DNC');
  });

  it('returns STOP for negative business terminal outcomes', () => {
    expect(dispositionAction('Sold Already')).toBe('STOP');
    expect(dispositionAction('Not Interested')).toBe('STOP');
    expect(dispositionAction('Not For Sale')).toBe('STOP');
    expect(dispositionAction('Listed With Realtor')).toBe('STOP');
  });

  it('returns STOP for wrong-number option strings', () => {
    expect(dispositionAction('Wrong Number / Disconnected / Invalid Number')).toBe('STOP');
    expect(dispositionAction('wrong number / disconnected / invalid number')).toBe('STOP');
    expect(dispositionAction('Incorrect Number')).toBe('STOP');
  });

  it('returns ENGAGED for Appointment Set (pause, not opt-out)', () => {
    expect(dispositionAction('Appointment Set')).toBe('ENGAGED');
    expect(dispositionAction('  appointment set ')).toBe('ENGAGED');
  });

  it('returns NONE for non-terminal outcomes (cadence continues)', () => {
    expect(dispositionAction('No Answer')).toBe('NONE');
    expect(dispositionAction('Left Voicemail')).toBe('NONE');
    expect(dispositionAction('Spoke - Follow Up')).toBe('NONE');
    expect(dispositionAction('Timeline / Not Ready Yet')).toBe('NONE');
    expect(dispositionAction('DEAD / Max Attempts')).toBe('NONE');
  });

  it('returns NONE for empty / null / non-string', () => {
    expect(dispositionAction('')).toBe('NONE');
    expect(dispositionAction(null)).toBe('NONE');
    expect(dispositionAction(undefined)).toBe('NONE');
    expect(dispositionAction(123 as any)).toBe('NONE');
  });
});

describe('isTerminalDisposition', () => {
  it('is true for DNC and negative terminal outcomes', () => {
    expect(isTerminalDisposition('DNC')).toBe(true);
    expect(isTerminalDisposition('Sold Already')).toBe(true);
    expect(isTerminalDisposition('Not Interested')).toBe(true);
    expect(isTerminalDisposition('Wrong Number / Disconnected / Invalid Number')).toBe(true);
  });

  it('is false for ENGAGED and non-terminal outcomes', () => {
    expect(isTerminalDisposition('Appointment Set')).toBe(false);
    expect(isTerminalDisposition('No Answer')).toBe(false);
    expect(isTerminalDisposition(null)).toBe(false);
  });
});

describe('isDncDisposition', () => {
  it('returns true only for DNC outcomes', () => {
    expect(isDncDisposition('DNC')).toBe(true);
    expect(isDncDisposition('Do Not Call')).toBe(true);
    expect(isDncDisposition('Not Interested')).toBe(false);
    expect(isDncDisposition('Sold Already')).toBe(false);
  });
});

describe('detectCallOutcomeFromMessage', () => {
  it('detects Not Interested from NOT FOR SALE and related phrases', () => {
    expect(detectCallOutcomeFromMessage('NOT FOR SALE')).toBe('Not Interested');
    expect(detectCallOutcomeFromMessage('We are not selling')).toBe('Not Interested');
    expect(detectCallOutcomeFromMessage('I am not interested in selling')).toBe('Not Interested');
  });

  it('detects Listed With Realtor from realtor keywords', () => {
    expect(detectCallOutcomeFromMessage('We are working with a realtor')).toBe('Listed With Realtor');
    expect(detectCallOutcomeFromMessage('It is already listed')).toBe('Listed With Realtor');
  });

  it('detects Sold Already', () => {
    expect(detectCallOutcomeFromMessage('This property was sold already')).toBe('Sold Already');
  });

  it('detects Wrong Number / non-owner / authority mismatch phrases', () => {
    expect(detectCallOutcomeFromMessage('Wrong number')).toBe('Wrong Number / Disconnected / Invalid Number');
    expect(detectCallOutcomeFromMessage('You have the wrong person')).toBe('Wrong Number / Disconnected / Invalid Number');
    expect(detectCallOutcomeFromMessage('It is not my property to sell. Sorry.')).toBe('Wrong Number / Disconnected / Invalid Number');
    expect(detectCallOutcomeFromMessage('not my property')).toBe('Wrong Number / Disconnected / Invalid Number');
    expect(detectCallOutcomeFromMessage('I do not own this house')).toBe('Wrong Number / Disconnected / Invalid Number');
    expect(detectCallOutcomeFromMessage("don't own that")).toBe('Wrong Number / Disconnected / Invalid Number');
    expect(detectCallOutcomeFromMessage('I am not the owner')).toBe('Wrong Number / Disconnected / Invalid Number');
    expect(detectCallOutcomeFromMessage('wrong contact info')).toBe('Wrong Number / Disconnected / Invalid Number');
    expect(detectCallOutcomeFromMessage('does not belong to me')).toBe('Wrong Number / Disconnected / Invalid Number');
  });

  it('detects DNC from stop/unsubscribe', () => {
    expect(detectCallOutcomeFromMessage('Do not call me ever again')).toBe('DNC');
    expect(detectCallOutcomeFromMessage('STOP')).toBe('DNC');
    expect(detectCallOutcomeFromMessage('unsubscribe')).toBe('DNC');
  });

  it('returns null for neutral or non-objection messages', () => {
    expect(detectCallOutcomeFromMessage('How much are you offering?')).toBe(null);
    expect(detectCallOutcomeFromMessage('Tell me more')).toBe(null);
  });
});

describe('callOutcomeForEndReason (AI end-reason → Call Outcome)', () => {
  it('maps a hard no / default to "Not Interested"', () => {
    expect(callOutcomeForEndReason('not_interested')).toBe('Not Interested');
    expect(callOutcomeForEndReason('')).toBe('Not Interested');
    expect(callOutcomeForEndReason(null)).toBe('Not Interested');
  });

  it('maps realtor/listed/agent reasons to "Listed With Realtor"', () => {
    expect(callOutcomeForEndReason('has_realtor')).toBe('Listed With Realtor');
    expect(callOutcomeForEndReason('already_listed')).toBe('Listed With Realtor');
  });

  it('maps sold / wrong-number reasons', () => {
    expect(callOutcomeForEndReason('already_sold')).toBe('Sold Already');
    expect(callOutcomeForEndReason('wrong_number')).toBe('Wrong Number / Disconnected / Invalid Number');
  });
});

