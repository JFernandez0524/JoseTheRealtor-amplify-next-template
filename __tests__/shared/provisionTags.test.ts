import { describe, it, expect } from 'vitest';
import { tagsToCreate, SYSTEM_TAGS } from '../../amplify/functions/shared/ghlFieldProvisioner';

// tagsToCreate is pure — no GHL/HTTP needed.

describe('tagsToCreate', () => {
  it('returns only the tags not already present', () => {
    const desired = ['app:synced', 'ai outreach', 'needs_review'];
    const existing = ['app:synced'];
    expect(tagsToCreate(desired, existing)).toEqual(['ai outreach', 'needs_review']);
  });

  it('is case- and whitespace-insensitive against existing tags', () => {
    const desired = ['App:Synced', 'AI Outreach'];
    const existing = ['app:synced', '  ai outreach '];
    expect(tagsToCreate(desired, existing)).toEqual([]);
  });

  it('returns all desired when none exist', () => {
    expect(tagsToCreate(['a', 'b'], [])).toEqual(['a', 'b']);
  });

  it('returns empty when all desired already exist', () => {
    expect(tagsToCreate(SYSTEM_TAGS, SYSTEM_TAGS)).toEqual([]);
  });

  it('SYSTEM_TAGS has no duplicates and is non-empty', () => {
    expect(SYSTEM_TAGS.length).toBeGreaterThan(0);
    const lower = SYSTEM_TAGS.map((t) => t.toLowerCase().trim());
    expect(new Set(lower).size).toBe(SYSTEM_TAGS.length);
  });
});
