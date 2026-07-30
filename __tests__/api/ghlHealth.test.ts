import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetValidGhlToken } = vi.hoisted(() => ({
  mockGetValidGhlToken: vi.fn(),
}));

vi.mock('@/app/utils/aws/auth/amplifyServerUtils.server', () => ({
  AuthGetCurrentUserServer: vi.fn(),
}));

vi.mock('@/amplify/functions/shared/ghlTokenManager', () => ({
  getValidGhlToken: mockGetValidGhlToken,
}));

vi.mock('axios');
import axios from 'axios';
import { GET } from '@/app/api/v1/ghl/health/route';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

describe('GET /api/v1/ghl/health', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when user is unauthenticated', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns DISCONNECTED when user has no active integration', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue({ userId: 'user-123' } as any);
    mockGetValidGhlToken.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('DISCONNECTED');
  });

  it('returns HEALTHY when GHL API ping succeeds', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue({ userId: 'user-123' } as any);
    mockGetValidGhlToken.mockResolvedValue({
      token: 'valid-token',
      locationId: 'loc-123',
      integrationId: 'int-123',
      customFieldIds: { prop1: 'field1' },
    });
    vi.mocked(axios.get).mockResolvedValue({ status: 200 } as any);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('HEALTHY');
    expect(json.recovered).toBe(false);
  });

  it('auto-recovers token on 401 and returns HEALTHY with recovered: true', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue({ userId: 'user-123' } as any);
    mockGetValidGhlToken
      .mockResolvedValueOnce({
        token: 'stale-token',
        locationId: 'loc-123',
        integrationId: 'int-123',
      })
      .mockResolvedValueOnce({
        token: 'fresh-token',
        locationId: 'loc-123',
        integrationId: 'int-123',
        customFieldIds: { prop1: 'field1' },
      });

    vi.mocked(axios.get).mockRejectedValueOnce({
      response: { status: 401 },
      message: 'Unauthorized',
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('HEALTHY');
    expect(json.recovered).toBe(true);
    expect(mockGetValidGhlToken).toHaveBeenCalledWith('user-123', true);
  });
});
