import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/app/utils/aws/auth/amplifyServerUtils.server', () => ({
  AuthGetCurrentUserServer: vi.fn(),
  AuthGetUserGroupsServer: vi.fn(),
}));

vi.mock('@/app/utils/aws/data/ghlIntegration.server', () => ({
  createGhlIntegration: vi.fn(),
}));

vi.mock('../../../../../amplify/functions/shared/ghlFieldProvisioner', () => ({
  provisionCustomFields: vi.fn().mockResolvedValue({ property_address: 'custom_1' }),
  provisionOpportunityFields: vi.fn().mockResolvedValue({ pipeline_stage: 'stage_1' }),
  provisionTags: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('axios');

import axios from 'axios';
import { POST } from '@/app/api/v1/ghl/connect-pit/route';
import { AuthGetCurrentUserServer, AuthGetUserGroupsServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { createGhlIntegration } from '@/app/utils/aws/data/ghlIntegration.server';

describe('POST /api/v1/ghl/connect-pit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue(null);

    const req = new Request('http://localhost:3000/api/v1/ghl/connect-pit', {
      method: 'POST',
      body: JSON.stringify({ locationId: 'loc-123', pitToken: 'pit-abc' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain('not authenticated');
  });

  it('returns 403 when user does not have a paid plan', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue({ userId: 'user-123' } as any);
    vi.mocked(AuthGetUserGroupsServer).mockResolvedValue(['FREE_USER']);

    const req = new Request('http://localhost:3000/api/v1/ghl/connect-pit', {
      method: 'POST',
      body: JSON.stringify({ locationId: 'loc-123', pitToken: 'pit-abc' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Paid subscription');
  });

  it('returns 400 when locationId or pitToken is missing', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue({ userId: 'user-123' } as any);
    vi.mocked(AuthGetUserGroupsServer).mockResolvedValue(['PRO']);

    const req = new Request('http://localhost:3000/api/v1/ghl/connect-pit', {
      method: 'POST',
      body: JSON.stringify({ locationId: '', pitToken: '' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Both Location ID and Private Integration Token');
  });

  it('returns 400 when HighLevel API rejects the PIT token', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue({ userId: 'user-123' } as any);
    vi.mocked(AuthGetUserGroupsServer).mockResolvedValue(['PRO']);
    vi.mocked(axios.get).mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Invalid token' } },
    });

    const req = new Request('http://localhost:3000/api/v1/ghl/connect-pit', {
      method: 'POST',
      body: JSON.stringify({ locationId: 'invalid-loc', pitToken: 'bad-token' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('HighLevel authentication failed');
  });

  it('successfully validates token, provisions fields, and saves PIT integration', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue({ userId: 'user-123' } as any);
    vi.mocked(AuthGetUserGroupsServer).mockResolvedValue(['PRO']);
    vi.mocked(axios.get).mockResolvedValueOnce({ status: 200, data: { location: { id: 'loc-123' } } });
    vi.mocked(createGhlIntegration).mockResolvedValueOnce({} as any);

    const req = new Request('http://localhost:3000/api/v1/ghl/connect-pit', {
      method: 'POST',
      body: JSON.stringify({ locationId: 'loc-123', pitToken: 'pit-abc-123' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.locationId).toBe('loc-123');

    expect(createGhlIntegration).toHaveBeenCalledWith('user-123', expect.objectContaining({
      access_token: 'pit-abc-123',
      refresh_token: 'PIT_STATIC',
      locationId: 'loc-123',
    }));
  });
});
