import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { classifyBridgeError } from '../../app/utils/bridgeErrors';

// Pure classifier behind the Bridge circuit breaker. `isAuthFailure` gates whether a whole CSV
// import abandons Zestimate lookups, so a false positive silently drops valuations for an entire
// run — every non-401/403 case below must stay false.

/** Build an AxiosError carrying a Bridge-shaped error body. */
function bridgeError(status: number, body?: unknown): AxiosError {
  const err = new AxiosError('Request failed with status code ' + status);
  err.response = {
    status,
    statusText: '',
    data: body,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() } as any,
  };
  return err;
}

const UNAUTHORIZED = {
  success: false,
  status: 401,
  bundle: { name: 'AuthorizationError', message: 'Unauthorized request' },
};

describe('classifyBridgeError', () => {
  it('flags a Bridge 401 and extracts the message from bundle', () => {
    // The exact payload production returned when the key expired.
    expect(classifyBridgeError(bridgeError(401, UNAUTHORIZED))).toEqual({
      status: 401,
      isAuthFailure: true,
      message: 'Unauthorized request',
    });
  });

  it('flags a 403 (token rejected / account disabled)', () => {
    const result = classifyBridgeError(
      bridgeError(403, {
        success: false,
        status: 403,
        bundle: { name: 'AuthenticationError', message: 'Invalid access_token format' },
      })
    );
    expect(result.isAuthFailure).toBe(true);
    expect(result.status).toBe(403);
    expect(result.message).toBe('Invalid access_token format');
  });

  it('does NOT flag a 404 — that is a genuine per-address miss', () => {
    const result = classifyBridgeError(bridgeError(404, { message: 'Not found' }));
    expect(result.isAuthFailure).toBe(false);
    expect(result.status).toBe(404);
  });

  it('does NOT flag a 500 — transient, the next address may still succeed', () => {
    expect(classifyBridgeError(bridgeError(500)).isAuthFailure).toBe(false);
  });

  it('does NOT flag a 429 rate limit as an auth failure', () => {
    expect(classifyBridgeError(bridgeError(429)).isAuthFailure).toBe(false);
  });

  it('does NOT flag a transport error with no response (timeout / DNS)', () => {
    const err = new AxiosError('connect ETIMEDOUT');
    expect(classifyBridgeError(err)).toEqual({
      status: null,
      isAuthFailure: false,
      message: 'connect ETIMEDOUT',
    });
  });

  it('handles a plain Error without throwing', () => {
    expect(classifyBridgeError(new Error('boom'))).toEqual({
      status: null,
      isAuthFailure: false,
      message: 'boom',
    });
  });

  it('handles non-Error throws (string, null, undefined)', () => {
    expect(classifyBridgeError('kaboom').message).toBe('kaboom');
    expect(classifyBridgeError(null).message).toBe('Unknown Bridge error');
    expect(classifyBridgeError(undefined).message).toBe('Unknown Bridge error');
    expect(classifyBridgeError(null).isAuthFailure).toBe(false);
  });

  it('does not read .message off a success-shaped bundle array', () => {
    // `bundle` is an array on success and an object on error — indexing blindly would yield
    // undefined and lose the real message.
    const result = classifyBridgeError(
      bridgeError(401, { success: true, status: 401, bundle: [{ zpid: '1', zestimate: 100 }] })
    );
    expect(result.isAuthFailure).toBe(true);
    expect(result.message).toBe('Request failed with status code 401');
  });

  it('falls back to a top-level message when bundle is absent', () => {
    expect(classifyBridgeError(bridgeError(401, { message: 'Token expired' })).message).toBe(
      'Token expired'
    );
  });

  it('falls back to the axios message when the body carries none', () => {
    expect(classifyBridgeError(bridgeError(401, {})).message).toBe(
      'Request failed with status code 401'
    );
  });
});
