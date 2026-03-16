import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetGalleryManifestCacheForTests,
  loadGalleryItems
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
});
