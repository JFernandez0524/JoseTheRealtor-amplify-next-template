import { describe, it, expect } from 'vitest';
import { extractWebhookId } from '../../amplify/functions/shared/idempotency';

// extractWebhookId is pure (no DynamoDB) — tests can run without any AWS setup.

describe('extractWebhookId', () => {
  it('returns x-ghl-webhook-id header when present', () => {
    const event = {
      headers: { 'x-ghl-webhook-id': 'wh-abc123' },
      body: JSON.stringify({ contactId: 'c1' }),
    };
    expect(extractWebhookId(event)).toBe('wh-abc123');
  });

  it('returns webhookId from body when no header', () => {
    const event = {
      headers: {},
      body: JSON.stringify({ webhookId: 'body-id-999', contactId: 'c2' }),
    };
    expect(extractWebhookId(event)).toBe('body-id-999');
  });

  it('builds ID from requestContext when available', () => {
    const event = {
      headers: {},
      body: JSON.stringify({ contactId: 'c3', timestamp: 1700000000000 }),
      requestContext: { requestId: 'req-xyz' },
    };
    const id = extractWebhookId(event);
    expect(id).toContain('req-xyz');
    expect(id).toContain('c3');
    expect(id).toContain('1700000000000');
  });

  it('falls back to body hash when no header, no webhookId, no requestContext', () => {
    const event = {
      headers: {},
      body: JSON.stringify({ some: 'data' }),
    };
    const id = extractWebhookId(event);
    expect(id).toMatch(/^hash_/);
  });

  it('produces a consistent hash for the same body', () => {
    const event = {
      headers: {},
      body: JSON.stringify({ some: 'data' }),
    };
    expect(extractWebhookId(event)).toBe(extractWebhookId(event));
  });

  it('produces different hashes for different bodies', () => {
    const e1 = { headers: {}, body: JSON.stringify({ a: 1 }) };
    const e2 = { headers: {}, body: JSON.stringify({ a: 2 }) };
    expect(extractWebhookId(e1)).not.toBe(extractWebhookId(e2));
  });

  it('prefers header over body webhookId', () => {
    const event = {
      headers: { 'x-ghl-webhook-id': 'header-wins' },
      body: JSON.stringify({ webhookId: 'body-id', contactId: 'c1' }),
    };
    expect(extractWebhookId(event)).toBe('header-wins');
  });

  it('handles pre-parsed body object (not a string)', () => {
    const event = {
      headers: {},
      body: { webhookId: 'parsed-body-id' },
    };
    expect(extractWebhookId(event)).toBe('parsed-body-id');
  });

  it('uses "unknown" contactId when contactId is missing from body', () => {
    const event = {
      headers: {},
      body: JSON.stringify({ timestamp: 123 }),
      requestContext: { requestId: 'req-abc' },
    };
    const id = extractWebhookId(event);
    expect(id).toContain('unknown');
  });
});
