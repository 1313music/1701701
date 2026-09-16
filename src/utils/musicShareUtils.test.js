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

  // 页面里正在用的分享链接是短参数，卡片上的二维码直接承载它
  describe('short share params', () => {
    it('resolves a track from the short a/s form', () => {
      const albums = createAlbums();

      expect(resolveMusicShareTarget(albums, '?a=album-1&s=2')).toEqual({
        album: albums[0],
        track: albums[0].songs[1]
      });
    });

    it('defaults to the first song when s is absent or out of range', () => {
      const albums = createAlbums();

      expect(resolveMusicShareTarget(albums, '?a=album-1').track).toBe(albums[0].songs[0]);
      expect(resolveMusicShareTarget(albums, '?a=album-1&s=999').track).toBe(albums[0].songs[0]);
    });

    it('keeps resolving the legacy long form', () => {
      const albums = createAlbums();

      expect(resolveMusicShareTarget(albums, '?albumId=album-1&songId=song-b&song=1').track).toBe(
        albums[0].songs[1]
      );
    });

    it('returns null when the album is unknown', () => {
      expect(resolveMusicShareTarget(createAlbums(), '?a=missing&s=1')).toBeNull();
    });
  });
});
