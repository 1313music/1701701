import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlayerBar from './PlayerBar';

const defaultProps = {
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
  trackNameRef: { current: null }
};

describe('PlayerBar', () => {
  it('shows current time and total duration while hovering the desktop progress bar', () => {
    const { container } = render(<PlayerBar {...defaultProps} />);
    const progressContainer = container.querySelector('.progress-container');

    expect(progressContainer).not.toBeNull();

    fireEvent.mouseEnter(progressContainer);

    expect(screen.getByText('01:02 / 02:22')).toBeInTheDocument();
  });
});
