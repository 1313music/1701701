import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLyricsOverlayComments } from './useLyricsOverlayComments.js';

const createBaseProps = (overrides = {}) => ({
  commentServerURL: 'https://comments.example.com',
  currentAlbum: { id: 'album-1' },
  currentSongInfo: { album: { id: 'album-1' } },
  currentTrackSrc: 'https://example.com/song.mp3',
  isLyricsOpen: false,
  isMobileViewport: () => false,
  lyricsOverlaySessionId: 3,
  openCommentRequestId: 1,
  openCommentRequestMode: 'standalone',
  openCommentRequestOverlaySessionId: 3,
  openCommentRequestTrackChangeId: 12,
  openCommentRequestTrackSrc: 'https://example.com/song.mp3',
  openCommentRequestViewContextId: 9,
  playerOverlayContextId: 9,
  trackChangeId: 12,
  ...overrides
});

describe('useLyricsOverlayComments', () => {
  let originalScrollY;
  let scrollToSpy;

  beforeEach(() => {
    originalScrollY = window.scrollY;
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 240
    });
    scrollToSpy = vi.spyOn(window, 'scrollTo');
  });

  afterEach(() => {
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: originalScrollY
    });
    document.documentElement.style.overflow = '';
    document.documentElement.style.overscrollBehavior = '';
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    vi.restoreAllMocks();
  });

  it('opens standalone desktop requests and locks the viewport', () => {
    const { result, unmount } = renderHook((props) => useLyricsOverlayComments(props), {
      initialProps: createBaseProps()
    });

    expect(result.current.currentSongCommentPath).toBe(
      'song:album-1:https%3A%2F%2Fexample.com%2Fsong.mp3'
    );
    expect(result.current.isCommentDrawerOpen).toBe(true);
    expect(result.current.shouldRenderCommentDrawer).toBe(true);
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-240px');

    unmount();

    expect(document.body.style.position).toBe('');
    expect(scrollToSpy).toHaveBeenCalledWith(0, 240);
  });

  it('toggles the manual drawer and closes it on mobile left-edge right swipe', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);

    const { result } = renderHook((props) => useLyricsOverlayComments(props), {
      initialProps: createBaseProps({
        isLyricsOpen: true,
        isMobileViewport: () => true,
        openCommentRequestId: 0,
        openCommentRequestMode: 'overlay'
      })
    });

    expect(result.current.isCommentDrawerOpen).toBe(false);

    act(() => {
      result.current.toggleCommentDrawer();
    });

    expect(result.current.isCommentDrawerOpen).toBe(true);
    expect(result.current.shouldRenderCommentDrawer).toBe(true);

    act(() => {
      result.current.handleCommentDrawerTouchStart({
        touches: [{ clientX: 0, clientY: 20 }]
      });
    });

    nowSpy.mockReturnValue(1100);
    act(() => {
      result.current.handleCommentDrawerTouchEnd({
        changedTouches: [{ clientX: 120, clientY: 32 }]
      });
    });

    expect(result.current.isCommentDrawerOpen).toBe(false);

    act(() => {
      result.current.toggleCommentDrawer();
    });

    expect(result.current.isCommentDrawerOpen).toBe(true);

    nowSpy.mockReturnValue(2000);
    act(() => {
      result.current.handleCommentDrawerTouchStart({
        touches: [{ clientX: 120, clientY: 20 }]
      });
    });

    nowSpy.mockReturnValue(2100);
    act(() => {
      result.current.handleCommentDrawerTouchEnd({
        changedTouches: [{ clientX: 240, clientY: 32 }]
      });
    });

    expect(result.current.isCommentDrawerOpen).toBe(true);
  });
});
