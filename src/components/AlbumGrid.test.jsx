import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AlbumGrid from './AlbumGrid.jsx';
import { buildCoverAtmosphereAssets } from '../utils/coverAtmosphere.js';

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

const createRandomMixAlbum = () => ({
  id: 'random-mix',
  name: '随便听',
  artist: '随机歌单',
  cover: '/img/random-cover.jpg',
  coverGrid: [
    '/img/source-cover-1.jpg',
    '/img/source-cover-2.jpg',
    '/img/source-cover-3.jpg',
    '/img/source-cover-4.jpg'
  ],
  isVirtual: true,
  sourceAlbumCount: 2,
  virtualType: 'random-mix',
  songs: [
    {
      src: 'random-1.mp3',
      name: '随机歌曲一',
      cover: '/img/random-song-1.jpg',
      sourceAlbumName: '来源专辑一'
    },
    {
      src: 'random-2.mp3',
      name: '随机歌曲二',
      cover: '/img/random-song-2.jpg',
      sourceAlbumName: '来源专辑二'
    }
  ]
});

const createAllSiteAlbum = () => ({
  id: 'all-site-shuffle',
  name: '随机全站',
  artist: '全站随机',
  cover: '/img/all-site-cover.jpg',
  coverGrid: [
    '/img/all-cover-1.jpg',
    '/img/all-cover-2.jpg',
    '/img/all-cover-3.jpg',
    '/img/all-cover-4.jpg'
  ],
  isVirtual: true,
  sourceAlbumCount: 3,
  virtualType: 'all-site-shuffle',
  songs: [
    {
      src: 'all-site-1.mp3',
      name: '全站歌曲一',
      cover: '/img/all-site-song-1.jpg',
      sourceAlbumName: '来源专辑一'
    },
    {
      src: 'all-site-2.mp3',
      name: '全站歌曲二',
      cover: '/img/all-site-song-2.jpg',
      sourceAlbumName: '来源专辑二'
    },
    {
      src: 'all-site-3.mp3',
      name: '全站歌曲三',
      cover: '/img/all-site-song-3.jpg',
      sourceAlbumName: '来源专辑三'
    }
  ]
});

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

  it('renders long album song lists without expand controls', async () => {
    render(<AlbumGrid {...createBaseProps()} />);

    await waitFor(() => {
      expect(document.body.querySelectorAll('.album-inline-panel .song-item')).toHaveLength(30);
    });

    expect(document.body.querySelector('.song-list-shell')).toHaveClass('is-long-list');
    expect(screen.queryByRole('button', { name: '查看全部 30 首' })).not.toBeInTheDocument();
    expect(document.body.querySelector('.song-list-more-btn')).not.toBeInTheDocument();
    expect(document.body.querySelector('.song-source-cover')).not.toBeInTheDocument();
  });

  it('leaves regular-length album song lists unconstrained', async () => {
    const shortAlbum = createLongAlbum(14);
    render(<AlbumGrid {...createBaseProps({ musicAlbums: [shortAlbum] })} />);

    await waitFor(() => {
      expect(document.body.querySelectorAll('.album-inline-panel .song-item')).toHaveLength(14);
    });

    expect(document.body.querySelector('.song-list-shell')).not.toHaveClass('is-long-list');
  });

  it('keeps cached cover atmosphere visible after queued timers run', async () => {
    const palette = {
      accent: '178, 0, 0',
      glow: '206, 28, 24',
      shadow: '58, 0, 0'
    };
    vi.mocked(buildCoverAtmosphereAssets).mockResolvedValueOnce({ palette, topCover: '' });
    vi.useFakeTimers();

    try {
      render(<AlbumGrid {...createBaseProps()} />);

      await act(async () => {
        await Promise.resolve();
      });

      const panel = document.body.querySelector('.album-inline-panel');
      expect(panel).toHaveClass('has-cover-atmosphere');

      await act(async () => {
        vi.runOnlyPendingTimers();
        await Promise.resolve();
      });

      expect(panel).toHaveClass('has-cover-atmosphere');
    } finally {
      vi.useRealTimers();
    }
  });

  it('adds random mix details and refresh control for virtual albums', async () => {
    const randomAlbum = createRandomMixAlbum();
    const onRefreshRandomMix = vi.fn();
    const onPlayAllSiteShuffle = vi.fn();
    const onPlayAllSiteSequential = vi.fn();
    const playSongFromAlbum = vi.fn();
    render(
      <AlbumGrid
        {...createBaseProps({
          musicAlbums: [randomAlbum],
          expandedAlbumId: randomAlbum.id,
          onRefreshRandomMix,
          onPlayAllSiteShuffle,
          onPlayAllSiteSequential,
          playSongFromAlbum
        })}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('来自 2 张专辑 · 2 首')).toBeInTheDocument();
    });

    expect(screen.getAllByRole('img', { name: '随便听' })).toHaveLength(2);
    expect(document.body.querySelectorAll('.album-inline-panel .song-source-cover')).toHaveLength(2);
    expect(screen.getByText('来源专辑一')).toBeInTheDocument();
    expect(screen.getByText('来源专辑二')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '播放这批' }));
    expect(playSongFromAlbum).toHaveBeenCalledWith(randomAlbum, randomAlbum.songs[0]);

    fireEvent.click(screen.getByRole('button', { name: '换一批' }));
    expect(onRefreshRandomMix).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '随机全站' }));
    expect(onPlayAllSiteShuffle).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '顺序全站' }));
    expect(onPlayAllSiteSequential).toHaveBeenCalledTimes(1);
  });

  it('renders an all-site virtual override in the current panel', async () => {
    const randomAlbum = createRandomMixAlbum();
    const allSiteAlbum = createAllSiteAlbum();
    const navigateToAlbum = vi.fn();
    render(
      <AlbumGrid
        {...createBaseProps({
          musicAlbums: [randomAlbum],
          panelAlbumOverride: allSiteAlbum,
          expandedAlbumId: randomAlbum.id,
          navigateToAlbum
        })}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '随机全站' })).toBeInTheDocument();
    });

    expect(screen.getByText('来自 3 张专辑 · 3 首')).toBeInTheDocument();
    expect(document.body.querySelectorAll('.album-inline-panel .song-item')).toHaveLength(3);
    expect(document.body.querySelectorAll('.album-inline-panel .song-source-cover')).toHaveLength(3);
    expect(screen.getAllByText('全站歌曲三').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '播放全部' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '换一批' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '随机全站' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '顺序全站' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '收起' }));
    expect(navigateToAlbum).toHaveBeenCalledWith(randomAlbum);
  });
});
