import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimiter } from '@/app/utils/rateLimiter';

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it('allows requests within the limit', () => {
    const config = { limit: 3, windowMs: 60_000 };

    const req1 = checkRateLimit('client-1', config);
    expect(req1.success).toBe(true);
    expect(req1.remaining).toBe(2);

    const req2 = checkRateLimit('client-1', config);
    expect(req2.success).toBe(true);
    expect(req2.remaining).toBe(1);

    const req3 = checkRateLimit('client-1', config);
    expect(req3.success).toBe(true);
    expect(req3.remaining).toBe(0);
  });

  it('rejects requests exceeding the limit', () => {
    const config = { limit: 2, windowMs: 60_000 };

    checkRateLimit('client-1', config);
    checkRateLimit('client-1', config);

    const req3 = checkRateLimit('client-1', config);
    expect(req3.success).toBe(false);
    expect(req3.remaining).toBe(0);
    expect(req3.retryAfter).toBeGreaterThan(0);
  });

  it('maintains independent limits per identifier', () => {
    const config = { limit: 1, windowMs: 60_000 };

    const reqUser1 = checkRateLimit('user-1', config);
    expect(reqUser1.success).toBe(true);

    const reqUser2 = checkRateLimit('user-2', config);
    expect(reqUser2.success).toBe(true);

    const reqUser1Blocked = checkRateLimit('user-1', config);
    expect(reqUser1Blocked.success).toBe(false);
  });
});
