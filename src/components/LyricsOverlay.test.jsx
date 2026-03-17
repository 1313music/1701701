import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LyricsOverlay from './LyricsOverlay.jsx';

vi.mock('./CommentSection.jsx', () => ({
  default: ({ path }) => (
    <div>
      <div data-testid="comment-path">{path}</div>
    </div>
  )
}));

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

const createAudioRef = () => ({
  current: {
    currentTime: 0
  }
});

const createBaseProps = (overrides = {}) => ({
  isLyricsOpen: false,
  setIsLyricsOpen: vi.fn(),
  currentTrack: {
    name: '测试歌曲',
    src: 'https://example.com/song.mp3',
    cover: 'https://example.com/song.jpg'
  },
  currentAlbum: {
    id: 'album-1',
    name: '专辑',
    artist: '歌手',
    cover: 'https://example.com/album.jpg'
  },
  currentSongInfo: {
    album: {
      id: 'album-1'
    },
    song: {
      id: 'song-1'
    }
  },
  isPlaying: false,
  handlePlayPause: vi.fn(),
  progress: 0,
  currentTime: 0,
  duration: 180,
  lyrics: [],
  currentLyricIndex: 0,
  handleSeek: vi.fn(),
  togglePlayMode: vi.fn(),
  getPlayModeIcon: () => <span>mode</span>,
  handlePrev: vi.fn(),
  handleNext: vi.fn(),
  audioRef: createAudioRef(),
  setIsAlbumListOpen: vi.fn(),
  commentServerURL: 'https://comments.example.com',
  onAddToFavorites: vi.fn(),
  onShare: vi.fn(),
  isCurrentTrackFavorited: false,
  onToggleFavorite: vi.fn(),
  lyricsOverlaySessionId: 3,
  playerOverlayContextId: 9,
  trackChangeId: 12,
  openCommentRequestId: 1,
  openCommentRequestTrackSrc: 'https://example.com/song.mp3',
  openCommentRequestMode: 'standalone',
  openCommentRequestOverlaySessionId: 3,
  openCommentRequestTrackChangeId: 12,
  openCommentRequestViewContextId: 9,
  ...overrides
});

describe('LyricsOverlay comment drawer requests', () => {
  let originalInnerWidth;
  let originalResizeObserver;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth
    });
    globalThis.ResizeObserver = originalResizeObserver;
    vi.clearAllMocks();
  });

  it('opens the standalone comment drawer for matching desktop requests', () => {
    render(<LyricsOverlay {...createBaseProps()} />);

    expect(screen.getByText('单曲评论')).toBeInTheDocument();
    expect(screen.getByTestId('comment-path')).toHaveTextContent(
      'song:album-1:song-1'
    );
  });

  it('closes the mobile overlay when swiping down', () => {
    const props = createBaseProps({
      isLyricsOpen: true,
      openCommentRequestId: 0
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390
    });

    render(<LyricsOverlay {...props} />);
    const overlay = document.body.querySelector('.lyrics-overlay');

    fireEvent.touchStart(overlay, {
      touches: [{ clientX: 120, clientY: 100 }]
    });
    fireEvent.touchEnd(overlay, {
      changedTouches: [{ clientX: 122, clientY: 220 }]
    });

    expect(props.setIsLyricsOpen).toHaveBeenCalledWith(false);
  });

  it('opens and closes the mobile comment drawer from the floating action button', async () => {
    const props = createBaseProps({
      isLyricsOpen: true,
      openCommentRequestId: 0
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390
    });

    render(<LyricsOverlay {...props} />);

    fireEvent.click(document.body.querySelector('.overlay-comment-trigger.mobile-fab'));

    expect(screen.getByText('单曲评论')).toBeInTheDocument();
    expect(screen.getByTestId('comment-path')).toHaveTextContent(
      'song:album-1:song-1'
    );

    fireEvent.click(screen.getByRole('button', { name: '关闭评论抽屉' }));

    await waitFor(() => {
      expect(screen.queryByText('单曲评论')).not.toBeInTheDocument();
    });
  });

  it('updates playback position when dragging the mobile progress bar', () => {
    const props = createBaseProps({
      isLyricsOpen: true,
      openCommentRequestId: 0
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390
    });

    render(<LyricsOverlay {...props} />);
    const progressBar = document.body.querySelector('.mobile-progress-bar');
    progressBar.getBoundingClientRect = () => ({
      left: 0,
      width: 100
    });

    fireEvent.pointerDown(progressBar, { clientX: 25 });
    expect(props.audioRef.current.currentTime).toBe(45);
  });
});
