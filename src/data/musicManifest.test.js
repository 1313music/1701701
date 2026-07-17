import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetMusicManifestCacheForTests,
  loadMusicManifestAlbums,
  subscribeToMusicManifestAlbums
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
            releaseDate: '2014-05-22',
            description: 'Album introduction',
            profileSourceName: 'Album Notes',
            profileSourceUrl: '../notes/album.html',
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
    expect(albums[0].releaseDate).toBe('2014-05-22');
    expect(albums[0].description).toBe('Album introduction');
    expect(albums[0].profileSourceName).toBe('Album Notes');
    expect(albums[0].profileSourceUrl).toBe('https://r2.1701701.xyz/notes/album.html');
    expect(albums[0].songs[0].src).toBe('https://r2.1701701.xyz/audio/song.mp3');
    expect(albums[0].songs[0].lrc).toBe('https://r2.1701701.xyz/lyrics/song.lrc');
    expect(albums[0].songs[0].cover).toBe('https://r2.1701701.xyz/covers/song.jpg');
  });

  it('pins the requested default album first and the tour albums last', async () => {
    const createAlbum = (id, name, sortOrder) => ({
      id,
      name,
      artist: '李志',
      cover: '',
      sortOrder,
      songs: [
        {
          id: `${id}-song`,
          trackNumber: 1,
          name: `${name} Song`,
          src: `https://example.com/${id}.mp3`
        }
      ]
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        albums: [
          createAlbum('san-que-yi-kl', '叁缺壹吉隆坡站', 10),
          createAlbum('tokyo-live', 'THREE MISSING ONE JAPAN Tour 2024 in Tokyo', 20),
          createAlbum('forbidden-games', '被禁忌的游戏', 30),
          createAlbum('van-gogh', '梵高先生', 40),
          createAlbum('other', '其他', 340)
        ]
      })
    });

    const albums = await loadMusicManifestAlbums();

    expect(albums.map((album) => album.id)).toEqual([
      'forbidden-games',
      'van-gogh',
      'other',
      'san-que-yi-kl',
      'tokyo-live'
    ]);
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

  it('returns stale persisted albums while notifying subscribers after a background refresh', async () => {
    const cachedAlbums = [
      {
        id: 'album-cache',
        name: 'Cached Album',
        artist: 'Cached Artist',
        cover: '',
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
      savedAt: Date.now() - 7 * 60 * 60 * 1000,
      data: cachedAlbums
    }));
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        albums: [
          {
            id: 'album-fresh',
            name: 'Fresh Album',
            songs: [
              {
                id: 'song-fresh',
                name: 'Fresh Song',
                src: 'https://example.com/fresh-song.mp3'
              }
            ]
          }
        ]
      })
    });
    const listener = vi.fn();
    const unsubscribe = subscribeToMusicManifestAlbums(listener);

    const albums = await loadMusicManifestAlbums();

    expect(albums).toEqual(cachedAlbums);
    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'album-fresh',
          songs: [
            expect.objectContaining({
              src: 'https://example.com/fresh-song.mp3'
            })
          ]
        })
      ]);
    });
    unsubscribe();
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
