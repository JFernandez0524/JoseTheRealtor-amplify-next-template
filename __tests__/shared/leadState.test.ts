import { describe, it, expect } from 'vitest';
import { mergeLeadsById } from '../../app/utils/leadState';

// Pure state patcher behind every inline dashboard edit. The dashboard list is a filtered and
// sorted view, so order preservation and "don't append unknown rows" are correctness properties,
// not conveniences — a reordered or misplaced row moves under the user's cursor mid-edit.

type TestLead = { id: string; listingStatus?: string | null; zestimate?: number | null };
const lead = (id: string, extra: Partial<TestLead> = {}): any => ({ id, ...extra });

describe('mergeLeadsById', () => {
  it('replaces a matching lead by id', () => {
    const existing = [lead('a', { listingStatus: 'off_market' }), lead('b')];
    const result = mergeLeadsById(existing, [lead('a', { listingStatus: 'sold' })]);

    expect(result).toHaveLength(2);
    expect(result[0].listingStatus).toBe('sold');
  });

  it('preserves position and length', () => {
    const existing = [lead('a'), lead('b'), lead('c'), lead('d')];
    const result = mergeLeadsById(existing, [lead('c', { zestimate: 500000 })]);

    expect(result.map((l) => l.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(result[2].zestimate).toBe(500000);
  });

  it('leaves non-matching leads referentially identical', () => {
    const untouched = lead('b');
    const result = mergeLeadsById([lead('a'), untouched], [lead('a', { zestimate: 1 })]);

    // Same object reference — lets React skip re-rendering those rows.
    expect(result[1]).toBe(untouched);
  });

  it('replaces multiple leads in one call', () => {
    const existing = [lead('a'), lead('b'), lead('c')];
    const result = mergeLeadsById(existing, [
      lead('a', { zestimate: 1 }),
      lead('c', { zestimate: 3 }),
    ]);

    expect(result[0].zestimate).toBe(1);
    expect(result[1].zestimate).toBeUndefined();
    expect(result[2].zestimate).toBe(3);
  });

  it('ignores updates for ids not already in the list', () => {
    // Appending would drop the row at the end of a sorted list, where its sort key doesn't put it.
    const existing = [lead('a'), lead('b')];
    const result = mergeLeadsById(existing, [lead('zzz', { zestimate: 9 })]);

    expect(result.map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('applies only the known ids when updates are mixed known/unknown', () => {
    const result = mergeLeadsById(
      [lead('a'), lead('b')],
      [lead('b', { zestimate: 7 }), lead('ghost', { zestimate: 8 })]
    );

    expect(result).toHaveLength(2);
    expect(result[1].zestimate).toBe(7);
  });

  it('lets the last entry win when updates contain a duplicate id', () => {
    const result = mergeLeadsById(
      [lead('a')],
      [lead('a', { zestimate: 1 }), lead('a', { zestimate: 2 })]
    );

    expect(result[0].zestimate).toBe(2);
  });

  it('returns a new array reference so React re-renders', () => {
    const existing = [lead('a')];
    expect(mergeLeadsById(existing, [lead('a', { zestimate: 1 })])).not.toBe(existing);
    // Also on the no-op paths, so callers can assign the result unconditionally.
    expect(mergeLeadsById(existing, [])).not.toBe(existing);
  });

  it('does not mutate either input array', () => {
    const original = lead('a', { listingStatus: 'off_market' });
    const existing = [original];
    const updates = [lead('a', { listingStatus: 'sold' })];

    mergeLeadsById(existing, updates);

    expect(existing[0]).toBe(original);
    expect(existing[0].listingStatus).toBe('off_market');
    expect(updates).toHaveLength(1);
  });

  it('handles empty and missing inputs without throwing', () => {
    expect(mergeLeadsById([], [lead('a')])).toEqual([]);
    expect(mergeLeadsById([lead('a')], [])).toHaveLength(1);
    expect(mergeLeadsById([], [])).toEqual([]);
    expect(mergeLeadsById(undefined as any, [lead('a')])).toEqual([]);
    expect(mergeLeadsById([lead('a')], undefined as any)).toHaveLength(1);
  });

  it('skips update entries with no id rather than dropping rows', () => {
    const existing = [lead('a'), lead('b')];
    const result = mergeLeadsById(existing, [{ id: undefined } as any, null as any]);

    expect(result.map((l) => l.id)).toEqual(['a', 'b']);
  });
});
