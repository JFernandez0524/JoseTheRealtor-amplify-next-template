import { describe, it, expect, vi } from 'vitest';
import { resolveGhlConnection, GhlIntegrationRecord } from '@/app/context/ghlConnection';

const noSleep = async () => {};
const fixedNow = () => new Date('2026-11-18T12:00:00.000Z');

const validIntegration: GhlIntegrationRecord = {
  id: 'int-1',
  locationId: 'loc-123',
  expiresAt: '2026-11-19T12:00:00.000Z',
  refreshToken: 'ref-abc',
};

const expiredIntegration: GhlIntegrationRecord = {
  id: 'int-1',
  locationId: 'loc-123',
  expiresAt: '2026-11-17T12:00:00.000Z',
  refreshToken: 'ref-abc',
};

describe('resolveGhlConnection', () => {
  it('returns disconnected when no user is signed in', async () => {
    const result = await resolveGhlConnection({
      getUser: async () => null,
      ensureSession: async () => false,
      listIntegrations: async () => ({ data: [] }),
      refreshToken: async () => ({ ok: true, status: 200 }),
      sleep: noSleep,
      now: fixedNow,
    });

    expect(result).toEqual({
      isConnected: false,
      locationId: null,
      integrationId: null,
    });
  });

  it('returns connected when active integration is not expired', async () => {
    const result = await resolveGhlConnection({
      getUser: async () => ({ userId: 'user-1' }),
      ensureSession: async () => true,
      listIntegrations: async () => ({ data: [validIntegration] }),
      refreshToken: async () => ({ ok: true, status: 200 }),
      sleep: noSleep,
      now: fixedNow,
    });

    expect(result).toEqual({
      isConnected: true,
      locationId: 'loc-123',
      integrationId: 'int-1',
    });
  });

  it('retries when listIntegrations returns GraphQL errors right after sign-in', async () => {
    const listIntegrations = vi
      .fn()
      .mockResolvedValueOnce({ data: null, errors: [{ message: 'Unauthorized' }] })
      .mockResolvedValueOnce({ data: [validIntegration] });

    const ensureSession = vi.fn().mockResolvedValue(true);

    const result = await resolveGhlConnection({
      getUser: async () => ({ userId: 'user-1' }),
      ensureSession,
      listIntegrations,
      refreshToken: async () => ({ ok: true, status: 200 }),
      sleep: noSleep,
      now: fixedNow,
    });

    expect(listIntegrations).toHaveBeenCalledTimes(2);
    expect(ensureSession).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      isConnected: true,
      locationId: 'loc-123',
      integrationId: 'int-1',
    });
  });

  it('retries token refresh on 401 when SSR cookies are still settling on login', async () => {
    const listIntegrations = vi
      .fn()
      .mockResolvedValueOnce({ data: [expiredIntegration] })
      .mockResolvedValueOnce({ data: [validIntegration] });

    const refreshToken = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await resolveGhlConnection({
      getUser: async () => ({ userId: 'user-1' }),
      ensureSession: async () => true,
      listIntegrations,
      refreshToken,
      sleep: noSleep,
      now: fixedNow,
    });

    expect(refreshToken).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      isConnected: true,
      locationId: 'loc-123',
      integrationId: 'int-1',
    });
  });

  it('returns disconnected if token refresh fails with non-retryable 404', async () => {
    const refreshToken = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    const result = await resolveGhlConnection({
      getUser: async () => ({ userId: 'user-1' }),
      ensureSession: async () => true,
      listIntegrations: async () => ({ data: [expiredIntegration] }),
      refreshToken,
      sleep: noSleep,
      now: fixedNow,
    });

    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      isConnected: false,
      locationId: 'loc-123',
      integrationId: 'int-1',
    });
  });

  it('stays connected if refresh succeeds even when follow-up listIntegrations transiently fails', async () => {
    const listIntegrations = vi
      .fn()
      .mockResolvedValueOnce({ data: [expiredIntegration] })
      .mockResolvedValue({ data: null, errors: [{ message: 'Transient error' }] });

    const result = await resolveGhlConnection({
      getUser: async () => ({ userId: 'user-1' }),
      ensureSession: async () => true,
      listIntegrations,
      refreshToken: async () => ({ ok: true, status: 200 }),
      sleep: noSleep,
      now: fixedNow,
    });

    expect(result).toEqual({
      isConnected: true,
      locationId: 'loc-123',
      integrationId: 'int-1',
    });
  });
});
