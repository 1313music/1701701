import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetMusicManifestCacheForTests,
  loadMusicManifestAlbums,
  refreshMusicManifestAlbums,
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

  it('orders albums by sort overrides (tokyo-live then 吉隆坡 before forbidden-games)', async () => {
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
      'tokyo-live',
      'san-que-yi-kl',
      'forbidden-games',
      'van-gogh',
      'other'
    ]);
  });

  it('reuses persisted cache immediately and still revalidates in the background', async () => {
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

    window.localStorage.setItem('manifest-cache:music:v2', JSON.stringify({
      savedAt: Date.now(),
      data: cachedAlbums
    }));
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        albums: [
          {
            id: 'album-fresh',
            name: 'Fresh Album',
            artist: '李志',
            cover: '',
            songs: [
              { id: 'song-fresh', trackNumber: 1, name: 'Fresh Song', src: 'https://example.com/fresh.mp3' }
            ]
          }
        ]
      })
    });

    const albums = await loadMusicManifestAlbums();

    // 缓存先照用，页面不等网络
    expect(albums).toEqual(cachedAlbums);
    // 但必须发起一次后台校验，新增专辑才能在下一次打开时出现
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
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
    window.localStorage.setItem('manifest-cache:music:v2', JSON.stringify({
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

  it('drops the legacy v1 cache so stale clients reload the catalog', async () => {
    window.localStorage.setItem('manifest-cache:music:v1', JSON.stringify({
      savedAt: Date.now(),
      data: [
        {
          id: 'legacy-album',
          name: 'Legacy Album',
          artist: '李志',
          cover: '',
          songs: [
            { id: 'legacy-song', trackNumber: 1, name: 'Legacy Song', src: 'https://example.com/legacy.mp3' }
          ]
        }
      ]
    }));
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        albums: [
          {
            id: 'album-live',
            name: 'Live Album',
            artist: '李志',
            cover: '',
            songs: [
              { id: 'song-live', trackNumber: 1, name: 'Live Song', src: 'https://example.com/live.mp3' }
            ]
          }
        ]
      })
    });

    await loadMusicManifestAlbums();

    expect(window.localStorage.getItem('manifest-cache:music:v1')).toBeNull();
  });

  it('forces a network reload and notifies subscribers on manual refresh', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        albums: [
          {
            id: 'album-fresh',
            name: 'Fresh Album',
            artist: '李志',
            cover: '',
            songs: [
              { id: 'song-fresh', trackNumber: 1, name: 'Fresh Song', src: 'https://example.com/fresh.mp3' }
            ]
          }
        ]
      })
    });
    const received = [];
    subscribeToMusicManifestAlbums((albums) => received.push(albums));

    await refreshMusicManifestAlbums();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(globalThis.fetch).toHaveBeenCalled();
    expect(received.length).toBeGreaterThan(0);
    expect(received[received.length - 1][0].id).toBe('album-fresh');
  });
});
