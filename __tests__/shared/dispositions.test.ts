import { describe, it, expect } from 'vitest';
import { isTerminalDisposition } from '../../amplify/functions/shared/dispositions';

// isTerminalDisposition is pure — no AWS setup required.

describe('isTerminalDisposition', () => {
  it('returns true for the terminal dispositions', () => {
    expect(isTerminalDisposition('Sold Already')).toBe(true);
    expect(isTerminalDisposition('Not Interested')).toBe(true);
    expect(isTerminalDisposition('DNC')).toBe(true);
    expect(isTerminalDisposition('Listed With Realtor')).toBe(true);
    expect(isTerminalDisposition('Incorrect Number')).toBe(true);
  });

  it('accepts aliases of Incorrect Number', () => {
    expect(isTerminalDisposition('Wrong Number')).toBe(true);
    expect(isTerminalDisposition('Disconnected')).toBe(true);
    expect(isTerminalDisposition('Invalid Number')).toBe(true);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(isTerminalDisposition('sold already')).toBe(true);
    expect(isTerminalDisposition('  DNC  ')).toBe(true);
    expect(isTerminalDisposition('NOT INTERESTED')).toBe(true);
  });

  it('returns false for non-terminal dispositions (cadence continues)', () => {
    expect(isTerminalDisposition('No Answer')).toBe(false);
    expect(isTerminalDisposition('Left Voicemail')).toBe(false);
    expect(isTerminalDisposition('Voicemail')).toBe(false);
    expect(isTerminalDisposition('Follow Up')).toBe(false);
    expect(isTerminalDisposition('Spoke - Follow Up')).toBe(false);
    expect(isTerminalDisposition('Requested Appointment')).toBe(false);
  });

  it('returns false for empty / null / non-string input', () => {
    expect(isTerminalDisposition('')).toBe(false);
    expect(isTerminalDisposition(null)).toBe(false);
    expect(isTerminalDisposition(undefined)).toBe(false);
    expect(isTerminalDisposition(123 as any)).toBe(false);
  });
});
