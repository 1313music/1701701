import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDesktopLyricEdgeOpacity, useLyricsOverlayViewport } from './useLyricsOverlayViewport.js';

const createBaseProps = (overrides = {}) => ({
  currentLyricIndex: 0,
  currentTrackName: '测试歌曲',
  currentTrackSrc: 'track-1',
  isLyricsOpen: true,
  lyrics: [{ time: 1, text: 'hello' }],
  setIsLyricsOpen: vi.fn(),
  ...overrides
});

describe('useLyricsOverlayViewport', () => {
  let originalInnerWidth;
  let originalResizeObserver;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalResizeObserver = globalThis.ResizeObserver;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth
    });
    globalThis.ResizeObserver = originalResizeObserver;
    vi.restoreAllMocks();
  });

  it('scrolls the active lyric into view and enables marquee when the mobile title overflows', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390
    });

    globalThis.ResizeObserver = class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
        this.callback();
      }
      disconnect() {}
    };

    const { result, rerender } = renderHook((props) => useLyricsOverlayViewport(props), {
      initialProps: createBaseProps()
    });

    const scrollTo = vi.fn();
    result.current.mobileTitleRef.current = {
      scrollWidth: 200,
      clientWidth: 100
    };
    result.current.mobileLyricsScrollerRef.current = {
      clientHeight: 120,
      scrollHeight: 300,
      scrollTo
    };
    result.current.mobileLyricsWrapRef.current = {
      querySelector: vi.fn().mockReturnValue({
        offsetTop: 150,
        offsetHeight: 30
      })
    };

    rerender(createBaseProps({
      currentTrackName: '测试歌曲（新版）',
      currentTrackSrc: 'track-2'
    }));

    await waitFor(() => {
      expect(result.current.isMobileTitleMarquee).toBe(true);
    });

    expect(scrollTo).toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith({ top: 105, behavior: 'auto' });
  });

  it('closes on left swipe and left-edge right swipe, but ignores blocked starts', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390
    });

    const setIsLyricsOpen = vi.fn();
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);

    const { result } = renderHook(() => useLyricsOverlayViewport(createBaseProps({
      setIsLyricsOpen
    })));

    result.current.handleOverlayTouchStart({
      touches: [{ clientX: 180, clientY: 40 }],
      target: {
        closest: () => null
      }
    });

    nowSpy.mockReturnValue(1100);
    result.current.handleOverlayTouchEnd({
      changedTouches: [{ clientX: 40, clientY: 45 }]
    });

    expect(setIsLyricsOpen).toHaveBeenCalledWith(false);

    setIsLyricsOpen.mockClear();
    nowSpy.mockReturnValue(2000);

    result.current.handleOverlayTouchStart({
      touches: [{ clientX: 24, clientY: 80 }],
      target: {
        closest: () => null
      }
    });

    nowSpy.mockReturnValue(2100);
    result.current.handleOverlayTouchEnd({
      changedTouches: [{ clientX: 160, clientY: 84 }]
    });

    expect(setIsLyricsOpen).toHaveBeenCalledWith(false);

    setIsLyricsOpen.mockClear();
    nowSpy.mockReturnValue(3000);

    result.current.handleOverlayTouchStart({
      touches: [{ clientX: 140, clientY: 80 }],
      target: {
        closest: () => null
      }
    });

    nowSpy.mockReturnValue(3100);
    result.current.handleOverlayTouchEnd({
      changedTouches: [{ clientX: 280, clientY: 84 }]
    });

    expect(setIsLyricsOpen).not.toHaveBeenCalled();

    nowSpy.mockReturnValue(4000);

    result.current.handleOverlayTouchStart({
      touches: [{ clientX: 180, clientY: 40 }],
      target: {
        closest: () => '.overlay-header'
      }
    });

    nowSpy.mockReturnValue(4100);
    result.current.handleOverlayTouchEnd({
      changedTouches: [{ clientX: 40, clientY: 45 }]
    });

    expect(setIsLyricsOpen).not.toHaveBeenCalled();
  });

  it('computes stronger opacity near the center and lighter opacity near the edges', () => {
    const centerOpacity = getDesktopLyricEdgeOpacity({
      lineCenter: 300,
      scrollerTop: 100,
      scrollerHeight: 400,
      isActive: false
    });

    const edgeOpacity = getDesktopLyricEdgeOpacity({
      lineCenter: 110,
      scrollerTop: 100,
      scrollerHeight: 400,
      isActive: false
    });

    const activeEdgeOpacity = getDesktopLyricEdgeOpacity({
      lineCenter: 110,
      scrollerTop: 100,
      scrollerHeight: 400,
      isActive: true
    });

    expect(centerOpacity).toBeGreaterThan(edgeOpacity);
    expect(edgeOpacity).toBeLessThan(0.25);
    expect(activeEdgeOpacity).toBeGreaterThan(edgeOpacity);
  });
});
