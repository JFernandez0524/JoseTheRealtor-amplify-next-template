import { describe, it, expect } from 'vitest';
import { dispositionAction, isTerminalDisposition } from '../../amplify/functions/shared/dispositions';

// dispositionAction / isTerminalDisposition are pure — no AWS setup required.

describe('dispositionAction', () => {
  it('returns STOP for negative terminal outcomes', () => {
    expect(dispositionAction('Sold Already')).toBe('STOP');
    expect(dispositionAction('Not Interested')).toBe('STOP');
    expect(dispositionAction('DNC')).toBe('STOP');
    expect(dispositionAction('Listed With Realtor')).toBe('STOP');
  });

  it('returns STOP for the exact combined wrong-number option string', () => {
    // This is the actual GHL Call Outcome field option — the regression that the
    // earlier split-alias matcher missed.
    expect(dispositionAction('Wrong Number / Disconnected / Invalid Number')).toBe('STOP');
    expect(dispositionAction('wrong number / disconnected / invalid number')).toBe('STOP');
  });

  it('accepts alternate wrong-number aliases', () => {
    expect(dispositionAction('Incorrect Number')).toBe('STOP');
    expect(dispositionAction('Wrong Number')).toBe('STOP');
    expect(dispositionAction('Disconnected')).toBe('STOP');
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
    // Call-exhaustion is NOT an email stop — the dialer workflow falls back to email/mail.
    expect(dispositionAction('DEAD / Max Attempts')).toBe('NONE');
  });

  it('returns NONE for empty / null / non-string', () => {
    expect(dispositionAction('')).toBe('NONE');
    expect(dispositionAction(null)).toBe('NONE');
    expect(dispositionAction(undefined)).toBe('NONE');
    expect(dispositionAction(123 as any)).toBe('NONE');
  });
});

describe('isTerminalDisposition (wrapper: STOP only)', () => {
  it('is true for negative terminal outcomes', () => {
    expect(isTerminalDisposition('Sold Already')).toBe(true);
    expect(isTerminalDisposition('Wrong Number / Disconnected / Invalid Number')).toBe(true);
  });

  it('is false for ENGAGED and non-terminal outcomes', () => {
    expect(isTerminalDisposition('Appointment Set')).toBe(false);
    expect(isTerminalDisposition('No Answer')).toBe(false);
    expect(isTerminalDisposition(null)).toBe(false);
  });
});
