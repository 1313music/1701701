import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetMusicManifestCacheForTests,
  loadMusicManifestAlbums
} from './musicManifest.js';

describe('musicManifest asset normalization', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    __resetMusicManifestCacheForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    __resetMusicManifestCacheForTests();
    vi.restoreAllMocks();
  });

  it('resolves relative song assets against the manifest endpoint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        albums: [
          {
            id: 'album-1',
            name: 'Album',
            cover: '../covers/album.jpg',
            songs: [
              {
                id: 'song-1',
                name: 'Song',
                src: '../audio/song.mp3',
                lrc: '../lyrics/song.lrc',
                cover: '../covers/song.jpg'
              }
            ]
          }
        ]
      })
    });

    const albums = await loadMusicManifestAlbums();

    expect(albums[0].cover).toBe('https://r2.1701701.xyz/covers/album.jpg');
    expect(albums[0].songs[0].src).toBe('https://r2.1701701.xyz/audio/song.mp3');
    expect(albums[0].songs[0].lrc).toBe('https://r2.1701701.xyz/lyrics/song.lrc');
    expect(albums[0].songs[0].cover).toBe('https://r2.1701701.xyz/covers/song.jpg');
  });
});
