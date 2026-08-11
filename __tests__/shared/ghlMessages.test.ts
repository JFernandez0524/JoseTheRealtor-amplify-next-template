import { describe, it, expect } from 'vitest';
import {
  extractGhlMessages,
  isHumanOutbound,
  isSystemMessage,
} from '../../amplify/functions/shared/ghlMessages';

// Parsing for GET /conversations/{id}/messages. Four call sites previously read `data.messages`
// (the wrapper object) instead of `data.messages.messages`, and every one degraded silently:
// empty AI conversation history, a manual-takeover detector stuck on false, broken Instagram
// body recovery, and a media guard that never fired.

/** Trimmed from the live response for conversation 4jHJlvVaEufiaGBP4HCV. */
const LIVE_RESPONSE = {
  messages: {
    lastMessageId: 'Kd6yYmta1mqSw2cmaZJj',
    nextPage: false,
    messages: [
      {
        id: 'mbklkVu6wTyFD3cWIH8p',
        direction: 'outbound',
        type: 2,
        messageType: 'TYPE_SMS',
        body: "Please let me know when you're there.",
        contentType: 'text/plain',
        dateAdded: '2026-07-28T15:14:05.486Z',
        source: 'app', // human, sent from the GHL UI — no marketplace meta
      },
      {
        id: 'XXXjDYSx9kXQyjHXgxCO',
        direction: 'outbound',
        type: 2,
        messageType: 'TYPE_SMS',
        body: 'Great! I wanted to see if I could make you a firm cash offer...',
        contentType: 'text/plain',
        dateAdded: '2026-07-28T14:53:33.383Z',
        source: 'app',
        meta: { marketplace: { appId: '6a36bd98f0df01764c99b25d', appName: 'DealFinder' } },
      },
      {
        id: '8tRvOn6ZNR4SYZgm7IUs',
        direction: 'inbound',
        type: 2,
        messageType: 'TYPE_SMS',
        body: 'Yes',
        contentType: 'text/plain',
        dateAdded: '2026-07-28T14:53:27.494Z',
      },
      {
        id: 'Kd6yYmta1mqSw2cmaZJj',
        direction: 'outbound',
        type: 2,
        messageType: 'TYPE_SMS',
        body: 'Hey, this is Jose with REMAX...',
        contentType: 'text/plain',
        dateAdded: '2026-07-28T11:05:31.245Z',
        source: 'workflow', // GHL automation, not a human
      },
    ],
  },
};

describe('extractGhlMessages', () => {
  it('reads the nested array from a real GHL response', () => {
    const messages = extractGhlMessages(LIVE_RESPONSE);
    expect(messages).toHaveLength(4);
    expect(messages[0].id).toBe('mbklkVu6wTyFD3cWIH8p');
  });

  it('does NOT return the wrapper object — the original bug', () => {
    const messages = extractGhlMessages(LIVE_RESPONSE);
    expect(Array.isArray(messages)).toBe(true);
    // The wrapper carries lastMessageId; the array must not.
    expect((messages as any).lastMessageId).toBeUndefined();
  });

  it('tolerates a flat messages array', () => {
    expect(extractGhlMessages({ messages: [{ id: 'a' }, { id: 'b' }] })).toHaveLength(2);
  });

  it('returns [] for a wrapper with no inner array', () => {
    expect(extractGhlMessages({ messages: { lastMessageId: 'x', nextPage: false } })).toEqual([]);
  });

  it('returns [] for unrecognised or missing input without throwing', () => {
    for (const input of [{}, null, undefined, 'nope', 42, [], { messages: null }]) {
      expect(() => extractGhlMessages(input)).not.toThrow();
      expect(extractGhlMessages(input)).toEqual([]);
    }
  });

  it('produces an iterable — the shape the old code crashed on', () => {
    // `for...of` over the wrapper object threw TypeError, was swallowed by a catch, and left
    // hasRecentOutbound permanently false.
    expect(() => {
      for (const _ of extractGhlMessages(LIVE_RESPONSE)) { /* no-op */ }
    }).not.toThrow();
  });
});

describe('isHumanOutbound', () => {
  // Note the double `.messages` — the outer key is a wrapper object, not the array. Reading one
  // level too shallow is precisely the bug this module exists to prevent.
  const [humanMsg, aiMsg, inboundMsg, workflowMsg] = LIVE_RESPONSE.messages.messages;

  it('is true for a human reply sent from the GHL UI', () => {
    expect(isHumanOutbound(humanMsg)).toBe(true);
  });

  it('is false for this app’s own AI message', () => {
    // Critical: counting our own reply as manual activity would make the agent pause itself on
    // every conversation seconds after answering.
    expect(isHumanOutbound(aiMsg)).toBe(false);
  });

  it('is false for a GHL workflow send', () => {
    expect(isHumanOutbound(workflowMsg)).toBe(false);
  });

  it('is false for any inbound message', () => {
    expect(isHumanOutbound(inboundMsg)).toBe(false);
    expect(isHumanOutbound({ direction: 'inbound', source: 'app' })).toBe(false);
  });

  it('is false for null/undefined', () => {
    expect(isHumanOutbound(null)).toBe(false);
    expect(isHumanOutbound(undefined)).toBe(false);
  });

  it('treats any marketplace meta as app-sent, even without an appName', () => {
    expect(isHumanOutbound({ direction: 'outbound', meta: { marketplace: {} } })).toBe(false);
  });

  it('finds exactly one human message in the live thread', () => {
    const humans = extractGhlMessages(LIVE_RESPONSE).filter(isHumanOutbound);
    expect(humans).toHaveLength(1);
    expect(humans[0].id).toBe('mbklkVu6wTyFD3cWIH8p');
  });
});

describe('isSystemMessage', () => {
  it('is false for a normal SMS', () => {
    expect(isSystemMessage({ messageType: 'TYPE_SMS' })).toBe(false);
  });

  it('is true for system and activity entries', () => {
    expect(isSystemMessage({ messageType: 'TYPE_SYSTEM' })).toBe(true);
    expect(isSystemMessage({ messageType: 'TYPE_ACTIVITY_OPPORTUNITY' })).toBe(true);
    expect(isSystemMessage({ messageType: 'TYPE_ACTIVITY_APPOINTMENT' })).toBe(true);
  });

  it('reads messageType, not the numeric type field', () => {
    // The old filter compared `msg.type !== 'TYPE_SYSTEM'` — but type is a number (2 = SMS), so
    // the comparison was always true and nothing was ever filtered.
    expect(isSystemMessage({ type: 2, messageType: 'TYPE_SYSTEM' })).toBe(true);
    expect(isSystemMessage({ type: 2 } as any)).toBe(false);
  });

  it('is false for null/undefined', () => {
    expect(isSystemMessage(null)).toBe(false);
    expect(isSystemMessage(undefined)).toBe(false);
  });
});
