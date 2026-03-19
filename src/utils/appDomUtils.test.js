import { afterEach, describe, expect, it, vi } from 'vitest';

import { isMacDesktopWebViewLike } from './appDomUtils.js';

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
