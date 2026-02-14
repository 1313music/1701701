import { describe, expect, it } from 'vitest';
import { sanitizeTempPlaylist } from './playlistUtils';

describe('sanitizeTempPlaylist', () => {
  it('deduplicates and preserves order', () => {
    const result = sanitizeTempPlaylist(['a', 'b', 'a', 'c', 'b']);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('filters out ids that are not in valid set', () => {
    const validSet = new Set(['b', 'c']);
    const result = sanitizeTempPlaylist(['a', 'b', 'c', 'd'], validSet);
    expect(result).toEqual(['b', 'c']);
  });

  it('returns empty list for invalid inputs', () => {
    expect(sanitizeTempPlaylist(null)).toEqual([]);
    expect(sanitizeTempPlaylist('abc')).toEqual([]);
  });
});
