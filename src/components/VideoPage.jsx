import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Folder, Play, X, CornerUpLeft, ChevronDown, ChevronLeft, ChevronRight, Share2, MessageSquareMore } from 'lucide-react';

import '../styles/video.css';
import { useVideoCatalog } from '../hooks/useVideoCatalog.js';
import { useVideoComments } from '../hooks/useVideoComments.js';
import { useVideoPlayback } from '../hooks/useVideoPlayback.js';
import { buildVideoKey } from '../utils/videoPageUtils.js';
import SearchHeader from './SearchHeader';
import CommentSection from './CommentSection.jsx';

const VideoCard = ({ item, onClick, meta }) => {
  const [thumbError, setThumbError] = useState(false);
  const [loadedThumbSrc, setLoadedThumbSrc] = useState('');
  const hasThumb = Boolean(item.thumb) && !thumbError;
  const thumbSrc = hasThumb ? item.thumb : '';
  const thumbLoaded = hasThumb && loadedThumbSrc === thumbSrc;

  return (
    <Motion.button
      type="button"
      className={`video-card ${item.isFolder || item.folderId ? 'is-folder' : ''}`}
      onClick={onClick}
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

const VideoPage = ({ requestVideoView, onShareVideo, commentServerURL, locationSearch, onInitialReady }) => {
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
  } = useVideoCatalog({
    locationSearch,
    onInitialReady,
    requestVideoView
  });

  const {
    playerRef,
    stageMainRef,
    stageMainHeight,
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
    nextWatchEpisode,
    prevWatchEpisode,
    setActiveVideo
  });

  const {
    closeCommentDrawer,
    currentVideoCommentPath,
    canOpenCommentDrawer,
    shouldRenderVideoCommentDrawer,
    handleOpenVideoComment
  } = useVideoComments({
    activeVideo,
    activeVideoKey,
    commentServerURL,
    watchCategory
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

  const renderVideoGrid = () => (
    showBackCard || displayedItems.length > 0 ? (
      <div className="video-grid">
        {showBackCard && <BackCard onClick={handleBackFolder} />}
        {displayedItems.map((item) => (
          <VideoCard
            key={item.id}
            item={item}
            onClick={() => handleCardClick(item)}
            meta={isSearching ? item._pathLabel : ''}
          />
        ))}
      </div>
    ) : (
      <div className="video-empty">暂无视频内容</div>
    )
  );

  return (
    <div className={`video-page ${isWatching ? 'is-watching' : ''}`}>
      <SearchHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        title=""
        subtitle=""
        placeholder="搜索视频、分类..."
      />

      {isSearching && renderVideoGrid()}
      {!isSearching && !isWatching && isCatalogLoading && (
        <div className="page-loading page-loading-spinner" role="status" aria-live="polite">
          <span className="page-loading-ring" aria-hidden="true" />
          <span>加载中...</span>
        </div>
      )}

      {!isSearching && !isWatching && !isCatalogLoading && catalogLoadError && (
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

      {!isSearching && !isWatching && !isCatalogLoading && !catalogLoadError && (
        <div className="video-toolbar">
          <div className="video-tabs" role="tablist" aria-label="视频分类">
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
        </div>
      )}

      {isWatching && (
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
                    className="video-stage-close"
                    onClick={() => setActiveVideo(null)}
                    aria-label="收起播放器"
                  >
                    <X size={20} />
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
              <div className="video-stage-main" ref={stageMainRef}>
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
                <div className="video-stage-main-controls">
                  <div className="video-stage-main-controls-nav">
                    <button
                      type="button"
                      className="video-stage-nav-btn"
                      onClick={() => handleSelectWatchEpisode(prevWatchEpisode)}
                      disabled={!prevWatchEpisode}
                      aria-label="上一集"
                      title="上一集"
                    >
                      <Play size={20} fill="currentColor" style={{ transform: 'rotate(180deg)', marginRight: '-6px' }} />
                      <Play size={20} fill="currentColor" style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <button
                      type="button"
                      className="video-stage-nav-btn"
                      onClick={() => handleSelectWatchEpisode(nextWatchEpisode)}
                      disabled={!nextWatchEpisode}
                      aria-label="下一集"
                      title="下一集"
                    >
                      <Play size={20} fill="currentColor" style={{ marginRight: '-6px' }} />
                      <Play size={20} fill="currentColor" />
                    </button>
                  </div>
                  <div className="video-stage-main-controls-actions">
                    <button
                      type="button"
                      className="video-stage-comment-btn"
                      onClick={handleOpenVideoComment}
                      aria-label="打开评论页"
                      disabled={!canOpenCommentDrawer}
                    >
                      <MessageSquareMore size={18} />
                    </button>
                    <button
                      type="button"
                      className="video-stage-share-btn"
                      onClick={handleShareCurrentVideo}
                      aria-label="分享当前视频"
                    >
                      <Share2 size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <aside
                className={`video-watch-sidebar ${stageMainHeight > 0 ? 'is-measured' : ''}`}
                style={stageMainHeight > 0 ? { height: `${stageMainHeight}px` } : undefined}
              >
                <div className="video-watch-episodes">
                  {watchEpisodes.length === 0 ? (
                    <div className="video-watch-empty">当前分类暂无可播放视频</div>
                  ) : (
                    watchEpisodeGroups.map((group) => {
                      const isExpanded = group.isDirect || expandedWatchGroups.has(group.key);

                      return (
                        <section key={`watch-group-${group.key}`} className="video-watch-group">
                          {!group.isDirect && (
                            <button
                              type="button"
                              className={`video-watch-group-toggle ${isExpanded ? 'is-expanded' : ''}`}
                              onClick={() => handleToggleWatchGroup(group.key)}
                              aria-expanded={isExpanded}
                            >
                              <span className="video-watch-group-label">{group.label}</span>
                              <span className="video-watch-group-count">{group.items.length} 集</span>
                              <ChevronDown size={14} className="video-watch-group-icon" />
                            </button>
                          )}

                          {isExpanded && (
                            <div className={`video-watch-group-items ${group.isDirect ? 'is-direct' : ''}`}>
                              {group.items.map((item, index) => {
                                const itemKey = buildVideoKey(item);
                                const isActiveEpisode = itemKey === activeVideoKey;

                                return (
                                  <button
                                    key={`watch-episode-${item.id}-${index}`}
                                    type="button"
                                    className={`video-watch-episode ${isActiveEpisode ? 'active' : ''}`}
                                    onClick={() => handleSelectWatchEpisode(item)}
                                    ref={isActiveEpisode ? activeEpisodeRef : null}
                                  >
                                    <span className="video-watch-episode-index">
                                      {String(index + 1).padStart(2, '0')}
                                    </span>
                                    <span className="video-watch-episode-texts">
                                      <span className="video-watch-episode-title">{item.title}</span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </section>
                      );
                    })
                  )}
                </div>
              </aside>
              <div className="video-stage-categories-wrap">
                <button
                  type="button"
                  className="video-stage-categories-nav"
                  onClick={() => handleScrollStageCategories(-1)}
                  disabled={!stageCategoriesScrollState.canLeft}
                  aria-label="向左查看分类"
                >
                  <ChevronLeft size={16} />
                </button>
                <div
                  className="video-stage-categories"
                  role="tablist"
                  aria-label="看片分类"
                  ref={stageCategoriesRef}
                  onWheel={handleStageCategoriesWheel}
                >
                  {videoCategories.map((cat) => (
                    <button
                      key={`watch-${cat.id}`}
                      type="button"
                      className={`video-stage-category ${watchCategory === cat.id ? 'active' : ''}`}
                      onClick={() => handleSelectWatchCategory(cat.id)}
                      aria-pressed={watchCategory === cat.id}
                    >
                      <span>{cat.name}</span>
                      <span className="video-stage-category-count">{categoryVideoCounts[cat.id] || 0}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="video-stage-categories-nav"
                  onClick={() => handleScrollStageCategories(1)}
                  disabled={!stageCategoriesScrollState.canRight}
                  aria-label="向右查看分类"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            {showWangGuoCredit && (
              <div className="video-stage-credit">视频来自WANGUO</div>
            )}
          </Motion.section>
        </div>
      )}

      {!isSearching && !isWatching && !isCatalogLoading && !catalogLoadError && renderVideoGrid()}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {shouldRenderVideoCommentDrawer ? (
            <>
              <Motion.button
                type="button"
                className="video-comment-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={closeCommentDrawer}
                aria-label="关闭视频评论抽屉"
              />
              <Motion.aside
                className="video-comment-drawer"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'tween', duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="video-comment-drawer-header">
                  <div className="video-comment-drawer-texts">
                    <h3>视频评论</h3>
                    <p>{activeVideo?.title || ''}</p>
                  </div>
                  <button
                    type="button"
                    className="video-comment-close"
                    onClick={closeCommentDrawer}
                    aria-label="关闭视频评论抽屉"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="video-comment-drawer-body">
                  <CommentSection
                    serverURL={commentServerURL}
                    path={currentVideoCommentPath}
                    title=""
                    subtitle=""
                  />
                </div>
              </Motion.aside>
            </>
          ) : null}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default VideoPage;
