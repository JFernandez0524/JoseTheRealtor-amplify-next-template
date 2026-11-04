import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetValidGhlToken, mockGetGhlIntegration, mockRefreshGhlToken } = vi.hoisted(() => ({
  mockGetValidGhlToken: vi.fn(),
  mockGetGhlIntegration: vi.fn(),
  mockRefreshGhlToken: vi.fn(),
}));

vi.mock('@/app/utils/aws/auth/amplifyServerUtils.server', () => ({
  AuthGetCurrentUserServer: vi.fn(),
}));

vi.mock('@/app/utils/aws/data/ghlIntegration.server', () => ({
  getValidGhlToken: mockGetValidGhlToken,
  getGhlIntegration: mockGetGhlIntegration,
  refreshGhlToken: mockRefreshGhlToken,
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
    mockGetGhlIntegration.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('DISCONNECTED');
  });

  it('returns HEALTHY when GHL API ping succeeds', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue({ userId: 'user-123' } as any);
    mockGetGhlIntegration.mockResolvedValue({
      id: 'int-123',
      locationId: 'loc-123',
      refreshToken: 'refresh-123',
      customFieldIds: JSON.stringify({ prop1: 'field1' }),
    });
    mockGetValidGhlToken.mockResolvedValue('valid-token');
    vi.mocked(axios.get).mockResolvedValue({ status: 200 } as any);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('HEALTHY');
    expect(json.recovered).toBe(false);
  });

  it('auto-recovers token on 401 and returns HEALTHY with recovered: true', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue({ userId: 'user-123' } as any);
    mockGetGhlIntegration.mockResolvedValue({
      id: 'int-123',
      locationId: 'loc-123',
      refreshToken: 'refresh-123',
      customFieldIds: JSON.stringify({ prop1: 'field1' }),
    });
    mockGetValidGhlToken.mockResolvedValue('stale-token');
    mockRefreshGhlToken.mockResolvedValue('fresh-token');

    vi.mocked(axios.get).mockRejectedValueOnce({
      response: { status: 401 },
      message: 'Unauthorized',
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('HEALTHY');
    expect(json.recovered).toBe(true);
    expect(mockRefreshGhlToken).toHaveBeenCalledWith('int-123', 'refresh-123');
  });
});
