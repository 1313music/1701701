import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetVideoManifestCacheForTests,
  loadVideoCatalog,
  subscribeToVideoCatalog
} from './videoManifest.js';

describe('videoManifest asset normalization', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    __resetVideoManifestCacheForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    __resetVideoManifestCacheForTests();
    vi.restoreAllMocks();
  });

  it('resolves relative video assets against the manifest endpoint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        categories: [
          {
            id: 'cat-1',
            name: '分类',
            items: [
              {
                id: 'folder-1',
                type: 'folder',
                title: '合集',
                thumb: '../thumbs/folder.jpg',
                items: [
                  {
                    id: 'video-1',
                    title: '视频 1',
                    url: '../video/1.m3u8',
                    backupUrl: '../video/1.mp4',
                    thumb: '../thumbs/video.jpg'
                  }
                ]
              }
            ]
          }
        ]
      })
    });

    const catalog = await loadVideoCatalog();
    const folder = catalog.videoData['cat-1'][0];
    const video = catalog.videoData[folder.folderId][0];

    expect(folder.thumb).toBe('https://r2.1701701.xyz/thumbs/folder.jpg');
    expect(video.url).toBe('https://r2.1701701.xyz/video/1.m3u8');
    expect(video.backupUrl).toBe('https://r2.1701701.xyz/video/1.mp4');
    expect(video.thumb).toBe('https://r2.1701701.xyz/thumbs/video.jpg');
  });

  it('returns stale persisted catalog while notifying subscribers after a background refresh', async () => {
    const cachedCatalog = {
      videoCategories: [{ id: 'old', name: '旧分类', icon: '#icon-video' }],
      videoData: { old: [] }
    };
    window.localStorage.setItem('manifest-cache:video:v1', JSON.stringify({
      savedAt: Date.now() - 7 * 60 * 60 * 1000,
      data: cachedCatalog
    }));
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        categories: [
          {
            id: 'fresh',
            name: '新分类',
            items: []
          }
        ]
      })
    });
    const listener = vi.fn();
    const unsubscribe = subscribeToVideoCatalog(listener);

    const catalog = await loadVideoCatalog();

    expect(catalog).toEqual(cachedCatalog);
    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledWith({
        videoCategories: [{ id: 'fresh', name: '新分类', icon: '#icon-video' }],
        videoData: { fresh: [] }
      });
    });
    unsubscribe();
  });
});
