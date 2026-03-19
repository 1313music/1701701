import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PlayerBar from './PlayerBar';

const createProps = (overrides = {}) => ({
  currentTrack: { name: 'Test Song', cover: null, src: 'song.mp3' },
  currentAlbum: { artist: 'Test Artist', cover: null },
  isPlaying: false,
  handlePlayPause: vi.fn(),
  progress: 43.66,
  currentTime: 62,
  duration: 142,
  handleSeek: vi.fn(),
  togglePlayMode: vi.fn(),
  getPlayModeIcon: () => <span>mode</span>,
  handlePrev: vi.fn(),
  handleNext: vi.fn(),
  setIsLyricsOpen: vi.fn(),
  setIsAlbumListOpen: vi.fn(),
  onToggleFavorite: vi.fn(),
  isCurrentTrackFavorited: false,
  onOpenComments: vi.fn(),
  onShare: vi.fn(),
  isTrackNameOverflowing: false,
  trackNameRef: { current: null },
  ...overrides
});

describe('PlayerBar', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows current time and total duration while hovering the desktop progress bar', () => {
    const props = createProps();
    const { container } = render(<PlayerBar {...props} />);
    const progressContainer = container.querySelector('.progress-container');

    expect(progressContainer).not.toBeNull();

    fireEvent.mouseEnter(progressContainer);

    expect(screen.getByText('01:02 / 02:22')).toBeInTheDocument();
  });

  it('opens the full-screen player from the footer and expand button', () => {
    const props = createProps();
    const { container } = render(<PlayerBar {...props} />);

    fireEvent.click(container.querySelector('.player-bar'));
    fireEvent.click(screen.getByRole('button', { name: '展开全屏播放器' }));

    expect(props.setIsLyricsOpen).toHaveBeenNthCalledWith(1, true);
    expect(props.setIsLyricsOpen).toHaveBeenNthCalledWith(2, true);
  });

  it('routes playback controls without reopening the full-screen player', () => {
    const props = createProps();
    render(<PlayerBar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: '切换播放模式' }));
    fireEvent.click(screen.getByRole('button', { name: '上一首' }));
    fireEvent.click(screen.getByRole('button', { name: '播放' }));
    fireEvent.click(screen.getByRole('button', { name: '下一首' }));
    fireEvent.click(screen.getByRole('button', { name: '打开收藏歌单' }));

    expect(props.togglePlayMode).toHaveBeenCalledTimes(1);
    expect(props.handlePrev).toHaveBeenCalledTimes(1);
    expect(props.handlePlayPause).toHaveBeenCalledTimes(1);
    expect(props.handleNext).toHaveBeenCalledTimes(1);
    expect(props.setIsAlbumListOpen).toHaveBeenCalledWith(true);
    expect(props.setIsLyricsOpen).not.toHaveBeenCalled();
  });

  it('exposes playback controls as keyboard-reachable buttons', () => {
    const props = createProps();
    render(<PlayerBar {...props} />);

    expect(screen.getByRole('button', { name: '切换播放模式' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上一首' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '播放' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一首' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开收藏歌单' })).toBeInTheDocument();
  });

  it('wires favorite, comment, and share actions to callbacks', () => {
    const props = createProps();
    render(<PlayerBar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: '收藏当前歌曲' }));
    fireEvent.click(screen.getByRole('button', { name: '查看当前歌曲评论' }));
    fireEvent.click(screen.getByRole('button', { name: '分享当前歌曲' }));

    expect(props.onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(props.onToggleFavorite.mock.calls[0][0]).toEqual(props.currentTrack);
    expect(props.onOpenComments).toHaveBeenCalledTimes(1);
    expect(props.onShare).toHaveBeenCalledTimes(1);
  });

  it('renders marquee text when the track name overflows during playback', () => {
    const props = createProps({
      isPlaying: true,
      isTrackNameOverflowing: true
    });
    const { container } = render(<PlayerBar {...props} />);

    expect(container.querySelector('.scrolling-text')).toHaveTextContent('Test Song | Test Song');
  });
});
