import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Folder, Play, CornerUpLeft, Share2, ChevronLeft, ChevronRight } from 'lucide-react';

import '../styles/video.css';
import { buildVideoDanmakuOptions } from '../data/videoDanmakuConfig.js';
import { useVideoCatalog } from '../hooks/useVideoCatalog.js';
import { useVideoPlayback } from '../hooks/useVideoPlayback.js';
import { buildVideoKey } from '../utils/videoPageUtils.js';
import SearchHeader from './SearchHeader';

const VideoCard = ({ item, onClick, meta, active = false }) => {
  const [thumbError, setThumbError] = useState(false);
  const [loadedThumbSrc, setLoadedThumbSrc] = useState('');
  const hasThumb = Boolean(item.thumb) && !thumbError;
  const thumbSrc = hasThumb ? item.thumb : '';
  const thumbLoaded = hasThumb && loadedThumbSrc === thumbSrc;

  return (
    <Motion.button
      type="button"
      className={`video-card ${item.isFolder || item.folderId ? 'is-folder' : ''} ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className={`video-thumb ${!hasThumb ? 'no-thumb' : ''}`}>
        {hasThumb ? (
          <>
            <div
              className={`video-thumb-placeholder ${thumbLoaded ? 'is-hidden' : ''}`}
              aria-hidden="true"
            >
              <span className="video-thumb-placeholder-title">加载中</span>
            </div>
            <img
              className={`video-thumb-image ${thumbLoaded ? 'is-loaded' : ''}`}
              src={thumbSrc}
              alt={item.title}
              loading="lazy"
              onLoad={() => setLoadedThumbSrc(thumbSrc)}
              onError={() => {
                setThumbError(true);
                setLoadedThumbSrc('');
              }}
            />
            <div className="video-thumb-overlay">
              {item.isFolder || item.folderId ? (
                <Folder size={26} />
              ) : (
                <Play size={28} fill="currentColor" />
              )}
            </div>
          </>
        ) : (
          <div className="video-thumb-text-only">
            <span className="video-thumb-text-main">民谣俱乐部</span>
            <span className="video-thumb-text-site">1701701.xyz</span>
          </div>
        )}
      </div>
      <div className="video-title">{item.title}</div>
      {meta ? <div className="video-meta">{meta}</div> : null}
    </Motion.button>
  );
};

const BackCard = ({ onClick }) => (
  <Motion.button
    type="button"
    className="video-card video-back-card"
    onClick={onClick}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2 }}
  >
    <div className="video-thumb video-thumb-back">
      <CornerUpLeft size={28} />
    </div>
    <div className="video-title">返回上级</div>
  </Motion.button>
);

const VideoPage = ({ requestVideoView, onShareVideo, locationSearch, onInitialReady, toolbarActions }) => {
  const videoTabsRef = useRef(null);
  const [videoTabsScrollState, setVideoTabsScrollState] = useState({
    canLeft: false,
    canRight: false,
    hasOverflow: false
  });
  const {
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
    activeWatchIndex,
    prevWatchEpisode,
    nextWatchEpisode
  } = useVideoCatalog({
    locationSearch,
    onInitialReady,
    requestVideoView
  });

  const danmakuOptions = useMemo(() => buildVideoDanmakuOptions({
    activeVideo,
    watchCategory
  }), [activeVideo, watchCategory]);

  const {
    playerRef,
    isResolving,
    resolveError,
    resolvedUrl,
    resolvedType,
    canPlayInline,
    canSwitchToBackup,
    backupActionLabel,
    playerContainerKey,
    handleSwitchToBackup,
    handleReloadVideo
  } = useVideoPlayback({
    activeVideo,
    activeVideoKey,
    danmakuOptions,
    nextWatchEpisode,
    prevWatchEpisode,
    setActiveVideo
  });

  const handleShareCurrentVideo = (event) => {
    if (typeof onShareVideo !== 'function' || !activeVideo || typeof window === 'undefined') return;

    const shareUrl = new URL('/video', window.location.origin);
    shareUrl.searchParams.set('videoId', String(activeVideo.id || ''));
    if (activeVideo._categoryId) {
      shareUrl.searchParams.set('videoCategory', String(activeVideo._categoryId));
    }

    const categoryLabel = watchCategoryMeta?.name || activeVideo._categoryName || '视频';
    onShareVideo({
      type: 'video',
      panelTitle: '分享视频',
      title: `${activeVideo.title} - ${categoryLabel}`,
      text: activeVideo.title,
      url: shareUrl.toString(),
      trackName: activeVideo.title,
      albumName: categoryLabel,
      artistName: '1701701.xyz',
      cover: activeVideo.thumb || ''
    }, event?.currentTarget ? {
      placement: 'bottom',
      anchorEvent: { currentTarget: event.currentTarget }
    } : undefined);
  };

  const activeMetaLabel = activeVideo?._pathLabel || activeCategoryMeta?.name || '视频';
  const activeEpisodeProgress = activeWatchIndex >= 0
    ? `第 ${activeWatchIndex + 1} / ${watchEpisodes.length} 集`
    : '';
  const showWangGuoCredit = isWatching && (activeVideo?._categoryId || watchCategory) === 'jlpsq1';
  const hasCatalogContent = !isCatalogLoading && !catalogLoadError;
  const hasScrollableVideoTabs = videoTabsScrollState.hasOverflow;

  const updateVideoTabsScrollState = useCallback(() => {
    const node = videoTabsRef.current;
    if (!node) {
      setVideoTabsScrollState((prev) => (
        prev.canLeft || prev.canRight || prev.hasOverflow
          ? { canLeft: false, canRight: false, hasOverflow: false }
          : prev
      ));
      return;
    }

    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    const next = {
      canLeft: node.scrollLeft > 2,
      canRight: maxScrollLeft - node.scrollLeft > 2,
      hasOverflow: maxScrollLeft > 2
    };

    setVideoTabsScrollState((prev) => (
      prev.canLeft === next.canLeft &&
      prev.canRight === next.canRight &&
      prev.hasOverflow === next.hasOverflow
        ? prev
        : next
    ));
  }, []);

  const handleVideoTabsWheel = useCallback((event) => {
    const node = videoTabsRef.current;
    if (!node || node.scrollWidth <= node.clientWidth) return;

    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);
    const delta = absX > absY ? event.deltaX : event.deltaY;
    if (!delta) return;

    const prevScrollLeft = node.scrollLeft;
    node.scrollLeft += delta;
    if (node.scrollLeft !== prevScrollLeft) {
      event.preventDefault();
      updateVideoTabsScrollState();
    }
  }, [updateVideoTabsScrollState]);

  const handleScrollVideoTabs = useCallback((direction) => {
    const node = videoTabsRef.current;
    if (!node) return;

    const step = Math.max(220, Math.round(node.clientWidth * 0.72));
    node.scrollBy({ left: direction * step, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    let frameId = 0;

    const scheduleVideoTabsUpdate = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateVideoTabsScrollState();
      });
    };

    if (isSearching || !hasCatalogContent) {
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        setVideoTabsScrollState((prev) => (
          prev.canLeft || prev.canRight || prev.hasOverflow
            ? { canLeft: false, canRight: false, hasOverflow: false }
            : prev
        ));
      });
      return () => {
        if (frameId) {
          window.cancelAnimationFrame(frameId);
        }
      };
    }

    const node = videoTabsRef.current;
    if (!node) return undefined;

    scheduleVideoTabsUpdate();
    node.addEventListener('scroll', updateVideoTabsScrollState, { passive: true });
    window.addEventListener('resize', updateVideoTabsScrollState);

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => scheduleVideoTabsUpdate());
      observer.observe(node);
    }

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      node.removeEventListener('scroll', updateVideoTabsScrollState);
      window.removeEventListener('resize', updateVideoTabsScrollState);
      observer?.disconnect();
    };
  }, [activeCategory, hasCatalogContent, isSearching, updateVideoTabsScrollState, videoCategories.length]);

  useEffect(() => {
    if (isSearching || !hasCatalogContent) return;
    const frameId = window.requestAnimationFrame(() => {
      const activeTab = videoTabsRef.current?.querySelector('.video-tab.active');
      if (typeof activeTab?.scrollIntoView === 'function') {
        activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      updateVideoTabsScrollState();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeCategory, hasCatalogContent, isSearching, updateVideoTabsScrollState]);

  const renderVideoGrid = () => (
    showBackCard || displayedItems.length > 0 ? (
      <div className="video-grid">
        {showBackCard && <BackCard onClick={handleBackFolder} />}
        {displayedItems.map((item) => {
          const isActiveCard = Boolean(
            activeVideoKey &&
            !(item.isFolder || item.folderId) &&
            buildVideoKey(item) === activeVideoKey
          );

          return (
            <VideoCard
              key={item.id}
              item={item}
              onClick={() => handleCardClick(item)}
              meta={isSearching ? item._pathLabel : ''}
              active={isActiveCard}
            />
          );
        })}
      </div>
    ) : (
      <div className="video-empty">暂无视频内容</div>
    )
  );

  const renderVideoToolbar = () => (
    <div className={`video-toolbar ${hasScrollableVideoTabs ? 'has-scroll' : ''}`}>
      {hasScrollableVideoTabs ? (
        <button
          type="button"
          className="video-tabs-nav"
          onClick={() => handleScrollVideoTabs(-1)}
          disabled={!videoTabsScrollState.canLeft}
          aria-label="向左查看分类"
        >
          <ChevronLeft size={16} />
        </button>
      ) : null}
      <div
        className="video-tabs"
        role="tablist"
        aria-label="视频分类"
        ref={videoTabsRef}
        onWheel={handleVideoTabsWheel}
      >
        {videoCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`video-tab ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => handleSelectCategory(cat.id)}
            aria-pressed={activeCategory === cat.id}
          >
            {cat.name}
          </button>
        ))}
      </div>
      {hasScrollableVideoTabs ? (
        <button
          type="button"
          className="video-tabs-nav"
          onClick={() => handleScrollVideoTabs(1)}
          disabled={!videoTabsScrollState.canRight}
          aria-label="向右查看分类"
        >
          <ChevronRight size={16} />
        </button>
      ) : null}
    </div>
  );

  return (
    <div className={`video-page ${isWatching ? 'is-watching' : ''}`}>
      <SearchHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        title=""
        subtitle=""
        placeholder="搜索视频、分类..."
        actions={toolbarActions}
      />

      {!isSearching && isCatalogLoading && (
        <div className="page-loading page-loading-spinner" role="status" aria-live="polite">
          <span className="page-loading-ring" aria-hidden="true" />
          <span>加载中...</span>
        </div>
      )}

      {!isSearching && !isCatalogLoading && catalogLoadError && (
        <div className="video-empty">
          <div>{catalogLoadError}</div>
          <button
            type="button"
            className="video-unsupported-action"
            onClick={handleRetryCatalog}
          >
            重试加载
          </button>
        </div>
      )}

      {!isSearching && hasCatalogContent && !isWatching && renderVideoToolbar()}

      {isWatching && hasCatalogContent && (
        <div className="video-inline-stage is-active">
          <Motion.section
            className="video-stage-card video-stage-theme-minimal"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="video-stage-header">
              <div className="video-stage-header-top">
                <div className="video-stage-title">{activeVideo.title}</div>
                <div className="video-stage-actions">
                  <button
                    type="button"
                    className="video-stage-share-btn"
                    onClick={handleShareCurrentVideo}
                    aria-label="分享当前视频"
                    title="分享当前视频"
                  >
                    <Share2 size={18} />
                  </button>
                </div>
              </div>
              <div className="video-stage-meta">
                <span>{activeMetaLabel}</span>
                {activeEpisodeProgress ? (
                  <span className="video-stage-progress-chip">{activeEpisodeProgress}</span>
                ) : null}
              </div>
            </div>

            <div className="video-stage-layout">
              <div className="video-stage-main">
                <div className="video-stage-media-shell">
                  {isResolving && (
                    <div className="video-unsupported video-unsupported-inline">解析播放地址中…</div>
                  )}
                  {!isResolving && resolveError && (
                    <div className="video-unsupported video-unsupported-inline">
                      <div>{resolveError}</div>
                      <div className="video-unsupported-actions">
                        {canSwitchToBackup && (
                          <button
                            type="button"
                            className="video-unsupported-action"
                            onClick={handleSwitchToBackup}
                          >
                            {backupActionLabel}
                          </button>
                        )}
                        <button
                          type="button"
                          className="video-unsupported-action"
                          onClick={handleReloadVideo}
                          disabled={isResolving}
                        >
                          重新加载
                        </button>
                      </div>
                    </div>
                  )}
                  {!isResolving && !resolveError && !resolvedUrl && (
                    <div className="video-unsupported video-unsupported-inline">加载中…</div>
                  )}
                  {!isResolving && !resolveError && resolvedUrl && canPlayInline(resolvedUrl, resolvedType) && (
                    <div
                      key={playerContainerKey}
                      ref={playerRef}
                      className="video-stage-player"
                      onContextMenu={(event) => event.preventDefault()}
                    />
                  )}
                  {!isResolving && !resolveError && resolvedUrl && !canPlayInline(resolvedUrl, resolvedType) && (
                    <div className="video-unsupported video-unsupported-inline">当前视频链接暂不支持播放。</div>
                  )}
                </div>
              </div>
            </div>
            {showWangGuoCredit && (
              <div className="video-stage-credit">视频来自WANGUO</div>
            )}
          </Motion.section>
        </div>
      )}

      {!isSearching && hasCatalogContent && isWatching && renderVideoToolbar()}

      {isSearching && renderVideoGrid()}
      {!isSearching && hasCatalogContent && renderVideoGrid()}
    </div>
  );
};

export default VideoPage;
