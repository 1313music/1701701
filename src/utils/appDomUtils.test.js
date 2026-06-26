import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isAndroidNativeAppWebView,
  isMacDesktopWebViewLike,
  saveShareCardToNativeAlbum
} from './appDomUtils.js';

const setNavigatorField = (key, value) => {
  Object.defineProperty(globalThis.navigator, key, {
    configurable: true,
    value
  });
};

describe('isMacDesktopWebViewLike', () => {
  const originalUserAgentDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'userAgent');
  const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'platform');

  afterEach(() => {
    if (originalUserAgentDescriptor) {
      Object.defineProperty(globalThis.navigator, 'userAgent', originalUserAgentDescriptor);
    }
    if (originalPlatformDescriptor) {
      Object.defineProperty(globalThis.navigator, 'platform', originalPlatformDescriptor);
    }
    delete window.__TAURI__;
    delete window.__TAURI_INTERNALS__;
    delete window.__TAURI_METADATA__;
    vi.restoreAllMocks();
  });

  it('returns false for Chromium-based mac browsers', () => {
    setNavigatorField('platform', 'MacIntel');
    setNavigatorField('userAgent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    expect(isMacDesktopWebViewLike()).toBe(false);
  });

  it('returns true for mac Apple WebKit environments without Chromium markers', () => {
    setNavigatorField('platform', 'MacIntel');
    setNavigatorField('userAgent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko)');

    expect(isMacDesktopWebViewLike()).toBe(true);
  });

  it('returns true when tauri-like globals are present on macOS', () => {
    setNavigatorField('platform', 'MacIntel');
    setNavigatorField('userAgent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36');
    window.__TAURI_INTERNALS__ = {};

    expect(isMacDesktopWebViewLike()).toBe(true);
  });
});

describe('native Android share card saving', () => {
  afterEach(() => {
    delete window.Capacitor;
    vi.restoreAllMocks();
  });

  it('calls the injected Capacitor share card saver plugin', async () => {
    const saveToAlbum = vi.fn().mockResolvedValue({ uri: 'content://media/image/1' });
    window.Capacitor = {
      getPlatform: () => 'android',
      isNativePlatform: () => true,
      Plugins: {
        ShareCardSaver: { saveToAlbum }
      }
    };

    expect(isAndroidNativeAppWebView()).toBe(true);
    await expect(saveShareCardToNativeAlbum('data:image/png;base64,AA==', 'card.png')).resolves.toBe('saved');
    expect(saveToAlbum).toHaveBeenCalledWith({
      dataUrl: 'data:image/png;base64,AA==',
      filename: 'card.png'
    });
  });

  it('reports unavailable outside the Android native app', async () => {
    window.Capacitor = {
      getPlatform: () => 'web',
      isNativePlatform: () => false,
      Plugins: {}
    };

    await expect(saveShareCardToNativeAlbum('data:image/png;base64,AA==', 'card.png')).resolves.toBe('unavailable');
  });
});
