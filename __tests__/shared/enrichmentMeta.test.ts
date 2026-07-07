import { describe, it, expect } from 'vitest';
import { readBatchMeta } from '../../app/utils/batchdata/enrichment';

// readBatchMeta pulls BatchData's authoritative match accounting from the nested response shape
// (results.meta.results.{matchCount,noMatchCount} + results.meta.requestId). This drives billing.

describe('readBatchMeta', () => {
  it('reads a real no-match response (47 Pitch Pine shape)', () => {
    const data = {
      status: { code: 200, text: 'OK' },
      results: {
        properties: [],
        meta: {
          requestId: '01KWYB4RGX0FWNN33F80QP7NKY',
          results: { requestCount: 1, matchCount: 0, noMatchCount: 1, errorCount: 0 },
        },
      },
    };
    expect(readBatchMeta(data)).toEqual({ matchCount: 0, noMatchCount: 1, requestId: '01KWYB4RGX0FWNN33F80QP7NKY' });
  });

  it('reads a matched response', () => {
    const data = {
      status: { code: 200 },
      results: {
        properties: [{}, {}, {}],
        meta: { requestId: 'req_abc', results: { requestCount: 4, matchCount: 3, noMatchCount: 1, errorCount: 0 } },
      },
    };
    expect(readBatchMeta(data)).toEqual({ matchCount: 3, noMatchCount: 1, requestId: 'req_abc' });
  });

  it('defaults to zeros / null when meta is missing or malformed', () => {
    expect(readBatchMeta({ results: { properties: [] } })).toEqual({ matchCount: 0, noMatchCount: 0, requestId: null });
    expect(readBatchMeta({})).toEqual({ matchCount: 0, noMatchCount: 0, requestId: null });
    expect(readBatchMeta(null)).toEqual({ matchCount: 0, noMatchCount: 0, requestId: null });
    expect(readBatchMeta(undefined)).toEqual({ matchCount: 0, noMatchCount: 0, requestId: null });
  });
});
