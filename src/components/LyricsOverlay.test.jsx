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
  sleepTimerRemainingMs: 0,
  onStartSleepTimer: vi.fn(),
  onCancelSleepTimer: vi.fn(),
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

  it('closes the mobile overlay when swiping right from the left edge', () => {
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
      touches: [{ clientX: 24, clientY: 160 }]
    });
    fireEvent.touchEnd(overlay, {
      changedTouches: [{ clientX: 150, clientY: 164 }]
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

    fireEvent.click(document.body.querySelector('.overlay-comment-trigger.mobile-action-btn'));

    expect(screen.getByText('单曲评论')).toBeInTheDocument();
    expect(screen.getByTestId('comment-path')).toHaveTextContent(
      'song:album-1:song-1'
    );

    fireEvent.click(screen.getByRole('button', { name: '关闭评论抽屉' }));

    await waitFor(() => {
      expect(screen.queryByText('单曲评论')).not.toBeInTheDocument();
    });
  });

  it('closes the mobile comment drawer when swiping right from the left edge', async () => {
    const props = createBaseProps({
      isLyricsOpen: true,
      openCommentRequestId: 0
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390
    });

    render(<LyricsOverlay {...props} />);

    fireEvent.click(document.body.querySelector('.overlay-comment-trigger.mobile-action-btn'));
    expect(screen.getByText('单曲评论')).toBeInTheDocument();

    const edgeZone = document.body.querySelector('.song-comment-edge-swipe-zone');

    fireEvent.touchStart(edgeZone, {
      touches: [{ clientX: 18, clientY: 220 }]
    });
    fireEvent.touchEnd(edgeZone, {
      changedTouches: [{ clientX: 148, clientY: 226 }]
    });

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

  it('puts the sleep timer in the mobile action row and supports custom minutes', () => {
    const props = createBaseProps({
      isLyricsOpen: true,
      openCommentRequestId: 0
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390
    });

    render(<LyricsOverlay {...props} />);

    expect(document.body.querySelector('.mobile-player-actions .mobile-sleep-timer-control')).toBeInTheDocument();
    expect(document.body.querySelector('.overlay-comment-trigger.mobile-fab')).not.toBeInTheDocument();
    expect(document.body.querySelector('.mobile-player-actions .sleep-timer-idle-label')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '设置定时关闭' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: '自定义定时分钟' }), {
      target: { value: '35' }
    });
    fireEvent.click(screen.getByRole('button', { name: '开始' }));

    expect(props.onStartSleepTimer).toHaveBeenCalledWith(35);
  });

  it('renders desktop playback controls as accessible buttons', () => {
    const props = createBaseProps({
      isLyricsOpen: true,
      openCommentRequestId: 0
    });

    render(<LyricsOverlay {...props} />);

    expect(screen.getByRole('button', { name: '切换播放模式' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上一首' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '播放' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一首' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开歌曲列表' })).toBeInTheDocument();
  });

  it('previews the pointed seek time while hovering the desktop progress bar', () => {
    const props = createBaseProps({
      isLyricsOpen: true,
      openCommentRequestId: 0
    });

    render(<LyricsOverlay {...props} />);
    const progressBar = document.body.querySelector('.overlay-progress-container');
    progressBar.getBoundingClientRect = () => ({
      left: 10,
      width: 200
    });

    fireEvent.mouseEnter(progressBar, { clientX: 110 });

    expect(screen.getByText('1:30 / 3:00')).toBeInTheDocument();
  });
});
