import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { shouldDeferViewportUpdate, useAndroidViewportVars } from './useThemeEnvironment.js';

describe('shouldDeferViewportUpdate', () => {
  it('only defers visual viewport updates while a scroll gesture is active', () => {
    expect(shouldDeferViewportUpdate({
      reason: 'visual-viewport-resize',
      isScrollGestureActive: true
    })).toBe(true);

    expect(shouldDeferViewportUpdate({
      reason: 'visual-viewport-scroll',
      isScrollGestureActive: true
    })).toBe(true);

    expect(shouldDeferViewportUpdate({
      reason: 'visual-viewport-resize',
      isScrollGestureActive: false
    })).toBe(false);

    expect(shouldDeferViewportUpdate({
      reason: 'window-resize',
      isScrollGestureActive: true
    })).toBe(false);
  });
});

describe('useAndroidViewportVars', () => {
  let originalUserAgentDescriptor;
  let originalInnerWidth;
  let originalInnerHeight;
  let originalScreenHeight;
  let originalVisualViewport;
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  beforeEach(() => {
    vi.useFakeTimers();

    originalUserAgentDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    originalScreenHeight = window.screen.height;
    originalVisualViewport = window.visualViewport;
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;

    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)'
    });

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390
    });

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800
    });

    Object.defineProperty(window.screen, 'height', {
      configurable: true,
      value: 844
    });

    window.requestAnimationFrame = vi.fn((callback) => {
      callback();
      return 1;
    });
    window.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    if (originalUserAgentDescriptor) {
      Object.defineProperty(window.navigator, 'userAgent', originalUserAgentDescriptor);
    }

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth
    });

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight
    });

    Object.defineProperty(window.screen, 'height', {
      configurable: true,
      value: originalScreenHeight
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: originalVisualViewport
    });

    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const installVisualViewportMock = () => {
    const listeners = new Map();
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        height: 720,
        offsetTop: 0,
        addEventListener: vi.fn((type, handler) => {
          listeners.set(type, handler);
        }),
        removeEventListener: vi.fn((type) => {
          listeners.delete(type);
        })
      }
    });
    return listeners;
  };

  it('defers visual viewport layout writes until scrolling settles', () => {
    const listeners = installVisualViewportMock();
    const setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty');

    renderHook(() => useAndroidViewportVars());
    setPropertySpy.mockClear();

    window.dispatchEvent(new Event('scroll'));
    listeners.get('resize')?.();

    expect(setPropertySpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(159);
    expect(setPropertySpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(setPropertySpy).toHaveBeenCalled();
  });

  it('applies visual viewport updates immediately when there is no active scroll gesture', () => {
    const listeners = installVisualViewportMock();
    const setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty');

    renderHook(() => useAndroidViewportVars());
    setPropertySpy.mockClear();

    listeners.get('resize')?.();

    expect(setPropertySpy).toHaveBeenCalled();
  });
});
