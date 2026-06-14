import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetDownloadManifestCacheForTests,
  loadDownloadSections,
  subscribeToDownloadSections
} from './downloadManifest.js';

describe('downloadManifest asset normalization', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    __resetDownloadManifestCacheForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    __resetDownloadManifestCacheForTests();
    vi.restoreAllMocks();
  });

  it('resolves relative download assets against the manifest endpoint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sections: [
          {
            title: '下载',
            note: {
              label: '说明',
              href: '../notes/readme.html'
            },
            groups: [
              {
                title: '资源',
                items: [
                  {
                    title: '相对资源',
                    url: '../files/archive.zip',
                    previewUrl: '../preview/archive.html'
                  }
                ]
              }
            ]
          }
        ]
      })
    });

    const sections = await loadDownloadSections();

    expect(sections[0].note).toEqual({
      label: '说明',
      href: 'https://r2.1701701.xyz/notes/readme.html'
    });
    expect(sections[0].groups[0].items[0].url).toBe('https://r2.1701701.xyz/files/archive.zip');
    expect(sections[0].groups[0].items[0].previewUrl).toBe('https://r2.1701701.xyz/preview/archive.html');
  });

  it('returns stale persisted sections while notifying subscribers after a background refresh', async () => {
    const cachedSections = [
      {
        title: '旧栏目',
        groups: [
          {
            title: '旧分组',
            items: [{ title: '旧资源', url: 'https://example.com/old.zip' }]
          }
        ]
      }
    ];
    window.localStorage.setItem('manifest-cache:download:v1', JSON.stringify({
      savedAt: Date.now() - 7 * 60 * 60 * 1000,
      data: cachedSections
    }));
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sections: [
          {
            title: '新栏目',
            groups: [
              {
                title: '新分组',
                items: [
                  {
                    title: '新资源',
                    url: 'https://example.com/fresh.zip'
                  }
                ]
              }
            ]
          }
        ]
      })
    });
    const listener = vi.fn();
    const unsubscribe = subscribeToDownloadSections(listener);

    const sections = await loadDownloadSections();

    expect(sections).toEqual(cachedSections);
    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledWith([
        {
          title: '新栏目',
          groups: [
            {
              title: '新分组',
              items: [
                {
                  title: '新资源',
                  url: 'https://example.com/fresh.zip',
                  filename: undefined,
                  previewUrl: undefined
                }
              ]
            }
          ],
          note: undefined
        }
      ]);
    });
    unsubscribe();
  });
});
