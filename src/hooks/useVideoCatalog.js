import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  loadVideoCatalog,
  subscribeToVideoCatalog
} from '../data/videoManifest';
import { buildVideoKey } from '../utils/videoPageUtils.js';

const EMPTY_CATALOG = {
  videoCategories: [],
  videoData: {}
};

export const useVideoCatalog = ({ locationSearch, onInitialReady, requestVideoView }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [videoCatalog, setVideoCatalog] = useState(() => EMPTY_CATALOG);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogLoadError, setCatalogLoadError] = useState('');
  const [catalogRetryKey, setCatalogRetryKey] = useState(0);
  const [activeCategory, setActiveCategory] = useState('');
  const [watchCategory, setWatchCategory] = useState('');
  const [folderStack, setFolderStack] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const [expandedWatchGroups, setExpandedWatchGroups] = useState(() => new Set(['__direct__']));
  const [stageCategoriesScrollState, setStageCategoriesScrollState] = useState({
    canLeft: false,
    canRight: false
  });

  const activeEpisodeRef = useRef(null);
  const stageCategoriesRef = useRef(null);

  const videoCategories = videoCatalog.videoCategories;
  const videoData = videoCatalog.videoData;

  useEffect(() => {
    let canceled = false;
    const unsubscribe = subscribeToVideoCatalog((nextCatalog) => {
      if (canceled) return;
      setVideoCatalog(nextCatalog || EMPTY_CATALOG);
      setCatalogLoadError('');
      setIsCatalogLoading(false);
    });
    const applyCatalog = async () => {
      setIsCatalogLoading(true);
      setCatalogLoadError('');
      try {
        const nextCatalog = await loadVideoCatalog();
        if (canceled) return;
        setVideoCatalog(nextCatalog);
      } catch (error) {
        if (canceled) return;
        setVideoCatalog(EMPTY_CATALOG);
        setCatalogLoadError(error?.message || '视频清单加载失败');
      } finally {
        if (!canceled) {
          setIsCatalogLoading(false);
        }
      }
    };
    void applyCatalog();
    return () => {
      canceled = true;
      unsubscribe();
    };
  }, [catalogRetryKey]);

  useEffect(() => {
    if (!isCatalogLoading && typeof onInitialReady === 'function') {
      onInitialReady();
    }
  }, [isCatalogLoading, onInitialReady]);

  useEffect(() => {
    const firstCategoryId = videoCategories[0]?.id || '';
    if (!firstCategoryId) return;

    if (!videoCategories.some((category) => category.id === activeCategory)) {
      setActiveCategory(firstCategoryId);
      setFolderStack([]);
    }

    if (!videoCategories.some((category) => category.id === watchCategory)) {
      setWatchCategory(firstCategoryId);
    }
  }, [videoCategories, activeCategory, watchCategory]);

  const currentItems = useMemo(() => {
    if (folderStack.length > 0) {
      return folderStack[folderStack.length - 1].items;
    }
    return videoData[activeCategory] || [];
  }, [activeCategory, folderStack, videoData]);

  const isSearching = searchQuery.trim().length > 0;
  const showBackCard = !isSearching && folderStack.length > 0;

  const allVideos = useMemo(() => {
    const results = [];
    const walk = (items, path, categoryId, categoryName) => {
      items.forEach((item) => {
        const isFolder = item.isFolder || item.folderId;
        if (isFolder && item.folderId) {
          const nextPath = [...path, item.title];
          const folderItems = videoData[item.folderId] || [];
          walk(folderItems, nextPath, categoryId, categoryName);
        } else if (!isFolder) {
          const pathLabel = path.join(' / ');
          results.push({
            ...item,
            _categoryId: categoryId,
            _categoryName: categoryName,
            _pathLabel: pathLabel,
            _searchText: `${item.title || ''} ${pathLabel}`.toLowerCase()
          });
        }
      });
    };

    videoCategories.forEach((cat) => {
      const items = videoData[cat.id] || [];
      walk(items, [cat.name], cat.id, cat.name);
    });

    return results;
  }, [videoCategories, videoData]);

  const allVideoMap = useMemo(() => {
    const map = new Map();
    allVideos.forEach((item) => {
      map.set(buildVideoKey(item), item);
    });
    return map;
  }, [allVideos]);

  const categoryVideoCounts = useMemo(() => {
    const counts = {};
    videoCategories.forEach((cat) => {
      counts[cat.id] = 0;
    });
    allVideos.forEach((item) => {
      counts[item._categoryId] = (counts[item._categoryId] || 0) + 1;
    });
    return counts;
  }, [allVideos, videoCategories]);

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const term = searchQuery.trim().toLowerCase();
    return allVideos.filter((item) => item._searchText.includes(term));
  }, [allVideos, isSearching, searchQuery]);

  const displayedItems = isSearching ? searchResults : currentItems;

  const normalizeVideoItem = useCallback((item) => {
    if (!item) return item;
    return allVideoMap.get(buildVideoKey(item)) || item;
  }, [allVideoMap]);

  const activeVideoKey = activeVideo ? buildVideoKey(activeVideo) : '';
  const isWatching = Boolean(activeVideo);
  const sharedLocationSearch = typeof locationSearch === 'string'
    ? locationSearch
    : (typeof window !== 'undefined' ? window.location.search : '');

  const watchEpisodes = useMemo(() => {
    if (!watchCategory) return [];
    return allVideos.filter((item) => item._categoryId === watchCategory);
  }, [allVideos, watchCategory]);

  const watchEpisodeGroups = useMemo(() => {
    const groups = [];
    const groupMap = new Map();

    watchEpisodes.forEach((item) => {
      const segments = String(item._pathLabel || '')
        .split(' / ')
        .map((segment) => segment.trim())
        .filter(Boolean);
      const relativePath = segments.slice(1).join(' / ');
      const groupKey = relativePath || '__direct__';

      if (!groupMap.has(groupKey)) {
        const group = {
          key: groupKey,
          label: relativePath || '直出',
          isDirect: !relativePath,
          items: []
        };
        groupMap.set(groupKey, group);
        groups.push(group);
      }

      groupMap.get(groupKey).items.push(item);
    });

    return groups;
  }, [watchEpisodes]);

  const watchEpisodeGroupByKey = useMemo(() => {
    const map = new Map();
    watchEpisodeGroups.forEach((group) => {
      group.items.forEach((item) => {
        map.set(buildVideoKey(item), group.key);
      });
    });
    return map;
  }, [watchEpisodeGroups]);

  const activeWatchIndex = useMemo(() => {
    if (!activeVideoKey) return -1;
    return watchEpisodes.findIndex((item) => buildVideoKey(item) === activeVideoKey);
  }, [activeVideoKey, watchEpisodes]);

  const activeWatchGroupKey = watchEpisodeGroupByKey.get(activeVideoKey) || '';
  const prevWatchEpisode = activeWatchIndex > 0 ? watchEpisodes[activeWatchIndex - 1] : null;
  const nextWatchEpisode = activeWatchIndex >= 0 && activeWatchIndex < watchEpisodes.length - 1
    ? watchEpisodes[activeWatchIndex + 1]
    : null;

  const activeCategoryMeta = useMemo(
    () => videoCategories.find((cat) => cat.id === activeCategory),
    [activeCategory, videoCategories]
  );

  const watchCategoryMeta = useMemo(
    () => videoCategories.find((cat) => cat.id === watchCategory),
    [watchCategory, videoCategories]
  );

  useEffect(() => {
    if (!activeVideo) return;
    const nextCategoryId = activeVideo._categoryId || activeCategory;
    if (nextCategoryId) {
      setWatchCategory((prev) => (prev === nextCategoryId ? prev : nextCategoryId));
    }
  }, [activeVideo, activeCategory]);

  useEffect(() => {
    if (allVideos.length === 0) return;

    const params = new URLSearchParams(sharedLocationSearch);
    const videoId = String(params.get('videoId') || '').trim();
    if (!videoId) return;

    const videoCategory = String(params.get('videoCategory') || '').trim();
    const exactCategoryMatch = videoCategory
      ? allVideos.find((item) => item._categoryId === videoCategory && String(item.id) === videoId)
      : null;
    const idMatches = exactCategoryMatch
      ? [exactCategoryMatch]
      : allVideos.filter((item) => String(item.id) === videoId);
    const matched = exactCategoryMatch || (idMatches.length === 1 ? idMatches[0] : null);
    const nextVideo = normalizeVideoItem(matched);
    if (!nextVideo) return;

    const nextCategoryId = nextVideo._categoryId;
    if (nextCategoryId) {
      setActiveCategory((prev) => (prev === nextCategoryId ? prev : nextCategoryId));
      setWatchCategory((prev) => (prev === nextCategoryId ? prev : nextCategoryId));
    }
    setFolderStack((prev) => (prev.length === 0 ? prev : []));
    const openVideo = () => {
      setActiveVideo((prev) => (
        (prev ? buildVideoKey(prev) : '') === buildVideoKey(nextVideo) ? prev : nextVideo
      ));
    };
    if (typeof requestVideoView === 'function') {
      requestVideoView(openVideo);
      return;
    }
    openVideo();
  }, [allVideos, normalizeVideoItem, requestVideoView, sharedLocationSearch]);

  useEffect(() => {
    const availableGroupKeys = new Set(watchEpisodeGroups.map((group) => group.key));

    setExpandedWatchGroups((prev) => {
      const next = new Set();
      prev.forEach((key) => {
        if (availableGroupKeys.has(key)) {
          next.add(key);
        }
      });
      if (availableGroupKeys.has('__direct__')) {
        next.add('__direct__');
      }
      if (activeWatchGroupKey && availableGroupKeys.has(activeWatchGroupKey)) {
        next.add(activeWatchGroupKey);
      }

      if (next.size === prev.size) {
        let same = true;
        for (const key of prev) {
          if (!next.has(key)) {
            same = false;
            break;
          }
        }
        if (same) {
          return prev;
        }
      }

      return next;
    });
  }, [watchEpisodeGroups, activeWatchGroupKey]);

  useEffect(() => {
    if (!activeVideo || !activeEpisodeRef.current) return;
    activeEpisodeRef.current.scrollIntoView({ block: 'nearest' });
  }, [activeVideo, activeVideoKey, watchCategory, activeWatchGroupKey, expandedWatchGroups]);

  const handleSelectCategory = useCallback((categoryId) => {
    setActiveCategory(categoryId);
    setFolderStack([]);
  }, []);

  const handleOpenFolder = useCallback((item) => {
    const folderItems = videoData[item.folderId] || [];
    setFolderStack((prev) => [...prev, { id: item.folderId, title: item.title, items: folderItems }]);
  }, [videoData]);

  const handleBackFolder = useCallback(() => {
    setFolderStack((prev) => prev.slice(0, -1));
  }, []);

  const handleOpenVideo = useCallback((item) => {
    const nextVideo = normalizeVideoItem(item);
    if (!nextVideo) return;
    if (typeof requestVideoView === 'function') {
      requestVideoView(() => setActiveVideo(nextVideo));
      return;
    }
    setActiveVideo(nextVideo);
  }, [normalizeVideoItem, requestVideoView]);

  const handleCardClick = useCallback((item) => {
    if (item.isFolder || item.folderId) {
      handleOpenFolder(item);
      return;
    }
    handleOpenVideo(item);
  }, [handleOpenFolder, handleOpenVideo]);

  const handleSelectWatchCategory = useCallback((categoryId) => {
    setWatchCategory(categoryId);
  }, []);

  const handleRetryCatalog = useCallback(() => {
    setCatalogRetryKey((value) => value + 1);
  }, []);

  const updateStageCategoriesScrollState = useCallback(() => {
    const node = stageCategoriesRef.current;
    if (!node) {
      setStageCategoriesScrollState((prev) => (
        prev.canLeft || prev.canRight ? { canLeft: false, canRight: false } : prev
      ));
      return;
    }

    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    const next = {
      canLeft: node.scrollLeft > 2,
      canRight: maxScrollLeft - node.scrollLeft > 2
    };

    setStageCategoriesScrollState((prev) => (
      prev.canLeft === next.canLeft && prev.canRight === next.canRight ? prev : next
    ));
  }, []);

  const handleStageCategoriesWheel = useCallback((event) => {
    const node = stageCategoriesRef.current;
    if (!node || node.scrollWidth <= node.clientWidth) return;

    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);
    const delta = absX > absY ? event.deltaX : event.deltaY;
    if (!delta) return;

    const prevScrollLeft = node.scrollLeft;
    node.scrollLeft += delta;
    if (node.scrollLeft !== prevScrollLeft) {
      event.preventDefault();
    }
  }, []);

  const handleScrollStageCategories = useCallback((direction) => {
    const node = stageCategoriesRef.current;
    if (!node) return;

    const step = Math.max(220, Math.round(node.clientWidth * 0.58));
    node.scrollBy({ left: direction * step, behavior: 'smooth' });
  }, []);

  const handleToggleWatchGroup = useCallback((groupKey) => {
    setExpandedWatchGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const handleSelectWatchEpisode = useCallback((item) => {
    const nextVideo = normalizeVideoItem(item);
    if (!nextVideo) return;
    setActiveVideo(nextVideo);
  }, [normalizeVideoItem]);

  useEffect(() => {
    if (!isWatching) {
      setStageCategoriesScrollState((prev) => (
        prev.canLeft || prev.canRight ? { canLeft: false, canRight: false } : prev
      ));
      return undefined;
    }

    const node = stageCategoriesRef.current;
    if (!node) return undefined;

    updateStageCategoriesScrollState();
    node.addEventListener('scroll', updateStageCategoriesScrollState, { passive: true });
    window.addEventListener('resize', updateStageCategoriesScrollState);

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updateStageCategoriesScrollState());
      observer.observe(node);
    }

    return () => {
      node.removeEventListener('scroll', updateStageCategoriesScrollState);
      window.removeEventListener('resize', updateStageCategoriesScrollState);
      observer?.disconnect();
    };
  }, [isWatching, watchCategory, updateStageCategoriesScrollState]);

  return {
    searchQuery,
    setSearchQuery,
    videoCategories,
    isCatalogLoading,
    catalogLoadError,
    handleRetryCatalog,
    activeCategory,
    activeCategoryMeta,
    handleSelectCategory,
    watchCategory,
    watchCategoryMeta,
    handleSelectWatchCategory,
    categoryVideoCounts,
    isSearching,
    showBackCard,
    displayedItems,
    handleCardClick,
    handleBackFolder,
    activeVideo,
    setActiveVideo,
    activeVideoKey,
    isWatching,
    watchEpisodes,
    watchEpisodeGroups,
    activeWatchIndex,
    prevWatchEpisode,
    nextWatchEpisode,
    expandedWatchGroups,
    handleToggleWatchGroup,
    handleSelectWatchEpisode,
    activeEpisodeRef,
    stageCategoriesRef,
    stageCategoriesScrollState,
    handleStageCategoriesWheel,
    handleScrollStageCategories
  };
};
