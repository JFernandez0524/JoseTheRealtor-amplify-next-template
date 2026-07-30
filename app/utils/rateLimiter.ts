/**
 * SLIDING-WINDOW RATE LIMITER UTILITY
 *
 * Provides a lightweight in-memory rate limiter using a sliding-window algorithm.
 * Automatically purges stale request timestamps to prevent memory leaks.
 */

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
}

// Global request store: key (e.g. IP + route) -> array of request timestamps
const requestStore = new Map<string, number[]>();

/**
 * Clean up keys that haven't been accessed recently to keep memory footprint low.
 */
function cleanupStaleEntries(now: number, maxAgeMs: number = 120_000) {
  if (requestStore.size > 1000) {
    for (const [key, timestamps] of requestStore.entries()) {
      const last = timestamps[timestamps.length - 1];
      if (!last || now - last > maxAgeMs) {
        requestStore.delete(key);
      }
    }
  }
}

/**
 * Checks if a request from an identifier exceeds the configured rate limit.
 *
 * @param identifier unique client key (e.g. IP + route)
 * @param config limit and windowMs configuration
 * @returns RateLimitResult with success status and headers info
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  cleanupStaleEntries(now, config.windowMs * 2);

  const existingTimestamps = requestStore.get(identifier) || [];
  // Filter out timestamps outside the current window
  const validTimestamps = existingTimestamps.filter((t) => t > windowStart);

  if (validTimestamps.length >= config.limit) {
    const oldest = validTimestamps[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + config.windowMs - now) / 1000));
    requestStore.set(identifier, validTimestamps);
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      retryAfter,
    };
  }

  validTimestamps.push(now);
  requestStore.set(identifier, validTimestamps);

  return {
    success: true,
    limit: config.limit,
    remaining: Math.max(0, config.limit - validTimestamps.length),
    retryAfter: 0,
  };
}

/**
 * Clears all rate limit records (useful for testing).
 */
export function resetRateLimiter() {
  requestStore.clear();
}
