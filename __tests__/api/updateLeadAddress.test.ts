import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetLead, mockUpdateLead } = vi.hoisted(() => ({
  mockGetLead: vi.fn(),
  mockUpdateLead: vi.fn(),
}));

vi.mock('@/app/utils/aws/auth/amplifyServerUtils.server', () => ({
  AuthGetCurrentUserServer: vi.fn(),
  cookiesClient: {
    models: {
      PropertyLead: {
        get: mockGetLead,
        update: mockUpdateLead,
      },
    },
  },
}));

vi.mock('@/app/utils/bridge.server', () => ({
  analyzeBridgeProperty: vi.fn().mockResolvedValue({
    success: true,
    valuation: {
      zestimate: 650000,
      zpid: '12345678',
      zillowUrl: 'https://zillow.com/homes/12345678_zpid/',
      address: '15 Basie Ct, Monroe, NJ 08831',
      rentalZestimate: 3200,
    },
  }),
}));

vi.mock('@/app/utils/serpPropertyResolver.server', () => ({
  resolvePropertyWithSerp: vi.fn().mockResolvedValue({
    success: true,
    data: {
      zpid: '12345678',
      zestimate: 650000,
      listingStatus: 'sold',
      lastSaleAmount: 640000,
      lastSaleDate: '2026-08-01',
    },
  }),
}));

import { POST } from '@/app/api/v1/update-lead-address/route';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

function createRequest(body: Record<string, any>) {
  return new NextRequest('http://localhost:3000/api/v1/update-lead-address', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/update-lead-address', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue(null);

    const req = createRequest({
      leadId: 'lead-123',
      street: '15 Basie Ct',
      city: 'Monroe',
      state: 'NJ',
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain('Unauthorized');
  });

  it('returns 400 when missing required fields', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue({
      userId: 'user-123',
    } as any);

    const req = createRequest({
      leadId: 'lead-123',
      // missing street, city, state
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Street, city, and state are required');
  });

  it('returns 404 when lead is not found', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue({
      userId: 'user-123',
    } as any);

    mockGetLead.mockResolvedValueOnce({ data: null });

    const req = createRequest({
      leadId: 'lead-nonexistent',
      street: '15 Basie Ct',
      city: 'Monroe',
      state: 'NJ',
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('successfully updates address, sets validationStatus VALID, and attaches market intel', async () => {
    vi.mocked(AuthGetCurrentUserServer).mockResolvedValue({
      userId: 'user-123',
    } as any);

    mockGetLead.mockResolvedValueOnce({
      data: {
        id: 'lead-123',
        ownerAddress: '15 Basie Court',
        ownerCity: 'Monroe',
        ownerState: 'NJ',
        ownerZip: '08831',
        validationStatus: 'INVALID',
        leadLabels: ['PROBATE'],
      },
    });

    const expectedLead = {
      id: 'lead-123',
      ownerAddress: '15 Basie Ct',
      ownerCity: 'Monroe',
      ownerState: 'NJ',
      ownerZip: '08831',
      ownerCounty: 'Middlesex County',
      validationStatus: 'VALID',
      zestimate: 650000,
      listingStatus: 'sold',
    };

    mockUpdateLead.mockResolvedValueOnce({
      data: expectedLead,
      errors: undefined,
    });

    const req = createRequest({
      leadId: 'lead-123',
      street: '15 Basie Ct',
      city: 'Monroe',
      state: 'NJ',
      zip: '08831',
      county: 'Middlesex County',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.lead.ownerAddress).toBe('15 Basie Ct');
    expect(json.lead.validationStatus).toBe('VALID');

    // Verify update was called with correct payload
    expect(mockUpdateLead).toHaveBeenCalledTimes(1);
    const updateCallArg = mockUpdateLead.mock.calls[0][0];
    expect(updateCallArg.id).toBe('lead-123');
    expect(updateCallArg.ownerAddress).toBe('15 Basie Ct');
    expect(updateCallArg.validationStatus).toBe('VALID');
    expect(updateCallArg.zestimate).toBe(650000);
    expect(updateCallArg.listingStatus).toBe('sold');
    expect(JSON.parse(updateCallArg.standardizedAddress)).toEqual({
      street: '15 Basie Ct',
      city: 'Monroe',
      state: 'NJ',
      zip: '08831',
      county: 'Middlesex County',
    });
  });
});
