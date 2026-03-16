import { describe, expect, it } from 'vitest';

import { resolveMusicShareTarget } from './musicShareUtils.js';

const createAlbums = () => ([
  {
    id: 'album-1',
    songs: [
      { id: 'song-a', name: 'Song A' },
      { id: 'song-b', name: 'Song B' },
      { id: 'song-c', name: 'Song C' }
    ]
  }
]);

describe('resolveMusicShareTarget', () => {
  it('prefers songId when present', () => {
    const resolved = resolveMusicShareTarget(
      createAlbums(),
      '?albumId=album-1&songId=song-c&song=1'
    );

    expect(resolved).toEqual({
      album: createAlbums()[0],
      track: createAlbums()[0].songs[2]
    });
  });

  it('falls back to song index when songId is missing or not found', () => {
    const albums = createAlbums();

    expect(resolveMusicShareTarget(albums, '?albumId=album-1&song=2')).toEqual({
      album: albums[0],
      track: albums[0].songs[1]
    });

    expect(resolveMusicShareTarget(albums, '?albumId=album-1&songId=missing&song=3')).toEqual({
      album: albums[0],
      track: albums[0].songs[2]
    });
  });

  it('defaults to the first song when index is invalid', () => {
    const albums = createAlbums();

    expect(resolveMusicShareTarget(albums, '?albumId=album-1&song=999')).toEqual({
      album: albums[0],
      track: albums[0].songs[0]
    });
  });
});
