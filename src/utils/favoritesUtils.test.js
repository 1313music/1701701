import { describe, expect, it } from 'vitest';
import {
  addFavoriteId,
  clearFavoriteIds,
  toggleAlbumFavoritesBySongs,
  toggleFavoriteId
} from './favoritesUtils.js';

describe('favoritesUtils', () => {
  it('toggleFavoriteId adds then removes the same id without duplicates', () => {
    const added = toggleFavoriteId(['a', 'a', 'b'], 'c');
    expect(added).toEqual({
      nextIds: ['a', 'b', 'c'],
      action: 'added'
    });

    const removed = toggleFavoriteId(added.nextIds, 'c');
    expect(removed).toEqual({
      nextIds: ['a', 'b'],
      action: 'removed'
    });
  });

  it('addFavoriteId keeps existing ids stable', () => {
    const existed = addFavoriteId(['a', 'b'], 'b');
    expect(existed).toEqual({
      nextIds: ['a', 'b'],
      action: 'noop'
    });

    const added = addFavoriteId(['a', 'b'], 'c');
    expect(added).toEqual({
      nextIds: ['a', 'b', 'c'],
      action: 'added'
    });
  });

  it('toggleAlbumFavoritesBySongs appends only missing ids', () => {
    const songs = [
      { src: 'a' },
      { src: 'b' },
      { src: 'b' },
      { src: '' },
      {}
    ];
    const result = toggleAlbumFavoritesBySongs(['a'], songs);
    expect(result).toEqual({
      nextIds: ['a', 'b'],
      action: 'added',
      count: 1
    });
  });

  it('toggleAlbumFavoritesBySongs removes when all songs are already favorited', () => {
    const songs = [{ src: 'a' }, { src: 'b' }];
    const result = toggleAlbumFavoritesBySongs(['a', 'b', 'c'], songs);
    expect(result).toEqual({
      nextIds: ['c'],
      action: 'removed',
      count: 2
    });
  });

  it('clearFavoriteIds keeps empty state and clears non-empty state', () => {
    expect(clearFavoriteIds([])).toEqual({
      nextIds: [],
      changed: false
    });
    expect(clearFavoriteIds(['a', 'b'])).toEqual({
      nextIds: [],
      changed: true
    });
  });
});
