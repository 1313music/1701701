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

  it('reuses persisted cache after module memory is reset', async () => {
    const cachedAlbums = [
      {
        id: 'album-cache',
        name: 'Cached Album',
        artist: 'Cached Artist',
        cover: 'https://example.com/cached-cover.jpg',
        songs: [
          {
            id: 'song-cache',
            trackNumber: 1,
            name: 'Cached Song',
            src: 'https://example.com/cached-song.mp3',
            lrc: '',
            cover: ''
          }
        ]
      }
    ];

    window.localStorage.setItem('manifest-cache:music:v1', JSON.stringify({
      savedAt: Date.now(),
      data: cachedAlbums
    }));
    globalThis.fetch = vi.fn();

    const albums = await loadMusicManifestAlbums();

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(albums).toEqual(cachedAlbums);
  });

  it('falls back to bundled snapshot when the remote manifest request fails', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          albums: [
            {
              id: 'album-fallback',
              name: 'Fallback Album',
              songs: [
                {
                  id: 'song-fallback',
                  name: 'Fallback Song',
                  src: './song.mp3'
                }
              ]
            }
          ]
        })
      });

    const albums = await loadMusicManifestAlbums();

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://r2.1701701.xyz/json/music-index.json',
      { cache: 'default' }
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/music-index.json',
      { cache: 'default' }
    );
    expect(albums[0].songs[0].src).toBe('http://localhost:3000/song.mp3');
  });
});
