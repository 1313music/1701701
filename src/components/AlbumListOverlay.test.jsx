import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAlbumListPanelMotionProps } from '../utils/albumListMotion.js';
import AlbumListOverlay from './AlbumListOverlay.jsx';

vi.mock('framer-motion', () => {
  const ReactModule = React;
  const motion = new Proxy({}, {
    get: (_, tag) => ReactModule.forwardRef(({ children, ...props }, ref) => (
      ReactModule.createElement(tag, { ...props, ref }, children)
    ))
  });

  return {
    motion,
    AnimatePresence: ({ children }) => <>{children}</>,
    useReducedMotion: () => false
  };
});

const createBaseProps = (overrides = {}) => ({
  isOpen: true,
  onClose: vi.fn(),
  album: {
    id: 'album-1',
    name: '测试专辑',
    songs: [
      { src: 'song-1.mp3', name: '歌曲一' },
      { src: 'song-2.mp3', name: '歌曲二' }
    ]
  },
  currentTrack: {
    src: 'song-1.mp3'
  },
  isPlaying: false,
  playSongFromAlbum: vi.fn(),
  tempPlaylistSet: new Set(['fav-1.mp3']),
  tempPlaylistCount: 1,
  tempPlaylistItems: [
    {
      song: { src: 'fav-1.mp3', name: '收藏歌曲' },
      album: { name: '收藏专辑' }
    }
  ],
  onToggleTempSong: vi.fn(),
  onToggleAlbumFavorites: vi.fn(),
  onClearTempPlaylist: vi.fn(),
  onPlayFavorites: vi.fn(),
  ...overrides
});

describe('AlbumListOverlay motion', () => {
  it('uses a visible desktop pop-in animation instead of an opacity-only fade', () => {
    const motionProps = getAlbumListPanelMotionProps({
      isMobile: false,
      shouldReduceMotion: false
    });

    expect(motionProps.initial).toMatchObject({
      opacity: 0,
      y: 24,
      scale: 0.965
    });
    expect(motionProps.animate).toMatchObject({
      opacity: 1,
      y: 0,
      scale: 1
    });
    expect(motionProps.exit).toMatchObject({
      opacity: 0,
      y: 16,
      scale: 0.982
    });
    expect(motionProps.transition).toMatchObject({ type: 'spring' });
    expect(motionProps.style).toEqual({ transformOrigin: 'center center' });
  });

  it('slides up from the bottom on mobile', () => {
    const motionProps = getAlbumListPanelMotionProps({
      isMobile: true,
      shouldReduceMotion: false
    });

    expect(motionProps.initial).toMatchObject({
      opacity: 0,
      y: 48,
      scale: 0.985
    });
    expect(motionProps.exit).toMatchObject({
      opacity: 0,
      y: 34,
      scale: 0.992
    });
    expect(motionProps.style).toEqual({ transformOrigin: 'center bottom' });
  });

  it('removes transform movement when reduced motion is requested', () => {
    const motionProps = getAlbumListPanelMotionProps({
      isMobile: false,
      shouldReduceMotion: true
    });

    expect(motionProps.initial).toEqual({ opacity: 0 });
    expect(motionProps.animate).toEqual({ opacity: 1 });
    expect(motionProps.exit).toEqual({ opacity: 0 });
    expect(motionProps.transition).toMatchObject({ duration: 0.12 });
  });
});

describe('AlbumListOverlay mobile gestures', () => {
  let originalInnerWidth;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth
    });
    vi.restoreAllMocks();
  });

  it('renders only the current album list with inline favorite controls', async () => {
    render(<AlbumListOverlay {...createBaseProps()} />);

    await waitFor(() => {
      expect(screen.getAllByText('测试专辑 · 2 首').length).toBeGreaterThan(0);
    });

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText('我的收藏')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '播放收藏' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '播放全部' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '收藏全部' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '收藏' }).length).toBeGreaterThan(0);
  });

  it('ignores non-edge horizontal swipes', () => {
    const props = createBaseProps();
    render(<AlbumListOverlay {...props} />);

    const panel = document.body.querySelector('.album-list-panel');

    fireEvent.touchStart(panel, {
      touches: [{ clientX: 220, clientY: 180 }]
    });
    fireEvent.touchEnd(panel, {
      changedTouches: [{ clientX: 40, clientY: 186 }]
    });

    expect(screen.getAllByText('测试专辑 · 2 首').length).toBeGreaterThan(0);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('closes on a right swipe from the left edge', () => {
    const props = createBaseProps();
    render(<AlbumListOverlay {...props} />);

    const panel = document.body.querySelector('.album-list-panel');

    fireEvent.touchStart(panel, {
      touches: [{ clientX: 18, clientY: 200 }]
    });
    fireEvent.touchEnd(panel, {
      changedTouches: [{ clientX: 156, clientY: 206 }]
    });

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a downward swipe from the sheet handle area', () => {
    const props = createBaseProps();
    render(<AlbumListOverlay {...props} />);

    const handle = document.body.querySelector('.album-list-drag-handle');

    fireEvent.touchStart(handle, {
      touches: [{ clientX: 190, clientY: 24 }]
    });
    fireEvent.touchEnd(handle, {
      changedTouches: [{ clientX: 194, clientY: 148 }]
    });

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
