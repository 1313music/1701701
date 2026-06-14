import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetGalleryManifestCacheForTests,
  loadGalleryItems,
  subscribeToGalleryItems
} from './galleryManifest.js';

describe('galleryManifest image index', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    __resetGalleryManifestCacheForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    __resetGalleryManifestCacheForTests();
    vi.restoreAllMocks();
  });

  it('resolves flat image index items against the manifest endpoint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'images/XKK/example.jpg',
            name: 'example.jpg',
            path: 'images/XKK/example.jpg',
            url: '/images/XKK/example.jpg'
          }
        ]
      })
    });

    const items = await loadGalleryItems();

    expect(items).toEqual([
      {
        id: 'images/XKK/example.jpg',
        category: 'XKK',
        name: 'example.jpg',
        url: 'https://imgs.1701701.xyz/images/XKK/example.jpg',
        previewUrl: 'https://imgs.1701701.xyz/images/XKK/example.jpg'
      }
    ]);
  });

  it('returns stale persisted items while notifying subscribers after a background refresh', async () => {
    const cachedItems = [
      {
        id: 'images/OLD/example.jpg',
        category: 'OLD',
        name: 'example.jpg',
        url: 'https://example.com/old.jpg',
        previewUrl: 'https://example.com/old.jpg'
      }
    ];
    window.localStorage.setItem('manifest-cache:gallery:v1', JSON.stringify({
      savedAt: Date.now() - 7 * 60 * 60 * 1000,
      data: cachedItems
    }));
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'images/XKK/fresh.jpg',
            name: 'fresh.jpg',
            path: 'images/XKK/fresh.jpg',
            url: '/images/XKK/fresh.jpg'
          }
        ]
      })
    });
    const listener = vi.fn();
    const unsubscribe = subscribeToGalleryItems(listener);

    const items = await loadGalleryItems();

    expect(items).toEqual(cachedItems);
    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledWith([
        {
          id: 'images/XKK/fresh.jpg',
          category: 'XKK',
          name: 'fresh.jpg',
          url: 'https://imgs.1701701.xyz/images/XKK/fresh.jpg',
          previewUrl: 'https://imgs.1701701.xyz/images/XKK/fresh.jpg'
        }
      ]);
    });
    unsubscribe();
  });
});
