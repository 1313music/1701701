import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  X
} from 'lucide-react';
import '../styles/gallery.css';
import { loadGalleryItems, refreshGalleryItems } from '../data/galleryManifest';

const shuffleItems = (input) => {
  const list = Array.isArray(input) ? [...input] : [];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [list[i], list[randomIndex]] = [list[randomIndex], list[i]];
  }
  return list;
};

const ALL_CATEGORY = '__all__';
const COVER_CATEGORY = '封面';
const MIN_VISIBLE_COUNT_STEP = 12;
const DESKTOP_COLUMN_WIDTH = 220;
const DESKTOP_COLUMN_GAP = 12;
const MOBILE_COLUMN_COUNT = 2;
const MOBILE_COLUMN_GAP = 10;
const DEFAULT_WATERFALL_HEIGHT_WEIGHT = 1.15;
const LOADING_PLACEHOLDER_COUNT = 12;

const containsCjk = (value) => /[\u3400-\u9fff]/.test(String(value || ''));

const compareCategoryNames = (left, right) => {
  if (left === COVER_CATEGORY) return -1;
  if (right === COVER_CATEGORY) return 1;

  const leftHasCjk = containsCjk(left);
  const rightHasCjk = containsCjk(right);
  if (leftHasCjk !== rightHasCjk) {
    return leftHasCjk ? -1 : 1;
  }

  return left.localeCompare(right, 'zh-Hans-CN');
};

const buildCategoryStats = (items) => {
  const map = new Map();
  for (const item of items) {
    map.set(item.category, (map.get(item.category) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => compareCategoryNames(left.name, right.name));
};

const getDefaultCategory = (items) => buildCategoryStats(items)[0]?.name || ALL_CATEGORY;

const getScrollRoot = (node) => {
  if (typeof window === 'undefined') return null;
  let current = node?.parentElement || null;

  while (current && current !== document.body) {
    const styles = window.getComputedStyle(current);
    const overflowY = styles.overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
      && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
};

const getScrollMetrics = (scrollRoot) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { scrollTop: 0, viewportHeight: 0, scrollHeight: 0 };
  }

  if (scrollRoot) {
    return {
      scrollTop: scrollRoot.scrollTop,
      viewportHeight: scrollRoot.clientHeight,
      scrollHeight: scrollRoot.scrollHeight
    };
  }

  const docElement = document.documentElement;
  const body = document.body;
  return {
    scrollTop: window.scrollY || docElement.scrollTop || body.scrollTop || 0,
    viewportHeight: window.innerHeight || docElement.clientHeight || 0,
    scrollHeight: Math.max(
      docElement.scrollHeight,
      body.scrollHeight,
      docElement.offsetHeight,
      body.offsetHeight
    )
  };
};

const isMobileGalleryLayout = (containerWidth) => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(max-width: 768px)').matches;
  }
  return containerWidth <= 768;
};

const getEstimatedColumnCount = (containerWidth) => {
  const safeWidth = Math.max(containerWidth || 0, DESKTOP_COLUMN_WIDTH);
  if (isMobileGalleryLayout(safeWidth)) {
    return MOBILE_COLUMN_COUNT;
  }

  return Math.max(
    1,
    Math.floor((safeWidth + DESKTOP_COLUMN_GAP) / (DESKTOP_COLUMN_WIDTH + DESKTOP_COLUMN_GAP))
  );
};

const getAdaptiveVisibleStep = (sectionNode, waterfallNode) => {
  if (typeof window === 'undefined') return MIN_VISIBLE_COUNT_STEP;

  const containerWidth = waterfallNode?.getBoundingClientRect().width
    || sectionNode?.getBoundingClientRect().width
    || window.innerWidth
    || 0;
  const columnCount = getEstimatedColumnCount(containerWidth);
  return Math.max(MIN_VISIBLE_COUNT_STEP, columnCount * 2);
};

const getAdaptiveInitialVisibleCount = (total, sectionNode, waterfallNode) => {
  if (total <= 0) return 0;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Math.min(total, MIN_VISIBLE_COUNT_STEP);
  }

  const scrollRoot = getScrollRoot(sectionNode);
  const viewportHeight = scrollRoot
    ? scrollRoot.clientHeight
    : window.innerHeight || document.documentElement.clientHeight || 0;
  const rootTop = scrollRoot?.getBoundingClientRect().top || 0;
  const waterfallTop = (
    waterfallNode?.getBoundingClientRect().top
    || sectionNode?.getBoundingClientRect().top
    || 0
  ) - rootTop;
  const availableHeight = Math.max(0, viewportHeight - waterfallTop);
  const containerWidth = waterfallNode?.getBoundingClientRect().width
    || sectionNode?.getBoundingClientRect().width
    || window.innerWidth
    || 0;
  const isMobile = isMobileGalleryLayout(containerWidth);
  const columnCount = getEstimatedColumnCount(containerWidth);
  const gap = isMobile ? MOBILE_COLUMN_GAP : DESKTOP_COLUMN_GAP;
  const estimatedCardHeight = isMobile ? 220 : 280;
  const rowCount = Math.max(2, Math.ceil((availableHeight + gap) / (estimatedCardHeight + gap)));
  const estimatedCount = Math.max(columnCount * 2, columnCount * rowCount);

  return Math.min(total, estimatedCount);
};

const createWaterfallColumns = (columnCount) => (
  Array.from({ length: Math.max(1, columnCount || 1) }, () => [])
);

const getShortestColumnIndex = (columnHeights) => {
  let shortestColumnIndex = 0;
  let shortestColumnHeight = Number.POSITIVE_INFINITY;

  columnHeights.forEach((height, index) => {
    if (height < shortestColumnHeight) {
      shortestColumnHeight = height;
      shortestColumnIndex = index;
    }
  });

  return shortestColumnIndex;
};

const isNearScrollEnd = ({ scrollTop, viewportHeight, scrollHeight }) => {
  if (viewportHeight <= 0 || scrollHeight <= 0) return false;
  const threshold = Math.max(180, Math.min(360, Math.round(viewportHeight * 0.35)));
  return scrollHeight - (scrollTop + viewportHeight) <= threshold;
};

const GalleryDisplayPage = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewItemId, setPreviewItemId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [visibleCount, setVisibleCount] = useState(MIN_VISIBLE_COUNT_STEP);
  const [loadedItemIds, setLoadedItemIds] = useState(() => new Set());
  const gallerySectionRef = useRef(null);
  const galleryWaterfallRef = useRef(null);
  const autoLoadTimerRef = useRef(null);
  const lastScrollTopRef = useRef(0);
  const touchStartYRef = useRef(0);
  const lightboxTouchStartXRef = useRef(0);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const itemHeightWeightsRef = useRef(new Map());
  const assignedItemWeightsRef = useRef(new Map());
  const itemColumnIndexRef = useRef(new Map());
  const columnHeightsRef = useRef([0]);
  const columnLayoutKeyRef = useRef('');
  const loadedItemIdsRef = useRef(new Set());
  const loadRevealTimersRef = useRef(new Map());

  const categoryStats = useMemo(() => buildCategoryStats(items), [items]);

  const filteredItems = useMemo(() => (
    selectedCategory === ALL_CATEGORY
      ? items
      : items.filter((item) => item.category === selectedCategory)
  ), [items, selectedCategory]);
  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount]
  );
  const previewIndex = useMemo(
    () => filteredItems.findIndex((item) => item.id === previewItemId),
    [filteredItems, previewItemId]
  );
  const previewItem = previewIndex >= 0 ? filteredItems[previewIndex] : null;
  const columnCount = useMemo(() => {
    const fallbackWidth = (
      layoutWidth
      || (typeof window !== 'undefined' ? window.innerWidth : DESKTOP_COLUMN_WIDTH)
    );
    return getEstimatedColumnCount(fallbackWidth);
  }, [layoutWidth]);
  const columnGap = isMobileGalleryLayout(layoutWidth || (typeof window !== 'undefined' ? window.innerWidth : 0))
    ? MOBILE_COLUMN_GAP
    : DESKTOP_COLUMN_GAP;
  const [waterfallColumns, setWaterfallColumns] = useState(() => createWaterfallColumns(1));

  const itemIdSet = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const hasMoreVisibleItems = visibleItems.length < filteredItems.length;
  const visibleProgress = filteredItems.length > 0
    ? Math.round((visibleItems.length / filteredItems.length) * 100)
    : 0;
  const hasMultiplePreviewItems = filteredItems.length > 1;
  const loadImages = useCallback(async ({ forceRefresh = false } = {}) => {
    setIsLoading(true);
    setError('');

    try {
      const parsedItems = forceRefresh
        ? await refreshGalleryItems()
        : await loadGalleryItems();
      const randomizedItems = shuffleItems(parsedItems);
      setItems(randomizedItems);
      setSelectedCategory(getDefaultCategory(randomizedItems));
    } catch (requestError) {
      setItems([]);
      setError(requestError?.message || '图库加载失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadImages();
  }, [loadImages]);

  useEffect(() => {
    if (selectedCategory === ALL_CATEGORY) return;
    const exists = categoryStats.some((category) => category.name === selectedCategory);
    if (!exists) {
      setSelectedCategory(categoryStats[0]?.name || ALL_CATEGORY);
    }
  }, [categoryStats, selectedCategory]);

  useEffect(() => {
    if (!previewItemId) return;
    if (!filteredItems.some((item) => item.id === previewItemId)) {
      setPreviewItemId('');
    }
  }, [filteredItems, previewItemId]);

  useEffect(() => {
    loadedItemIdsRef.current = loadedItemIds;
  }, [loadedItemIds]);

  useEffect(() => {
    setLoadedItemIds((prev) => {
      let changed = false;
      const next = new Set();
      for (const id of prev) {
        if (itemIdSet.has(id)) {
          next.add(id);
        } else {
          changed = true;
          const pendingTimer = loadRevealTimersRef.current.get(id);
          if (pendingTimer) {
            window.clearTimeout(pendingTimer);
            loadRevealTimersRef.current.delete(id);
          }
        }
      }
      return changed ? next : prev;
    });
  }, [itemIdSet]);

  useEffect(() => () => {
    loadRevealTimersRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    loadRevealTimersRef.current.clear();
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateLayoutWidth = () => {
      const nextWidth = galleryWaterfallRef.current?.getBoundingClientRect().width
        || gallerySectionRef.current?.getBoundingClientRect().width
        || window.innerWidth
        || 0;
      setLayoutWidth((prev) => (Math.abs(prev - nextWidth) < 1 ? prev : nextWidth));
    };

    updateLayoutWidth();
    window.addEventListener('resize', updateLayoutWidth, { passive: true });

    let resizeObserver;
    if (typeof window.ResizeObserver === 'function' && gallerySectionRef.current) {
      resizeObserver = new window.ResizeObserver(updateLayoutWidth);
      resizeObserver.observe(gallerySectionRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateLayoutWidth);
      resizeObserver?.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    if (isLoading) return;
    if (filteredItems.length === 0) {
      setVisibleCount(0);
      return;
    }

    const nextVisibleCount = getAdaptiveInitialVisibleCount(
      filteredItems.length,
      gallerySectionRef.current,
      galleryWaterfallRef.current
    );
    setVisibleCount(nextVisibleCount);
  }, [filteredItems, isLoading]);

  useLayoutEffect(() => {
    const safeColumnCount = Math.max(1, columnCount);
    const layoutKey = `${selectedCategory}:${safeColumnCount}:${filteredItems.length}:${filteredItems[0]?.id || ''}`;
    const shouldResetLayout = columnLayoutKeyRef.current !== layoutKey;

    if (shouldResetLayout) {
      columnLayoutKeyRef.current = layoutKey;
      itemColumnIndexRef.current = new Map();
      assignedItemWeightsRef.current = new Map();
      columnHeightsRef.current = Array.from({ length: safeColumnCount }, () => 0);
    }

    const nextColumns = createWaterfallColumns(safeColumnCount);

    visibleItems.forEach((item, index) => {
      let assignedColumnIndex = itemColumnIndexRef.current.get(item.id);

      if (assignedColumnIndex == null || assignedColumnIndex >= safeColumnCount) {
        assignedColumnIndex = getShortestColumnIndex(columnHeightsRef.current);
        const assignedWeight = itemHeightWeightsRef.current.get(item.id) || DEFAULT_WATERFALL_HEIGHT_WEIGHT;
        itemColumnIndexRef.current.set(item.id, assignedColumnIndex);
        assignedItemWeightsRef.current.set(item.id, assignedWeight);
        columnHeightsRef.current[assignedColumnIndex] += assignedWeight;
      }

      nextColumns[assignedColumnIndex].push({ item, index });
    });

    setWaterfallColumns(nextColumns);
  }, [visibleItems, columnCount, selectedCategory, filteredItems]);

  useEffect(() => {
    if (!hasMoreVisibleItems) return undefined;
    if (typeof window === 'undefined') return undefined;

    const sectionNode = gallerySectionRef.current;
    if (!sectionNode) return undefined;
    const scrollRoot = getScrollRoot(sectionNode);
    const scrollTarget = scrollRoot || window;
    const visibleStep = getAdaptiveVisibleStep(sectionNode, galleryWaterfallRef.current);

    const clearPendingLoad = () => {
      if (!autoLoadTimerRef.current) return;
      window.clearTimeout(autoLoadTimerRef.current);
      autoLoadTimerRef.current = null;
    };

    const scheduleLoadCheck = () => {
      clearPendingLoad();
      autoLoadTimerRef.current = window.setTimeout(() => {
        autoLoadTimerRef.current = null;
        if (!isNearScrollEnd(getScrollMetrics(scrollRoot))) return;
        setVisibleCount((prev) => Math.min(prev + visibleStep, filteredItems.length));
      }, 120);
    };

    const getCurrentScrollTop = () => getScrollMetrics(scrollRoot).scrollTop;

    lastScrollTopRef.current = getCurrentScrollTop();

    const handleScroll = () => {
      const currentScrollTop = getCurrentScrollTop();
      const isScrollingDown = currentScrollTop > lastScrollTopRef.current;
      lastScrollTopRef.current = currentScrollTop;
      if (isScrollingDown) {
        scheduleLoadCheck();
      }
    };

    const handleWheel = (event) => {
      if (event.deltaY > 0) {
        scheduleLoadCheck();
      }
    };

    const handleTouchStart = (event) => {
      touchStartYRef.current = event.touches[0]?.clientY || 0;
    };

    const handleTouchMove = (event) => {
      const currentY = event.touches[0]?.clientY || 0;
      if (touchStartYRef.current - currentY > 8) {
        scheduleLoadCheck();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'PageDown' || event.key === 'ArrowDown' || event.key === 'End' || event.key === ' ') {
        scheduleLoadCheck();
      }
    };

    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearPendingLoad();
      scrollTarget.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [filteredItems.length, hasMoreVisibleItems, visibleCount]);

  const markItemLoaded = useCallback((id, imageNode) => {
    const naturalWidth = imageNode?.naturalWidth || 0;
    const naturalHeight = imageNode?.naturalHeight || 0;
    if (naturalWidth > 0 && naturalHeight > 0) {
      const nextHeightWeight = naturalHeight / naturalWidth;
      itemHeightWeightsRef.current.set(id, nextHeightWeight);

      const assignedColumnIndex = itemColumnIndexRef.current.get(id);
      const previousHeightWeight = assignedItemWeightsRef.current.get(id);
      if (assignedColumnIndex != null
        && previousHeightWeight != null
        && Math.abs(previousHeightWeight - nextHeightWeight) > 0.001) {
        columnHeightsRef.current[assignedColumnIndex] = Math.max(
          0,
          (columnHeightsRef.current[assignedColumnIndex] || 0) - previousHeightWeight + nextHeightWeight
        );
        assignedItemWeightsRef.current.set(id, nextHeightWeight);
      }
    }

    if (loadedItemIdsRef.current.has(id) || loadRevealTimersRef.current.has(id)) return;

    const revealTimerId = window.setTimeout(() => {
      loadRevealTimersRef.current.delete(id);
      setLoadedItemIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }, 56);

    loadRevealTimersRef.current.set(id, revealTimerId);
  }, []);

  const closeLightbox = useCallback(() => {
    setPreviewItemId('');
  }, []);

  const showLightboxItem = useCallback((direction) => {
    setPreviewItemId((currentId) => {
      if (filteredItems.length === 0) return '';
      const currentIndex = filteredItems.findIndex((item) => item.id === currentId);
      const baseIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = (baseIndex + direction + filteredItems.length) % filteredItems.length;
      return filteredItems[nextIndex]?.id || '';
    });
  }, [filteredItems]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (!previewItem) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [previewItem]);

  useEffect(() => {
    if (!previewItem) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLightbox();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showLightboxItem(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        showLightboxItem(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeLightbox, previewItem, showLightboxItem]);

  useEffect(() => {
    if (!previewItem || !hasMultiplePreviewItems || typeof window === 'undefined') return;

    [-1, 1].forEach((offset) => {
      const preloadItem = filteredItems[(previewIndex + offset + filteredItems.length) % filteredItems.length];
      if (!preloadItem?.url) return;
      const image = new window.Image();
      image.src = preloadItem.url;
    });
  }, [filteredItems, hasMultiplePreviewItems, previewIndex, previewItem]);

  const handleLightboxTouchStart = useCallback((event) => {
    lightboxTouchStartXRef.current = event.touches[0]?.clientX || 0;
  }, []);

  const handleLightboxTouchEnd = useCallback((event) => {
    const nextX = event.changedTouches[0]?.clientX || 0;
    const deltaX = nextX - lightboxTouchStartXRef.current;
    if (Math.abs(deltaX) < 44) return;
    showLightboxItem(deltaX > 0 ? -1 : 1);
  }, [showLightboxItem]);

  const lightbox = previewItem && typeof document !== 'undefined'
    ? createPortal(
      <div
        className="gallery-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="图片预览"
        onClick={closeLightbox}
      >
        <div className="gallery-lightbox-backdrop" />
        <div
          className="gallery-lightbox-panel"
          onClick={(event) => event.stopPropagation()}
          onTouchStart={handleLightboxTouchStart}
          onTouchEnd={handleLightboxTouchEnd}
        >
          <div className="gallery-lightbox-header">
            <div className="gallery-lightbox-meta">
              <span className="gallery-lightbox-category">{previewItem.category}</span>
              <strong>{previewItem.name || '图库图片'}</strong>
              <span>{previewIndex + 1} / {filteredItems.length}</span>
            </div>
            <div className="gallery-lightbox-header-actions">
              <button
                type="button"
                className="gallery-lightbox-icon-btn"
                onClick={closeLightbox}
                aria-label="关闭预览"
                title="关闭"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="gallery-lightbox-stage">
            <button
              type="button"
              className="gallery-lightbox-nav is-prev"
              onClick={() => showLightboxItem(-1)}
              disabled={!hasMultiplePreviewItems}
              aria-label="上一张"
            >
              <ChevronLeft size={28} />
            </button>
            <img src={previewItem.url} alt={previewItem.name || '预览图片'} />
            <button
              type="button"
              className="gallery-lightbox-nav is-next"
              onClick={() => showLightboxItem(1)}
              disabled={!hasMultiplePreviewItems}
              aria-label="下一张"
            >
              <ChevronRight size={28} />
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
    : null;

  return (
    <>
      <div className="gallery-page gallery-browser-page">
        {error && (
          <section className="gallery-readonly-card gallery-error-card" aria-label="图库加载错误">
            <div>{error}</div>
            <button
              type="button"
              className="gallery-btn ghost"
              onClick={() => {
                void loadImages({ forceRefresh: true });
              }}
              disabled={isLoading}
            >
              <RefreshCw size={16} />
              重新加载
            </button>
          </section>
        )}

        <section ref={gallerySectionRef} className="gallery-list-card" aria-label="瀑布流图库">
          <div className="gallery-toolbar">
            <div className="gallery-list-header">
              <div className="gallery-title-row">
                <h2>影像集</h2>
              </div>
            </div>

            {!isLoading && categoryStats.length > 0 && (
              <div className="gallery-category-bar" aria-label="分类筛选">
                {categoryStats.map((category) => (
                  <button
                    key={category.name}
                    type="button"
                    className={`gallery-category-btn ${selectedCategory === category.name ? 'is-active' : ''}`}
                    onClick={() => setSelectedCategory(category.name)}
                  >
                    {category.name}
                    <span>{category.count}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className={`gallery-category-btn ${selectedCategory === ALL_CATEGORY ? 'is-active' : ''}`}
                  onClick={() => setSelectedCategory(ALL_CATEGORY)}
                >
                  全部
                  <span>{items.length}</span>
                </button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="gallery-loading-state">
              <div className="gallery-browser-loading">
                <LoaderCircle size={18} className="gallery-spin" />
                加载图库中...
              </div>
              <div className="gallery-loading-grid" aria-hidden="true">
                {Array.from({ length: LOADING_PLACEHOLDER_COUNT }, (_, index) => (
                  <span key={`gallery-loading-${index}`} className="gallery-loading-card" />
                ))}
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="gallery-empty-state">
              <ImagePlus size={22} />
              {items.length === 0
                ? '暂无图片，请先更新并发布图片索引。'
                : `分类「${selectedCategory}」暂无图片。`}
            </div>
          ) : (
            <div
              ref={galleryWaterfallRef}
              className="gallery-waterfall"
              style={{
                '--gallery-column-count': columnCount,
                '--gallery-column-gap': `${columnGap}px`
              }}
            >
              {waterfallColumns.map((columnItems, columnIndex) => (
                <div
                  key={`gallery-column-${columnIndex}`}
                  className="gallery-waterfall-column"
                >
                  {columnItems.map(({ item, index }) => {
                    const isLoaded = loadedItemIds.has(item.id);
                    const delay = (index % 12) * 24;
                    return (
                      <figure
                        key={item.id}
                        className={`gallery-waterfall-item ${isLoaded ? 'is-loaded' : ''}`}
                        style={{ '--stagger-delay': `${delay}ms` }}
                      >
                        <button
                          type="button"
                          className="gallery-waterfall-preview"
                          onClick={() => setPreviewItemId(item.id)}
                          aria-label={`查看图片：${item.name || item.category}`}
                          title="查看图片"
                        >
                          <span className="gallery-waterfall-skeleton" aria-hidden="true" />
                          <img
                            src={item.previewUrl}
                            alt="图库图片"
                            loading="lazy"
                            className={isLoaded ? 'is-loaded' : ''}
                            onLoad={(event) => markItemLoaded(item.id, event.currentTarget)}
                            onError={() => markItemLoaded(item.id)}
                          />
                          <span className="gallery-waterfall-overlay" aria-hidden="true">
                            <span className="gallery-waterfall-overlay-top">
                              <span>{item.category}</span>
                              <span>{index + 1} / {filteredItems.length}</span>
                            </span>
                            <span className="gallery-waterfall-overlay-name">{item.name || '图库图片'}</span>
                          </span>
                        </button>
                      </figure>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {!isLoading && filteredItems.length > 0 && hasMoreVisibleItems && (
            <div className="gallery-load-progress" aria-live="polite">
              <span style={{ '--gallery-load-progress': `${visibleProgress}%` }} />
              <p>{visibleItems.length} / {filteredItems.length}</p>
            </div>
          )}

          {!isLoading && filteredItems.length > 0 && !hasMoreVisibleItems && (
            <p className="gallery-list-end">已加载全部</p>
          )}

        </section>
      </div>

      {lightbox}
    </>
  );
};

export default GalleryDisplayPage;
