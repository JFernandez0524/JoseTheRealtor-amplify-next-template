import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDocClientSend } = vi.hoisted(() => ({
  mockDocClientSend: vi.fn(),
}));

vi.mock('@/app/utils/aws/auth/amplifyServerUtils.server', () => ({
  AuthGetCurrentUserServer: vi.fn(),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => {
  return {
    DynamoDBDocumentClient: {
      from: () => ({
        send: mockDocClientSend,
      }),
    },
    QueryCommand: class {
      constructor(public input: any) {}
    },
    ScanCommand: class {
      constructor(public input: any) {}
    },
    UpdateCommand: class {
      constructor(public input: any) {}
    },
  };
});

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(),
}));

import { POST } from '@/app/api/v1/ghl/disconnect/route';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

describe('POST /api/v1/ghl/disconnect', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue(null);

    const res = await POST();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('deactivates active GHL integration and pauses pending queue items', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue({
      userId: 'user-123',
      username: 'testuser',
    } as any);

    // First send call: Scan GhlIntegration
    mockDocClientSend.mockResolvedValueOnce({
      Items: [{ id: 'integration-abc', userId: 'user-123', isActive: true }],
    });
    // Second send call: Update GhlIntegration
    mockDocClientSend.mockResolvedValueOnce({});
    // Third send call: Scan OutreachQueue
    mockDocClientSend.mockResolvedValueOnce({
      Items: [{ id: 'queue-1', userId: 'user-123', queueStatus: 'OUTREACH' }],
    });
    // Fourth send call: Update OutreachQueue
    mockDocClientSend.mockResolvedValueOnce({});

    const res = await POST();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.integrationsDeactivated).toBe(1);
    expect(json.queueItemsPaused).toBe(1);
  });
});
