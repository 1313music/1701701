import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVideoCatalog } from './useVideoCatalog.js';

const { loadVideoCatalog } = vi.hoisted(() => ({
  loadVideoCatalog: vi.fn()
}));

vi.mock('../data/videoManifest', () => ({
  loadVideoCatalog
}));

const createCatalog = () => ({
  videoCategories: [
    { id: 'cat-a', name: '分类 A', icon: '#icon-a' },
    { id: 'cat-b', name: '分类 B', icon: '#icon-b' }
  ],
  videoData: {
    'cat-a': [
      { id: 'dup', title: 'A-1', url: 'https://example.com/a-1.m3u8' }
    ],
    'cat-b': [
      { id: 'dup', title: 'B-1', url: 'https://example.com/b-1.m3u8' },
      { id: 'solo', title: 'B-2', url: 'https://example.com/b-2.m3u8' }
    ]
  }
});

const createNestedCatalog = () => ({
  videoCategories: [
    { id: 'cat-a', name: '分类 A', icon: '#icon-a' },
    { id: 'cat-b', name: '分类 B', icon: '#icon-b' }
  ],
  videoData: {
    'cat-a': [
      { id: 'folder-1', title: '合集', isFolder: true, folderId: 'folder-1' },
      { id: 'direct-1', title: '直出 1', url: 'https://example.com/direct-1.m3u8' }
    ],
    'folder-1': [
      { id: 'episode-1', title: '第 1 集', url: 'https://example.com/episode-1.m3u8' },
      { id: 'episode-2', title: '第 2 集', url: 'https://example.com/episode-2.m3u8' }
    ],
    'cat-b': [
      { id: 'other-1', title: '其他视频', url: 'https://example.com/other-1.m3u8' }
    ]
  }
});

describe('useVideoCatalog share query sync', () => {
  beforeEach(() => {
    loadVideoCatalog.mockResolvedValue(createCatalog());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('restores the shared video with category + id', async () => {
    const { result } = renderHook(() => useVideoCatalog({
      locationSearch: '?videoId=dup&videoCategory=cat-b'
    }));

    await waitFor(() => {
      expect(result.current.isCatalogLoading).toBe(false);
    });

    expect(result.current.activeVideo?.title).toBe('B-1');
    expect(result.current.activeCategory).toBe('cat-b');
    expect(result.current.watchCategory).toBe('cat-b');
  });

  it('reacts when the location search changes after mount', async () => {
    const { result, rerender } = renderHook(
      ({ locationSearch }) => useVideoCatalog({ locationSearch }),
      { initialProps: { locationSearch: '' } }
    );

    await waitFor(() => {
      expect(result.current.isCatalogLoading).toBe(false);
    });

    expect(result.current.activeVideo).toBe(null);

    rerender({ locationSearch: '?videoId=solo&videoCategory=cat-b' });

    await waitFor(() => {
      expect(result.current.activeVideo?.title).toBe('B-2');
    });

    expect(result.current.activeCategory).toBe('cat-b');
  });

  it('allows dismissing or switching away from a shared video after initial hydration', async () => {
    const { result } = renderHook(() => useVideoCatalog({
      locationSearch: '?videoId=solo&videoCategory=cat-b'
    }));

    await waitFor(() => {
      expect(result.current.activeVideo?.title).toBe('B-2');
    });

    act(() => {
      result.current.setActiveVideo(null);
    });

    expect(result.current.activeVideo).toBe(null);

    act(() => {
      result.current.handleSelectWatchEpisode(result.current.watchEpisodes[0]);
    });

    expect(result.current.activeVideo?.title).toBe('B-1');
  });

  it('ignores ambiguous ids without category hints', async () => {
    const { result } = renderHook(() => useVideoCatalog({
      locationSearch: '?videoId=dup'
    }));

    await waitFor(() => {
      expect(result.current.isCatalogLoading).toBe(false);
    });

    expect(result.current.activeVideo).toBe(null);
  });

  it('navigates folders and defers activation through requestVideoView', async () => {
    loadVideoCatalog.mockResolvedValue(createNestedCatalog());
    const requestVideoView = vi.fn();

    const { result } = renderHook(() => useVideoCatalog({
      locationSearch: '',
      requestVideoView
    }));

    await waitFor(() => {
      expect(result.current.isCatalogLoading).toBe(false);
    });

    expect(result.current.displayedItems[0].title).toBe('合集');

    act(() => {
      result.current.handleCardClick(result.current.displayedItems[0]);
    });

    expect(result.current.showBackCard).toBe(true);
    expect(result.current.displayedItems.map((item) => item.title)).toEqual(['第 1 集', '第 2 集']);

    act(() => {
      result.current.handleBackFolder();
    });

    expect(result.current.showBackCard).toBe(false);

    act(() => {
      result.current.handleCardClick(result.current.displayedItems[0]);
    });

    act(() => {
      result.current.handleCardClick(result.current.displayedItems[0]);
    });

    expect(requestVideoView).toHaveBeenCalledTimes(1);
    expect(result.current.activeVideo).toBe(null);

    act(() => {
      requestVideoView.mock.calls[0][0]();
    });

    expect(result.current.activeVideo?.title).toBe('第 1 集');
    expect(result.current.isWatching).toBe(true);
  });

  it('updates watch group, scroll controls, and retry state while watching', async () => {
    loadVideoCatalog.mockResolvedValue(createNestedCatalog());

    const resizeObserverInstances = [];
    const originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(callback) {
        this.callback = callback;
        this.observe = vi.fn();
        this.disconnect = vi.fn();
        resizeObserverInstances.push(this);
      }
    };

    try {
      const { result, unmount } = renderHook(() => useVideoCatalog({
        locationSearch: ''
      }));

      await waitFor(() => {
        expect(result.current.isCatalogLoading).toBe(false);
      });

      const groupedEpisode = result.current.watchEpisodeGroups.find((group) => !group.isDirect);
      const scrollIntoView = vi.fn();
      const stageNode = {
        scrollWidth: 500,
        clientWidth: 200,
        scrollLeft: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        scrollBy: vi.fn()
      };
      result.current.activeEpisodeRef.current = { scrollIntoView };
      result.current.stageCategoriesRef.current = stageNode;

      act(() => {
        result.current.handleToggleWatchGroup(groupedEpisode.key);
      });
      expect(result.current.expandedWatchGroups.has(groupedEpisode.key)).toBe(true);

      act(() => {
        result.current.handleToggleWatchGroup(groupedEpisode.key);
      });
      expect(result.current.expandedWatchGroups.has(groupedEpisode.key)).toBe(false);

      act(() => {
        result.current.handleSelectWatchCategory('cat-b');
      });
      expect(result.current.watchCategory).toBe('cat-b');

      act(() => {
        result.current.handleSelectWatchCategory('cat-a');
      });
      expect(result.current.watchCategory).toBe('cat-a');

      act(() => {
        result.current.handleSelectWatchEpisode(groupedEpisode.items[0]);
      });

      await waitFor(() => {
        expect(result.current.activeVideo?.title).toBe('第 1 集');
      });

      await waitFor(() => {
        expect(result.current.stageCategoriesScrollState.canRight).toBe(true);
      });

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
      expect(stageNode.addEventListener).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function),
        { passive: true }
      );
      expect(resizeObserverInstances[0]?.observe).toHaveBeenCalledWith(stageNode);

      const preventDefault = vi.fn();
      act(() => {
        result.current.handleStageCategoriesWheel({
          deltaX: 0,
          deltaY: 50,
          preventDefault
        });
      });

      expect(stageNode.scrollLeft).toBe(50);
      expect(preventDefault).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.handleScrollStageCategories(1);
      });
      expect(stageNode.scrollBy).toHaveBeenCalledWith({ left: 220, behavior: 'smooth' });

      act(() => {
        result.current.handleRetryCatalog();
      });

      await waitFor(() => {
        expect(loadVideoCatalog).toHaveBeenCalledTimes(2);
      });

      unmount();
      expect(stageNode.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
      expect(resizeObserverInstances[0]?.disconnect).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });
});
