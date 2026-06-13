import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AlbumGrid from './AlbumGrid.jsx';

vi.mock('../utils/coverAtmosphere.js', () => ({
  buildCoverAtmosphereAssets: vi.fn().mockResolvedValue(null)
}));

const createLongAlbum = (count = 30) => ({
  id: 'long-album',
  name: '长歌单',
  artist: '李志',
  cover: '/img/test-cover.jpg',
  songs: Array.from({ length: count }, (_, index) => ({
    src: `song-${index + 1}.mp3`,
    name: `歌曲 ${index + 1}`
  }))
});

const createBaseProps = (overrides = {}) => {
  const album = createLongAlbum();
  return {
    musicAlbums: [album],
    navigateToAlbum: vi.fn(),
    expandedAlbumId: album.id,
    currentTrack: { src: '' },
    isPlaying: false,
    playSongFromAlbum: vi.fn(),
    tempPlaylistSet: new Set(),
    onToggleTempSong: vi.fn(),
    onToggleAlbumFavorites: vi.fn(),
    ...overrides
  };
};

describe('AlbumGrid inline album panel', () => {
  const originalMatchMedia = window.matchMedia;
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    window.matchMedia = vi.fn(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    globalThis.ResizeObserver = originalResizeObserver;
    vi.restoreAllMocks();
  });

  it('previews long album song lists before expanding all songs', () => {
    render(<AlbumGrid {...createBaseProps()} />);

    expect(document.body.querySelectorAll('.album-inline-panel .song-item')).toHaveLength(25);

    fireEvent.click(screen.getByRole('button', { name: '查看全部 30 首' }));

    expect(document.body.querySelectorAll('.album-inline-panel .song-item')).toHaveLength(30);
    expect(screen.getByRole('button', { name: '收起到前 25 首' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });
});
