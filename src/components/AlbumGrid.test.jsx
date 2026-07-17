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
    onClearTempPlaylist: vi.fn(),
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

const createFavoritesAlbum = ({ songs = [], cover = '', coverGrid = [] } = {}) => ({
  id: 'favorites',
  name: '我的收藏',
  artist: '我的收藏',
  cover,
  coverGrid,
  isVirtual: true,
  sourceAlbumCount: 0,
  virtualType: 'favorites',
  songs
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
    expect(document.body.querySelector('.album-inline-shell')).toHaveStyle({
      '--inline-song-scroll-visible-count': '12',
      '--inline-song-row-height': '52px',
      '--inline-song-list-max-height': '624px'
    });
    expect(screen.queryByRole('button', { name: '查看全部 30 首' })).not.toBeInTheDocument();
    expect(document.body.querySelector('.song-list-more-btn')).not.toBeInTheDocument();
    expect(document.body.querySelector('.song-source-cover')).not.toBeInTheDocument();
  });

  it('sizes constrained song lists from the measured row height', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getBoundingClientRect() {
      const height = this.classList?.contains('song-item') ? 57 : 0;
      return {
        x: 0,
        y: 0,
        top: 0,
        right: 0,
        bottom: height,
        left: 0,
        width: 0,
        height,
        toJSON: () => ({})
      };
    });

    render(<AlbumGrid {...createBaseProps()} />);

    await waitFor(() => {
      expect(document.body.querySelector('.album-inline-shell')).toHaveStyle({
        '--inline-song-scroll-visible-count': '12',
        '--inline-song-row-height': '57px',
        '--inline-song-list-max-height': '684px'
      });
    });
  });

  it('expands the song viewport to match a taller desktop album header', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getBoundingClientRect() {
      const height = this.classList?.contains('album-inline-header')
        ? 760
        : this.classList?.contains('song-item')
          ? 52
          : 0;
      return {
        x: 0,
        y: 0,
        top: 0,
        right: 0,
        bottom: height,
        left: 0,
        width: 0,
        height,
        toJSON: () => ({})
      };
    });
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((node) => {
      if (node.classList?.contains('album-inline-panel')) return { display: 'grid' };
      if (node.classList?.contains('song-list-shell')) return { marginTop: '4px' };
      return originalGetComputedStyle(node);
    });

    render(<AlbumGrid {...createBaseProps()} />);

    await waitFor(() => {
      expect(document.body.querySelector('.album-inline-shell')).toHaveStyle({
        '--inline-song-list-max-height': '756px'
      });
    });
  });

  it('leaves regular-length album song lists unconstrained', async () => {
    const shortAlbum = createLongAlbum(12);
    render(<AlbumGrid {...createBaseProps({ musicAlbums: [shortAlbum] })} />);

    await waitFor(() => {
      expect(document.body.querySelectorAll('.album-inline-panel .song-item')).toHaveLength(12);
    });

    expect(document.body.querySelector('.song-list-shell')).not.toHaveClass('is-long-list');
  });

  it('shows release information above the unchanged album actions', async () => {
    const album = {
      ...createLongAlbum(8),
      id: '1701',
      name: '1701'
    };
    render(<AlbumGrid {...createBaseProps({ musicAlbums: [album], expandedAlbumId: album.id })} />);

    await waitFor(() => {
      expect(screen.getByText('2014.05.22 发行')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('1701专辑资料')).toBeInTheDocument();
    expect(screen.getByText(/专辑名取自好友的排练房房号\s+李志第七张录音室创作专辑/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '来源：维基百科' })).toHaveAttribute(
      'href',
      'https://zh.wikipedia.org/wiki/%E6%9D%8E%E5%BF%97'
    );
    expect(screen.queryByRole('button', { name: '展开' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '播放全部' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收藏全部' })).toBeInTheDocument();
  });

  it('keeps paired release dates on two stable lines without splitting 发行', async () => {
    const album = {
      ...createLongAlbum(24),
      id: 'volume2',
      name: 'Best Selection Songs 2004-2018 (Volume.2) Ballads（叙事歌）'
    };
    render(<AlbumGrid {...createBaseProps({ musicAlbums: [album], expandedAlbumId: album.id })} />);

    const releaseDate = await waitFor(() => document.body.querySelector('.album-inline-release-date'));

    expect(releaseDate).toHaveTextContent('2020.05.18（LP） / 2020.05.27（CD） 发行');
    expect(releaseDate.querySelectorAll('br')).toHaveLength(1);
  });

  it.each(['volume1', 'volume2', 'volume3', 'tokyo-live'])(
    'shows the existing external-site warning before purchasing %s',
    async (albumId) => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const album = {
        ...createLongAlbum(10),
        id: albumId,
        name: `可购买专辑 ${albumId}`
      };
      render(<AlbumGrid {...createBaseProps({ musicAlbums: [album], expandedAlbumId: album.id })} />);

      const purchaseButton = await screen.findByRole('button', { name: '购买专辑' });

      fireEvent.click(purchaseButton);

      expect(screen.getByRole('dialog', { name: '即将前往 tower.jp' })).toBeInTheDocument();
      expect(
        screen.getByText('该站点在国内网络可能无法正常访问，建议使用科学上网。是否继续？')
      ).toBeInTheDocument();
      expect(document.body.querySelector('.album-inline-hero-actions')).toHaveClass('has-purchase');

      fireEvent.click(screen.getByRole('button', { name: '确认跳转' }));

      expect(openSpy).toHaveBeenCalledWith(
        'https://tower.jp/search/item/%E6%9D%8E%E5%BF%97',
        '_blank',
        'noopener,noreferrer'
      );
      expect(screen.queryByRole('dialog', { name: '即将前往 tower.jp' })).not.toBeInTheDocument();
    }
  );

  it('does not show the purchase link for other albums', async () => {
    const album = {
      ...createLongAlbum(8),
      id: '1701',
      name: '1701'
    };
    render(<AlbumGrid {...createBaseProps({ musicAlbums: [album], expandedAlbumId: album.id })} />);

    await waitFor(() => {
      expect(screen.getByLabelText('1701专辑资料')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: '购买专辑' })).not.toBeInTheDocument();
  });

  it('collapses descriptions beyond five rendered lines and toggles the full copy', async () => {
    let profileResizeCallback;
    globalThis.ResizeObserver = class {
      constructor(callback) {
        this.callback = callback;
      }

      observe(node) {
        if (node.classList?.contains('album-inline-profile-copy')) {
          profileResizeCallback = this.callback;
        }
      }

      disconnect() {}
    };
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function scrollHeight() {
      if (!this.classList?.contains('album-inline-profile-copy')) return 0;
      return this.classList.contains('is-expanded') ? 20 : 120;
    });
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((node) => (
      node.classList?.contains('album-inline-profile-copy')
        ? { fontSize: '12px', lineHeight: '20px' }
        : originalGetComputedStyle(node)
    ));
    const album = {
      ...createLongAlbum(24),
      id: 'volume2',
      name: 'Best Selection Songs Volume.2'
    };
    render(<AlbumGrid {...createBaseProps({ musicAlbums: [album], expandedAlbumId: album.id })} />);

    const expandButton = await screen.findByRole('button', { name: '显示完整介绍' });
    const description = document.body.querySelector('.album-inline-profile-copy');

    expect(description).toHaveClass('is-clamped');
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(expandButton);

    act(() => profileResizeCallback?.());

    expect(description).toHaveClass('is-expanded');
    expect(description).not.toHaveClass('is-clamped');
    expect(screen.getByRole('button', { name: '折叠专辑介绍' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: '折叠专辑介绍' }));

    expect(description).toHaveClass('is-clamped');
  });

  it('shows descriptions of five lines or fewer without a toggle', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function scrollHeight() {
      return this.classList?.contains('album-inline-profile-copy') ? 100 : 0;
    });
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((node) => (
      node.classList?.contains('album-inline-profile-copy')
        ? { fontSize: '12px', lineHeight: '20px' }
        : originalGetComputedStyle(node)
    ));
    const album = {
      ...createLongAlbum(8),
      id: '1701',
      name: '1701'
    };
    render(<AlbumGrid {...createBaseProps({ musicAlbums: [album], expandedAlbumId: album.id })} />);

    await waitFor(() => {
      expect(screen.getByLabelText('1701专辑资料')).toBeInTheDocument();
    });

    expect(document.body.querySelector('.album-inline-profile-copy')).not.toHaveClass('is-clamped');
    expect(screen.queryByRole('button', { name: '显示完整介绍' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '折叠专辑介绍' })).not.toBeInTheDocument();
  });

  it('uses the responsive four-line limit when configured by CSS', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function scrollHeight() {
      return this.classList?.contains('album-inline-profile-copy') ? 100 : 0;
    });
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((node) => (
      node.classList?.contains('album-inline-profile-copy')
        ? {
            fontSize: '13px',
            lineHeight: '20px',
            getPropertyValue: (property) => (
              property === '--album-profile-collapsed-lines' ? '4' : ''
            )
          }
        : originalGetComputedStyle(node)
    ));
    const album = {
      ...createLongAlbum(8),
      id: '1701',
      name: '1701'
    };
    render(<AlbumGrid {...createBaseProps({ musicAlbums: [album], expandedAlbumId: album.id })} />);

    const expandButton = await screen.findByRole('button', { name: '显示完整介绍' });

    expect(document.body.querySelector('.album-inline-profile-copy')).toHaveClass('is-clamped');
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows official-site sources as text while keeping other external sources linked', async () => {
    const officialAlbum = {
      ...createLongAlbum(8),
      id: 'van-gogh',
      name: '梵高先生'
    };
    const mediaAlbum = {
      ...createLongAlbum(8),
      id: 'hangzhou-jiuqiuhui',
      name: '杭州酒球会'
    };
    const { rerender } = render(
      <AlbumGrid {...createBaseProps({ musicAlbums: [officialAlbum], expandedAlbumId: officialAlbum.id })} />
    );

    await waitFor(() => {
      expect(screen.getByText('来源：李志官网')).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: '来源：李志官网' })).not.toBeInTheDocument();

    rerender(
      <AlbumGrid {...createBaseProps({ musicAlbums: [mediaAlbum], expandedAlbumId: mediaAlbum.id })} />
    );

    expect(await screen.findByRole('link', { name: '来源：都市快报' })).toHaveAttribute(
      'href',
      'https://hznews.hangzhou.com.cn/wenti/content/2015-08/07/content_5875318.htm'
    );
  });

  it('shows the track-metadata 其他 collection note without a fake external link', async () => {
    const album = {
      ...createLongAlbum(8),
      id: 'other',
      name: '其他'
    };
    render(<AlbumGrid {...createBaseProps({ musicAlbums: [album], expandedAlbumId: album.id })} />);

    await waitFor(() => {
      expect(screen.getByText(/收录不同场合留下的现场与弹唱录音/)).toBeInTheDocument();
    });

    expect(screen.getByLabelText('其他专辑资料')).toBeInTheDocument();
    expect(document.body.querySelector('.album-inline-profile-meta')).toHaveTextContent('来源：曲目文件信息');
    expect(screen.queryByRole('link', { name: '来源：曲目文件信息' })).not.toBeInTheDocument();
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

  it('renders an empty favorites album with a disabled play action', async () => {
    const favoritesAlbum = createFavoritesAlbum();
    render(
      <AlbumGrid
        {...createBaseProps({
          musicAlbums: [favoritesAlbum],
          expandedAlbumId: favoritesAlbum.id
        })}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '我的收藏' })).toBeInTheDocument();
    });

    expect(screen.getAllByRole('img', { name: '我的收藏' })).toHaveLength(2);
    expect(screen.getByText('我的收藏 • 0 首歌')).toBeInTheDocument();
    expect(screen.getByText('收藏仅保存在当前设备。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '播放收藏' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '清空收藏' })).not.toBeInTheDocument();
    expect(screen.getByText('还没有收藏歌曲')).toBeInTheDocument();
  });

  it('keeps favorites metadata simple and confirms before clearing', async () => {
    const favoritesAlbum = createFavoritesAlbum({
      cover: '/img/favorite-1.jpg',
      coverGrid: ['/img/favorite-1.jpg', '/img/favorite-2.jpg', '/img/favorite-3.jpg'],
      songs: [
        {
          src: 'favorite-1.mp3',
          name: '收藏歌曲一',
          cover: '/img/favorite-1.jpg',
          sourceAlbumName: '来源专辑一'
        },
        {
          src: 'favorite-2.mp3',
          name: '收藏歌曲二',
          cover: '/img/favorite-2.jpg',
          sourceAlbumName: '来源专辑二'
        },
        {
          src: 'favorite-3.mp3',
          name: '收藏歌曲三',
          cover: '/img/favorite-3.jpg',
          sourceAlbumName: '来源专辑三'
        }
      ]
    });
    const onClearTempPlaylist = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(
      <AlbumGrid
        {...createBaseProps({
          musicAlbums: [favoritesAlbum],
          expandedAlbumId: favoritesAlbum.id,
          onClearTempPlaylist
        })}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '我的收藏' })).toBeInTheDocument();
    });

    expect(screen.getByText('我的收藏 • 3 首歌')).toBeInTheDocument();
    expect(screen.queryByText('来自 3 张专辑 · 3 首')).not.toBeInTheDocument();
    expect(document.body.querySelectorAll('.album-cover-collage.is-favorites-cover.is-count-4')).toHaveLength(2);
    expect(document.body.querySelectorAll('.album-cover-favorites-tile')).toHaveLength(2);

    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: '清空收藏' }));
    expect(onClearTempPlaylist).not.toHaveBeenCalled();

    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: '清空收藏' }));
    expect(onClearTempPlaylist).toHaveBeenCalledTimes(1);
  });
});
