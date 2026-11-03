import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn().mockReturnValue({
      send: (...args: any[]) => mockSend(...args),
    }),
  },
  GetCommand: vi.fn().mockImplementation(function (input) {
    return { input, _command: 'Get' };
  }),
  ScanCommand: vi.fn().mockImplementation(function (input) {
    return { input, _command: 'Scan' };
  }),
  UpdateCommand: vi.fn().mockImplementation(function (input) {
    return { input, _command: 'Update' };
  }),
}));

vi.mock('../../amplify/functions/shared/ghlFieldProvisioner', () => ({
  provisionCustomFields: vi.fn().mockResolvedValue({}),
  provisionOpportunityFields: vi.fn().mockResolvedValue({}),
}));

import {
  acquireProvisioningLock,
  releaseProvisioningLock,
  waitForProvisioningCompletion,
} from '../../amplify/functions/shared/ghlTokenManager';

describe('GHL Provisioning Lock (Concurrency Guard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('acquireProvisioningLock', () => {
    it('returns true when lock update succeeds', async () => {
      mockSend.mockResolvedValueOnce({});
      const acquired = await acquireProvisioningLock('integration-123');
      expect(acquired).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Key).toEqual({ id: 'integration-123' });
      expect(cmd.input.ConditionExpression).toContain('attribute_not_exists(isProvisioning)');
    });

    it('returns false when conditional check fails (lock already held)', async () => {
      const condError: any = new Error('ConditionalCheckFailed');
      condError.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(condError);

      const acquired = await acquireProvisioningLock('integration-123');
      expect(acquired).toBe(false);
    });

    it('returns false and logs error on other DynamoDB exceptions', async () => {
      mockSend.mockRejectedValueOnce(new Error('Internal DynamoDB error'));
      const acquired = await acquireProvisioningLock('integration-123');
      expect(acquired).toBe(false);
    });
  });

  describe('releaseProvisioningLock', () => {
    it('releases lock and writes customFieldIds atomically', async () => {
      mockSend.mockResolvedValueOnce({});
      await releaseProvisioningLock(
        'integration-123',
        { sheriff_sale_date: 'field-1' },
        { disposition: 'field-2' }
      );
      expect(mockSend).toHaveBeenCalledTimes(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.UpdateExpression).toContain('isProvisioning = :false');
      expect(cmd.input.UpdateExpression).toContain('customFieldIds = :cfids');
      expect(cmd.input.ExpressionAttributeValues[':cfids']).toEqual({ sheriff_sale_date: 'field-1' });
      expect(cmd.input.ExpressionAttributeValues[':ofids']).toEqual({ disposition: 'field-2' });
    });
  });

  describe('waitForProvisioningCompletion', () => {
    it('returns item when isProvisioning is false', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          id: 'integration-123',
          isProvisioning: false,
          customFieldIds: { sheriff_sale_date: 'id-abc' },
        },
      });

      const result = await waitForProvisioningCompletion('integration-123', 2000);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('integration-123');
      expect(result?.customFieldIds).toEqual({ sheriff_sale_date: 'id-abc' });
    });

    it('returns null if wait times out before provisioning completes', async () => {
      mockSend.mockResolvedValue({
        Item: {
          id: 'integration-123',
          isProvisioning: true,
        },
      });

      const result = await waitForProvisioningCompletion('integration-123', 600);
      expect(result).toBeNull();
    });
  });
});
