import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetVideoAccessConfigCacheForTests,
  loadVideoAccessConfig
} from './videoAccessConfig.js';

describe('videoAccessConfig cache', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    __resetVideoAccessConfigCacheForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    __resetVideoAccessConfigCacheForTests();
    vi.restoreAllMocks();
  });

  it('reuses the access config within the cache window', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        enabled: true,
        password: 'SongSharing',
        passwordVersion: 'v1',
        updatedAt: '2026-05-18T00:00:00.000Z'
      })
    });

    const firstConfig = await loadVideoAccessConfig();
    const secondConfig = await loadVideoAccessConfig();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(secondConfig).toBe(firstConfig);
    expect(secondConfig.passwordVersion).toBe('v1');
  });

  it('normalizes disabled access checks from the remote config', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        enabled: false,
        password: 'SongSharing',
        passwordVersion: 'v1',
        qrUrl: 'https://cdn.example.com/video-qr.jpg'
      })
    });

    await expect(loadVideoAccessConfig()).resolves.toMatchObject({
      enabled: false,
      password: 'SongSharing',
      passwordVersion: 'v1',
      qrUrl: 'https://cdn.example.com/video-qr.jpg',
      promptLines: ['扫码观看广告后获取视频密码'],
      passwordNote: '如密码失效，请刷新网页或清除缓存并重新扫码获取'
    });
  });

  it('reuses persisted access config across page sessions within the cache window', async () => {
    const now = new Date('2026-05-18T00:00:00.000Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        password: 'SongSharing',
        passwordVersion: 'v1',
        updatedAt: '2026-05-18T00:00:00.000Z'
      })
    });

    await expect(loadVideoAccessConfig()).resolves.toMatchObject({ passwordVersion: 'v1' });
    __resetVideoAccessConfigCacheForTests({ clearPersistent: false });
    globalThis.fetch = vi.fn();

    const config = await loadVideoAccessConfig();

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(config).toMatchObject({
      password: 'SongSharing',
      passwordVersion: 'v1'
    });
  });

  it('refreshes persisted access config after the cache window expires', async () => {
    const cacheStartedAt = new Date('2026-05-18T00:00:00.000Z').getTime();
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(cacheStartedAt);
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          password: 'SongSharing',
          passwordVersion: 'v1'
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          password: 'SongSharing2026',
          passwordVersion: 'v2'
        })
      });

    await expect(loadVideoAccessConfig()).resolves.toMatchObject({ passwordVersion: 'v1' });
    __resetVideoAccessConfigCacheForTests({ clearPersistent: false });
    dateNow.mockReturnValue(cacheStartedAt + 12 * 60 * 60 * 1000);

    await expect(loadVideoAccessConfig()).resolves.toMatchObject({ passwordVersion: 'v2' });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('shares a single in-flight access config request', async () => {
    let resolveFetch;
    globalThis.fetch = vi.fn(() => new Promise((resolve) => {
      resolveFetch = resolve;
    }));

    const firstConfigPromise = loadVideoAccessConfig();
    const secondConfigPromise = loadVideoAccessConfig();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    resolveFetch({
      ok: true,
      json: async () => ({
        password: 'SongSharing',
        passwordVersion: 'v1'
      })
    });

    await expect(firstConfigPromise).resolves.toMatchObject({ passwordVersion: 'v1' });
    await expect(secondConfigPromise).resolves.toMatchObject({ passwordVersion: 'v1' });
  });

  it('can force-refresh the access config', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          password: 'SongSharing',
          passwordVersion: 'v1'
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          password: 'SongSharing2026',
          passwordVersion: 'v2'
        })
      });

    await expect(loadVideoAccessConfig()).resolves.toMatchObject({ passwordVersion: 'v1' });
    await expect(loadVideoAccessConfig({ forceRefresh: true })).resolves.toMatchObject({
      passwordVersion: 'v2'
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
