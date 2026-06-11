import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import VideoPage from './VideoPage.jsx';

const {
  useVideoCatalog,
  useVideoPlayback
} = vi.hoisted(() => ({
  useVideoCatalog: vi.fn(),
  useVideoPlayback: vi.fn()
}));

vi.mock('../hooks/useVideoCatalog.js', () => ({
  useVideoCatalog
}));

vi.mock('../hooks/useVideoPlayback.js', () => ({
  useVideoPlayback
}));

vi.mock('framer-motion', () => {
  const ReactModule = React;
  const motion = new Proxy({}, {
    get: (_, tag) => ReactModule.forwardRef(({ children, ...props }, ref) => (
      ReactModule.createElement(tag, { ...props, ref }, children)
    ))
  });

  return {
    motion
  };
});

describe('VideoPage', () => {
  const handleCardClick = vi.fn();
  const handleBackFolder = vi.fn();

  const createVideoCatalogMock = (overrides = {}) => ({
    searchQuery: '',
    setSearchQuery: vi.fn(),
    videoCategories: [{ id: 'cat-1', name: '分类 1' }],
    isCatalogLoading: false,
    catalogLoadError: '',
    handleRetryCatalog: vi.fn(),
    activeCategory: 'cat-1',
    activeCategoryMeta: { id: 'cat-1', name: '分类 1' },
    handleSelectCategory: vi.fn(),
    watchCategory: 'cat-1',
    watchCategoryMeta: { id: 'cat-1', name: '分类 1' },
    handleSelectWatchCategory: vi.fn(),
    categoryVideoCounts: { 'cat-1': 1 },
    isSearching: false,
    showBackCard: true,
    displayedItems: [
      { id: 'video-1', title: '测试视频', url: 'https://example.com/video.m3u8' }
    ],
    handleCardClick,
    handleBackFolder,
    activeVideo: null,
    setActiveVideo: vi.fn(),
    activeVideoKey: '',
    isWatching: false,
    watchEpisodes: [],
    watchEpisodeGroups: [],
    activeWatchIndex: -1,
    prevWatchEpisode: null,
    nextWatchEpisode: null,
    expandedWatchGroups: new Set(),
    handleToggleWatchGroup: vi.fn(),
    handleSelectWatchEpisode: vi.fn(),
    activeEpisodeRef: { current: null },
    stageCategoriesRef: { current: null },
    stageCategoriesScrollState: { canLeft: false, canRight: false },
    handleStageCategoriesWheel: vi.fn(),
    handleScrollStageCategories: vi.fn(),
    ...overrides
  });

  beforeEach(() => {
    useVideoCatalog.mockReturnValue(createVideoCatalogMock());

    useVideoPlayback.mockReturnValue({
      playerRef: { current: null },
      isResolving: false,
      resolveError: '',
      resolvedUrl: '',
      resolvedType: 'auto',
      canPlayInline: true,
      canSwitchToBackup: false,
      backupActionLabel: '切换备用链接',
      playerContainerKey: 'video:1',
      handleSwitchToBackup: vi.fn(),
      handleReloadVideo: vi.fn()
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders video cards and the back card as buttons', () => {
    render(<VideoPage locationSearch="" />);

    expect(screen.getByRole('button', { name: '返回上级' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /测试视频/ })).toBeInTheDocument();
  });

  it('routes clicks through the accessible button cards', () => {
    render(<VideoPage locationSearch="" />);

    fireEvent.click(screen.getByRole('button', { name: '返回上级' }));
    fireEvent.click(screen.getByRole('button', { name: /测试视频/ }));

    expect(handleBackFolder).toHaveBeenCalledTimes(1);
    expect(handleCardClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'video-1', title: '测试视频' })
    );
  });

  it('keeps the catalog grid in the page while a video is active', () => {
    const activeVideo = { id: 'video-1', title: '测试视频', url: 'https://example.com/video.m3u8' };
    useVideoCatalog.mockReturnValue(createVideoCatalogMock({
      showBackCard: false,
      displayedItems: [
        activeVideo,
        { id: 'video-2', title: '下一集', url: 'https://example.com/video-2.m3u8' }
      ],
      activeVideo,
      activeVideoKey: 'video-1::测试视频::https://example.com/video.m3u8',
      isWatching: true,
      watchEpisodes: [
        activeVideo,
        { id: 'video-2', title: '下一集', url: 'https://example.com/video-2.m3u8' }
      ],
      watchEpisodeGroups: [{
        key: '__direct__',
        label: '直出',
        isDirect: true,
        items: [
          activeVideo,
          { id: 'video-2', title: '下一集', url: 'https://example.com/video-2.m3u8' }
        ]
      }],
      activeWatchIndex: 0,
      nextWatchEpisode: { id: 'video-2', title: '下一集', url: 'https://example.com/video-2.m3u8' }
    }));

    const { container } = render(<VideoPage locationSearch="" />);

    expect(screen.getByRole('button', { name: '分类 1' })).toBeInTheDocument();
    expect(screen.getByText('第 1 / 2 集')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '收起播放器' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '打开评论页' })).not.toBeInTheDocument();
    const shareButton = screen.getByRole('button', { name: '分享当前视频' });
    expect(shareButton).toBeInTheDocument();
    expect(container.querySelector('.video-stage-header-top .video-stage-share-btn')).toBe(shareButton);
    expect(container.querySelector('.video-stage-main-controls')).not.toBeInTheDocument();
    expect(container.querySelector('.video-inline-stage')).toBeInTheDocument();
    expect(container.querySelector('.video-watch-sidebar')).not.toBeInTheDocument();
    expect(container.querySelector('.video-grid')).toBeInTheDocument();
    expect(container.querySelector('.video-card.active')).toBeInTheDocument();

    const stage = container.querySelector('.video-inline-stage');
    const toolbar = container.querySelector('.video-toolbar');
    const grid = container.querySelector('.video-grid');
    expect(stage.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toolbar.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
