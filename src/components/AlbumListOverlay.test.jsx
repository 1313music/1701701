import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    AnimatePresence: ({ children }) => <>{children}</>
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

  it('still switches tabs on click', async () => {
    render(<AlbumListOverlay {...createBaseProps()} />);

    const albumTab = screen.getByRole('tab', { name: '当前专辑' });
    const favoritesTab = screen.getByRole('tab', { name: '我的收藏' });

    expect(albumTab).toHaveAttribute('aria-selected', 'true');
    expect(favoritesTab).toHaveAttribute('aria-selected', 'false');

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '当前专辑' })).toHaveAttribute('aria-selected', 'true');
    });

    fireEvent.click(screen.getByRole('tab', { name: '我的收藏' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '当前专辑' })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('tab', { name: '我的收藏' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('does not switch tabs on horizontal swipe anymore', () => {
    const props = createBaseProps();
    render(<AlbumListOverlay {...props} />);

    const panel = document.body.querySelector('.album-list-panel');
    const albumTab = screen.getByRole('tab', { name: '当前专辑' });
    const favoritesTab = screen.getByRole('tab', { name: '我的收藏' });

    fireEvent.touchStart(panel, {
      touches: [{ clientX: 220, clientY: 180 }]
    });
    fireEvent.touchEnd(panel, {
      changedTouches: [{ clientX: 40, clientY: 186 }]
    });

    expect(albumTab).toHaveAttribute('aria-selected', 'true');
    expect(favoritesTab).toHaveAttribute('aria-selected', 'false');
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
});
