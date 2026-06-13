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
  currentLyricText: '',
  sleepTimerRemainingMs: 0,
  onStartSleepTimer: vi.fn(),
  onCancelSleepTimer: vi.fn(),
  volume: 1,
  isMuted: false,
  onVolumeChange: vi.fn(),
  onToggleMuted: vi.fn(),
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

  it('previews the pointed seek time while hovering the desktop progress bar', () => {
    const props = createProps();
    const { container } = render(<PlayerBar {...props} />);
    const progressContainer = container.querySelector('.progress-container');
    progressContainer.getBoundingClientRect = () => ({
      left: 10,
      width: 200
    });

    fireEvent.mouseEnter(progressContainer, { clientX: 110 });

    expect(screen.getByText('01:11 / 02:22')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: '打开播放列表' }));

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
    expect(screen.getByRole('button', { name: '打开播放列表' })).toBeInTheDocument();
  });

  it('wires favorite, comment, and share actions to callbacks', () => {
    const props = createProps();
    const { container } = render(<PlayerBar {...props} />);
    const playerInfo = container.querySelector('.player-info');
    const playerActions = container.querySelector('.player-actions');

    expect(playerInfo.querySelector('.favorite-btn')).toBeInTheDocument();
    expect(playerActions.querySelector('.favorite-btn')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '收藏当前歌曲' }));
    fireEvent.click(screen.getByRole('button', { name: '查看当前歌曲评论' }));
    fireEvent.click(screen.getByRole('button', { name: '分享当前歌曲' }));

    expect(props.onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(props.onToggleFavorite.mock.calls[0][0]).toEqual(props.currentTrack);
    expect(props.onOpenComments).toHaveBeenCalledTimes(1);
    expect(props.onShare).toHaveBeenCalledTimes(1);
  });

  it('wires desktop volume controls without opening the full-screen player', () => {
    const props = createProps({ volume: 0.5 });
    render(<PlayerBar {...props} />);
    const volumeSlider = screen.getByRole('slider', { name: '音量' });
    volumeSlider.getBoundingClientRect = () => ({
      bottom: 110,
      height: 100,
      left: 0,
      right: 28,
      top: 10,
      width: 28,
      x: 0,
      y: 10,
      toJSON: () => {}
    });

    fireEvent.click(screen.getByRole('button', { name: '静音，当前音量 50%' }));
    fireEvent.pointerDown(volumeSlider, {
      clientY: 75,
      pointerId: 1
    });

    expect(props.onToggleMuted).toHaveBeenCalledTimes(1);
    expect(props.onVolumeChange).toHaveBeenCalledWith(0.35);
    expect(props.setIsLyricsOpen).not.toHaveBeenCalled();
  });

  it('renders marquee text when the track name overflows during playback', () => {
    const props = createProps({
      isPlaying: true,
      isTrackNameOverflowing: true
    });
    const { container } = render(<PlayerBar {...props} />);

    expect(container.querySelector('.scrolling-text')).toHaveTextContent('Test Song | Test Song');
  });

  it('marks the player and mini cover as playing while audio is active', () => {
    const props = createProps({ isPlaying: true });
    const { container } = render(<PlayerBar {...props} />);

    expect(container.querySelector('.player-bar')).toHaveClass('is-playing');
    expect(container.querySelector('.mini-cover')).toHaveClass('is-playing');
  });

  it('renders the mobile lyric subtitle when current lyric text is available', () => {
    const props = createProps({ currentLyricText: 'Current lyric line' });
    const { container } = render(<PlayerBar {...props} />);

    expect(container.querySelector('.artist-name')).toHaveTextContent('Test Artist');
    expect(container.querySelector('.mobile-current-lyric')).toHaveTextContent('Current lyric line');
  });

  it('falls back to artist text for the mobile subtitle when lyrics are unavailable', () => {
    const props = createProps();
    const { container } = render(<PlayerBar {...props} />);

    expect(container.querySelector('.mobile-current-lyric')).toHaveTextContent('Test Artist');
  });

  it('opens sleep timer presets without opening the full-screen player', () => {
    const props = createProps();
    render(<PlayerBar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: '设置定时关闭' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '30 分钟' }));

    expect(props.onStartSleepTimer).toHaveBeenCalledWith(30);
    expect(props.setIsLyricsOpen).not.toHaveBeenCalled();
  });

  it('shows and cancels an active sleep timer', () => {
    const props = createProps({ sleepTimerRemainingMs: 65_000 });
    render(<PlayerBar {...props} />);

    expect(screen.getByRole('button', { name: '定时关闭剩余 1:05' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '定时关闭剩余 1:05' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '取消定时' }));

    expect(props.onCancelSleepTimer).toHaveBeenCalledTimes(1);
    expect(props.setIsLyricsOpen).not.toHaveBeenCalled();
  });

  it('starts a custom sleep timer from the timer menu', () => {
    const props = createProps();
    render(<PlayerBar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: '设置定时关闭' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: '自定义定时分钟' }), {
      target: { value: '23' }
    });
    fireEvent.click(screen.getByRole('button', { name: '开始' }));

    expect(props.onStartSleepTimer).toHaveBeenCalledWith(23);
    expect(props.setIsLyricsOpen).not.toHaveBeenCalled();
  });
});
