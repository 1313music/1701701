import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import VideoPage from './VideoPage.jsx';

const {
  useVideoCatalog,
  useVideoPlayback,
  useVideoComments
} = vi.hoisted(() => ({
  useVideoCatalog: vi.fn(),
  useVideoPlayback: vi.fn(),
  useVideoComments: vi.fn()
}));

vi.mock('../hooks/useVideoCatalog.js', () => ({
  useVideoCatalog
}));

vi.mock('../hooks/useVideoPlayback.js', () => ({
  useVideoPlayback
}));

vi.mock('../hooks/useVideoComments.js', () => ({
  useVideoComments
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

describe('VideoPage', () => {
  const handleCardClick = vi.fn();
  const handleBackFolder = vi.fn();

  beforeEach(() => {
    useVideoCatalog.mockReturnValue({
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
      handleScrollStageCategories: vi.fn()
    });

    useVideoPlayback.mockReturnValue({
      playerRef: { current: null },
      stageMainRef: { current: null },
      stageMainHeight: 0,
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

    useVideoComments.mockReturnValue({
      closeCommentDrawer: vi.fn(),
      currentVideoCommentPath: '',
      canOpenCommentDrawer: false,
      shouldRenderVideoCommentDrawer: false,
      handleOpenVideoComment: vi.fn()
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
});
