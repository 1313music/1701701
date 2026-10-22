import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { ChevronUp } from 'lucide-react';

import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import AlbumGrid from './components/AlbumGrid';
import SearchHeader from './components/SearchHeader';
import AnnouncementTrigger from './components/AnnouncementTrigger.jsx';
import AnnouncementModal from './components/AnnouncementModal.jsx';
import VideoAccessModal from './components/VideoAccessModal.jsx';
import StatePanel from './components/StatePanel.jsx';
import { refreshVideoCatalog } from './data/videoManifest.js';
import { refreshGalleryItems } from './data/galleryManifest.js';
import { refreshDownloadSections } from './data/downloadManifest.js';
import { useAudioPlayer } from './hooks/useAudioPlayer.jsx';
import { useAnnouncement } from './hooks/useAnnouncement.js';
import { useAudioPlaybackShortcuts } from './hooks/useAudioPlaybackShortcuts.js';
import { useAppShell } from './hooks/useAppShell.js';
import { useLibraryState } from './hooks/useLibraryState.js';
import { useSeoMeta } from './hooks/useSeoMeta.js';
import { useSharePanel } from './hooks/useSharePanel.js';
import { useTheme } from './hooks/useTheme.js';
import { useToast } from './hooks/useToast.js';
import { useVideoAccess } from './hooks/useVideoAccess.js';
import { getAlbumMiniProgram } from './data/miniProgramAlbums.js';
import { resolveMusicShareTarget } from './utils/musicShareUtils.js';
import {
  FAVORITES_ALBUM_ID,
  buildAllSiteSequentialAlbum,
  buildAllSiteShuffleAlbum,
  buildFavoritesAlbum,
  buildRandomMixAlbum,
  buildRecentlyPlayedAlbum
} from './utils/randomMixUtils.js';
import {
  addRecentlyPlayedId,
  clearRecentlyPlayedIds,
  loadRecentlyPlayedIds,
  saveRecentlyPlayedIds
} from './utils/recentlyPlayedUtils.js';
import { isVirtualAlbumQueryMatch } from './utils/virtualAlbumsConfig.js';
import {
  APP_READY_EVENT,
  getPathForView,
  SITE_URL,
  WALINE_SERVER_URL
} from './utils/appShellConfig.js';
import { SHOW_DOWNLOAD_PAGE, SHOW_RESOURCES_PAGE } from './utils/featureFlags.js';
import { createViewComponent } from './utils/viewChunks.js';

const LyricsOverlay = lazy(() => import('./components/LyricsOverlay.jsx'));
const AlbumListOverlay = lazy(() => import('./components/AlbumListOverlay.jsx'));
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage.jsx'));
// 各页面的代码统一由 viewChunks 管理：切视图前会先预取，
// 预取好了这里就能同步渲染，扫掠揭开的是真页面而不是「加载中」占位
const VideoPage = createViewComponent('video');
const DownloadPage = createViewComponent('download');
const ResourcesPage = createViewComponent('resources');
const NanjingLizhiArchivePage = createViewComponent('archive');
const GalleryDisplayPage = createViewComponent('gallery');
const AboutPage = createViewComponent('about');
const AppPage = createViewComponent('app');
const SupportPage = createViewComponent('support');
const AdminPage = createViewComponent('admin');
const CommentPage = createViewComponent('comment');

const EMPTY_ANNOUNCEMENT = {
  id: 'empty-announcement',
  enabled: true,
  title: '站点公告',
  content: '暂无新的公告。',
  type: 'info',
  force: false,
  confirmText: '我知道了'
};

const App = () => {
  const hasSignaledBootReadyRef = useRef(false);
  const sharedTargetRef = useRef(null);
  const [isEmptyAnnouncementOpen, setIsEmptyAnnouncementOpen] = useState(false);
  const [randomMixVersion, setRandomMixVersion] = useState(0);
  const [panelVirtualAlbum, setPanelVirtualAlbum] = useState(null);
  // 留言板第一次打开后就常驻，切走只隐藏、不卸载，切回来不会重新请求
  const [hasVisitedComment, setHasVisitedComment] = useState(false);

  const {
    toastMessage,
    isToastVisible,
    toastTone,
    toastPlacement,
    showToast
  } = useToast();
  const {
    announcement,
    announcementHistory,
    hasActiveAnnouncement,
    isAnnouncementOpen,
    isAnnouncementUnread,
    dismissAnnouncement,
    openAnnouncement
  } = useAnnouncement();

  const {
    themePreference,
    resolvedTheme,
    showViewportDebug,
    viewportDebug,
    handleThemeToggle
  } = useTheme({ showToast });

  const {
    isVideoAccessOpen,
    videoPassword,
    setVideoPassword,
    videoPasswordError,
    setVideoPasswordError,
    videoAccessConfig,
    closeVideoAccessModal,
    requestVideoView,
    submitVideoAccess
  } = useVideoAccess();

  const {
    musicAlbums,
    isMusicLoading,
    refreshMusicAlbums,
    musicLoadError,
    selectedAlbum,
    setSelectedAlbum,
    searchQuery,
    setSearchQuery,
    songIndex,
    tempPlaylistIds,
    tempPlaylistItems,
    tempPlaylistSet,
    toggleTempSong,
    addTempSong,
    toggleAlbumFavorites,
    clearTempPlaylist,
    filteredAlbums,
    songSuggestions
  } = useLibraryState({ showToast });

  const {
    currentTrack,
    setCurrentTrack,
    currentAlbum,
    setCurrentAlbum,
    isPlaying,
    setIsPlaying,
    volume,
    isMuted,
    progress,
    currentTime,
    duration,
    lyrics,
    currentLyricIndex,
    currentLyricText,
    isTrackNameOverflowing,
    trackNameRef,
    audioRef,
    currentSongInfo,
    trackChangeId,
    sleepTimerRemainingMs,
    handleVolumeChange,
    toggleMuted,
    handlePlayPause,
    handleSeek,
    handlePrev,
    handleNext,
    playSongFromAlbum,
    pausePlayback,
    startSleepTimer,
    cancelSleepTimer,
    togglePlayMode,
    getPlayModeIcon
  } = useAudioPlayer({
    musicAlbums,
    songIndex
  });

  const randomMixAlbum = useMemo(
    () => {
      void randomMixVersion;
      return buildRandomMixAlbum(musicAlbums);
    },
    [musicAlbums, randomMixVersion]
  );

  const favoriteAlbum = useMemo(
    () => buildFavoritesAlbum(tempPlaylistItems),
    [tempPlaylistItems]
  );

  const [recentlyPlayedIds, setRecentlyPlayedIds] = useState(() => loadRecentlyPlayedIds());
  const recentlyPlayedItems = useMemo(
    () => recentlyPlayedIds.map((id) => songIndex.get(id)).filter(Boolean),
    [songIndex, recentlyPlayedIds]
  );
  const recentlyPlayedAlbum = useMemo(
    () => buildRecentlyPlayedAlbum(recentlyPlayedItems),
    [recentlyPlayedItems]
  );

  const clearRecentlyPlayed = useCallback(() => {
    setRecentlyPlayedIds((prev) => clearRecentlyPlayedIds(prev).nextIds);
  }, []);

  useEffect(() => {
    const src = currentTrack?.src;
    if (!src) return;
    // 等当前渲染提交后再写入，避免“在 effect 里同步 setState”被规则拦截；
    // 记录最近播放本质是“currentTrack 变化”的副作用，不适合放到渲染期计算。
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setRecentlyPlayedIds((prev) => addRecentlyPlayedId(prev, src).nextIds);
      }
    });
    return () => { cancelled = true; };
  }, [currentTrack?.src]);

  useEffect(() => {
    saveRecentlyPlayedIds(recentlyPlayedIds);
  }, [recentlyPlayedIds]);

  const displayedAlbums = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const shouldShowRandomMix = isVirtualAlbumQueryMatch('randomMix', normalizedQuery);
    const shouldShowFavoriteAlbum = isVirtualAlbumQueryMatch('favorites', normalizedQuery, {
      songNameMatch: favoriteAlbum.songs.some((song) => (
        song.name?.toLowerCase().includes(normalizedQuery)
        || song.sourceAlbumName?.toLowerCase().includes(normalizedQuery)
      ))
    });
    const shouldShowRecentlyPlayed = isVirtualAlbumQueryMatch('recentlyPlayed', normalizedQuery, {
      songNameMatch: recentlyPlayedAlbum?.songs?.some((song) => (
        song.name?.toLowerCase().includes(normalizedQuery)
        || song.sourceAlbumName?.toLowerCase().includes(normalizedQuery)
      ))
    });
    const virtualAlbums = [];
    if (randomMixAlbum?.songs?.length && shouldShowRandomMix) {
      virtualAlbums.push(randomMixAlbum);
    }
    if (favoriteAlbum && shouldShowFavoriteAlbum) {
      virtualAlbums.push(favoriteAlbum);
    }
    if (recentlyPlayedAlbum?.songs?.length && shouldShowRecentlyPlayed) {
      virtualAlbums.push(recentlyPlayedAlbum);
    }
    return [...virtualAlbums, ...filteredAlbums];
  }, [favoriteAlbum, filteredAlbums, randomMixAlbum, recentlyPlayedAlbum, searchQuery]);
  const panelAlbumOverride = selectedAlbum?.id === randomMixAlbum?.id
    ? panelVirtualAlbum
    : null;

  const refreshRandomMix = useCallback(() => {
    setPanelVirtualAlbum(null);
    setRandomMixVersion((version) => version + 1);
  }, []);

  const playVirtualAlbum = useCallback((album, options = {}) => {
    const firstSong = album?.songs?.[0];
    if (!album?.songs?.length || !firstSong?.src) return;
    setCurrentAlbum(album);
    setCurrentTrack(firstSong);
    setIsPlaying(true);
    if (options.showInPanel) {
      setPanelVirtualAlbum(album);
    }
  }, [setCurrentAlbum, setCurrentTrack, setIsPlaying]);

  const playAllSiteShuffle = useCallback(() => {
    playVirtualAlbum(buildAllSiteShuffleAlbum(musicAlbums), { showInPanel: true });
  }, [musicAlbums, playVirtualAlbum]);

  const playAllSiteSequential = useCallback(() => {
    playVirtualAlbum(buildAllSiteSequentialAlbum(musicAlbums), { showInPanel: true });
  }, [musicAlbums, playVirtualAlbum]);

  const {
    view,
    locationSearch,
    handleViewChange,
    replaceLocationSearch,
    isLyricsOpen,
    lyricsOverlaySessionId,
    playerOverlayContextId,
    isAlbumListOpen,
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    hasLyricsOverlayLoaded,
    hasAlbumListOverlayLoaded,
    setLyricsOverlayOpen,
    setAlbumListOverlayOpen,
    lyricsCommentRequest,
    openCurrentTrackComments,
    showBackToTop,
    handleBackToTop
  } = useAppShell({
    currentTrackSrc: currentTrack?.src,
    pausePlayback,
    trackChangeId
  });

  useSeoMeta({ view, musicAlbums });

  // 留言板一旦打开过就记住，之后切到别的页面只隐藏不卸载，
  // 这样切回来是原样的 DOM（Waline 实例还在），不会再走一次请求。
  useEffect(() => {
    if (view === 'comment') setHasVisitedComment(true);
  }, [view]);

  useEffect(() => {
    if (musicAlbums.length === 0) return;
    const resolvedShareTarget = resolveMusicShareTarget(musicAlbums, locationSearch);
    if (!resolvedShareTarget) return;
    const isSameTrack = Boolean(
      currentTrack?.src
      && resolvedShareTarget.track?.src
      && currentTrack.src === resolvedShareTarget.track.src
    );
    const isSameAlbum = Boolean(
      currentAlbum?.id
      && resolvedShareTarget.album?.id
      && currentAlbum.id === resolvedShareTarget.album.id
    );
    if (isSameTrack && isSameAlbum) {
      sharedTargetRef.current = {
        albumId: resolvedShareTarget.album.id,
        trackSrc: resolvedShareTarget.track.src
      };
      return;
    }
    sharedTargetRef.current = {
      albumId: resolvedShareTarget.album.id,
      trackSrc: resolvedShareTarget.track.src
    };

    const timerId = window.setTimeout(() => {
      setSelectedAlbum(resolvedShareTarget.album);
      setCurrentAlbum(resolvedShareTarget.album);
      setCurrentTrack(resolvedShareTarget.track);
      setIsPlaying(false);
      setLyricsOverlayOpen(true);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [
    currentAlbum,
    currentTrack,
    locationSearch,
    musicAlbums,
    setCurrentAlbum,
    setCurrentTrack,
    setIsPlaying,
    setLyricsOverlayOpen,
    setSelectedAlbum
  ]);

  useEffect(() => {
    if (view !== 'library') return;
    const sharedTarget = sharedTargetRef.current;
    if (!sharedTarget) return;
    if (!currentTrack?.src || !currentAlbum?.id) return;
    const hasShareParams = Boolean(locationSearch && /[?&](?:albumId|a)=/.test(locationSearch));
    if (!hasShareParams) {
      sharedTargetRef.current = null;
      return;
    }
    const isStillSharedTrack = (
      sharedTarget.trackSrc === currentTrack.src
      && sharedTarget.albumId === currentAlbum.id
    );
    if (isStillSharedTrack) return;
    replaceLocationSearch('', { view: 'library', historyMode: 'replace' });
    sharedTargetRef.current = null;
  }, [currentAlbum, currentTrack, locationSearch, replaceLocationSearch, view]);

  const playFavorites = (song) => {
    if (!favoriteAlbum || favoriteAlbum.songs.length === 0) return;

    const target = song
      ? favoriteAlbum.songs.find((item) => item.src === song.src)
      : favoriteAlbum.songs[0];
    const nextTrack = target || favoriteAlbum.songs[0];

    const isSameTrack = Boolean(currentTrack?.src) && currentTrack.src === nextTrack.src;
    const isInFavoritesAlbum = currentAlbum?.id === favoriteAlbum.id;

    if (song && isInFavoritesAlbum && isSameTrack) {
      setIsPlaying((prev) => !prev);
      return;
    }

    setCurrentAlbum(favoriteAlbum);
    setCurrentTrack(nextTrack);
    setIsPlaying(true);
  };

  const handleVideoAccessSubmit = useCallback(() => {
    submitVideoAccess();
  }, [submitVideoAccess]);

  const handleVideoPasswordChange = useCallback((value) => {
    setVideoPassword(value);
    setVideoPasswordError('');
  }, [setVideoPassword, setVideoPasswordError]);

  const buildCurrentSharePayload = useCallback(() => {
    if (!currentTrack?.src || typeof window === 'undefined') return null;
    const resolvedAlbum = (currentAlbum?.id === FAVORITES_ALBUM_ID || currentAlbum?.isVirtual) && currentSongInfo?.album
      ? currentSongInfo.album
      : currentAlbum;
    if (!resolvedAlbum?.id || !Array.isArray(resolvedAlbum.songs) || resolvedAlbum.songs.length === 0) {
      return null;
    }
    let matchedIndex = resolvedAlbum.songs.findIndex((song) => song.src === currentTrack.src);
    if (matchedIndex === -1 && currentSongInfo?.song?.src) {
      matchedIndex = resolvedAlbum.songs.findIndex((song) => song.src === currentSongInfo.song.src);
    }
    if (matchedIndex === -1) matchedIndex = 0;
    const shareTrack = resolvedAlbum.songs[matchedIndex] || currentTrack;
    const miniProgram = getAlbumMiniProgram(resolvedAlbum.id);
    // 分享链接走短参数：卡片上的二维码要承载它，短 24 个字符能让码从 37×37 降到 29×29。
    // 旧的 albumId / songId / song 参数仍然解析（见 resolveMusicShareTarget），老链接不会失效。
    const url = new URL(getPathForView('library'), window.location.origin);
    url.searchParams.set('a', String(resolvedAlbum.id));
    url.searchParams.set('s', String(matchedIndex + 1));
    return {
      type: 'music',
      panelTitle: '分享歌曲',
      title: `${shareTrack.name} - ${resolvedAlbum.artist || '李志'}`,
      text: shareTrack.name,
      url: url.toString(),
      trackName: shareTrack.name,
      albumName: resolvedAlbum.name,
      artistName: resolvedAlbum.artist || '李志',
      cover: shareTrack.cover || resolvedAlbum.cover || '',
      miniProgram
    };
  }, [currentAlbum, currentSongInfo, currentTrack]);

  const {
    sharePanelData,
    shareCardDataUrl,
    isShareCardGenerating,
    closeSharePanel,
    handleCopyShareLink,
    handleShareCardImage,
    handleShareCurrentTrack,
    handleShareVideo
  } = useSharePanel({
    getCurrentTrackSharePayload: buildCurrentSharePayload,
    showToast
  });

  const handleSelectAlbum = useCallback((album) => {
    setPanelVirtualAlbum(null);
    setSelectedAlbum((prev) => (prev && prev.id === album.id ? null : album));
    setIsSidebarOpen(false);
  }, [setSelectedAlbum, setIsSidebarOpen]);

  const pageLoadingFallback = <StatePanel variant="loading" title="加载中…" />;

  const isLibraryReady = Boolean(currentTrack && currentAlbum && musicAlbums.length > 0);
  const showLibraryLoading = isMusicLoading || (!musicLoadError && musicAlbums.length > 0 && !isLibraryReady);
  const hasPlayerChrome = view !== 'video' && view !== 'admin' && view !== 'archive';
  const shouldShowAnnouncementTrigger = view !== 'admin';

  useAudioPlaybackShortcuts({
    audioRef,
    duration,
    enabled: hasPlayerChrome && isLibraryReady,
    handleNext,
    handlePlayPause,
    handlePrev
  });

  const emptyAnnouncement = useMemo(() => ({
    ...EMPTY_ANNOUNCEMENT,
    title: announcementHistory.length > 0 ? '历史公告' : EMPTY_ANNOUNCEMENT.title,
    content: announcementHistory.length > 0
      ? '暂无新的公告，可查看历史公告。'
      : EMPTY_ANNOUNCEMENT.content
  }), [announcementHistory.length]);
  const displayedAnnouncement = hasActiveAnnouncement ? announcement : emptyAnnouncement;

  const handleOpenAnnouncementTrigger = useCallback(() => {
    if (hasActiveAnnouncement) {
      openAnnouncement();
      return;
    }
    setIsEmptyAnnouncementOpen(true);
  }, [hasActiveAnnouncement, openAnnouncement]);

  const handleConfirmAnnouncement = useCallback(() => {
    if (isEmptyAnnouncementOpen && !hasActiveAnnouncement) {
      setIsEmptyAnnouncementOpen(false);
      return;
    }
    setIsEmptyAnnouncementOpen(false);
    dismissAnnouncement();
  }, [dismissAnnouncement, hasActiveAnnouncement, isEmptyAnnouncementOpen]);

  const [isDataRefreshing, setIsDataRefreshing] = useState(false);
  const handleRefreshAllData = useCallback(async () => {
    if (isDataRefreshing) return;
    setIsDataRefreshing(true);
    try {
      const results = await Promise.allSettled([
        refreshMusicAlbums(),
        refreshVideoCatalog(),
        refreshGalleryItems(),
        refreshDownloadSections()
      ]);
      const failedCount = results.filter((result) => result.status === 'rejected').length;
      showToast(
        failedCount === 0 ? '整站已更新' : '部分内容刷新失败，请稍后重试',
        'tone-add',
        { placement: 'center', duration: 2200 }
      );
    } finally {
      setIsDataRefreshing(false);
    }
  }, [isDataRefreshing, refreshMusicAlbums, showToast]);

  const announcementToolbarActions = shouldShowAnnouncementTrigger ? (
    <AnnouncementTrigger
      announcement={announcement}
      visible={shouldShowAnnouncementTrigger}
      unread={isAnnouncementUnread}
      onOpen={handleOpenAnnouncementTrigger}
      className="desktop-announcement-trigger"
    />
  ) : null;
  const shouldShowFloatingAnnouncementTrigger = (
    shouldShowAnnouncementTrigger
    && view !== 'library'
    && view !== 'video'
  );

  const signalBootReady = useCallback(() => {
    if (hasSignaledBootReadyRef.current || typeof window === 'undefined') return;
    hasSignaledBootReadyRef.current = true;
    window.dispatchEvent(new Event(APP_READY_EVENT));
  }, []);

  useEffect(() => {
    if (view === 'library') {
      if (!showLibraryLoading) {
        signalBootReady();
      }
      return;
    }
    if (
      (SHOW_DOWNLOAD_PAGE && view === 'download')
      || (SHOW_RESOURCES_PAGE && view === 'resources')
      || view === 'video'
    ) {
      return;
    }
    signalBootReady();
  }, [signalBootReady, showLibraryLoading, view]);

  // 重置密码页是独立的整页，不套侧边栏和播放器。
  if (view === 'reset') {
    return (
      <Suspense fallback={<div className="reset-page"><div className="reset-card">加载中…</div></div>}>
        <ResetPasswordPage serverURL={WALINE_SERVER_URL} />
      </Suspense>
    );
  }

  return (
    <>
      <div className={`app-root ${hasPlayerChrome ? '' : 'no-player'} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className={`app-container ${isSidebarOpen ? 'sidebar-open' : ''} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <div className="app-layout">
            <Sidebar
              view={view}
              setView={handleViewChange}
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
              isSidebarCollapsed={isSidebarCollapsed}
              setIsSidebarCollapsed={setIsSidebarCollapsed}
              themePreference={themePreference}
              resolvedTheme={resolvedTheme}
              onThemeToggle={handleThemeToggle}
              announcement={announcement}
              showAnnouncementTrigger={shouldShowAnnouncementTrigger}
              isAnnouncementUnread={isAnnouncementUnread}
              onOpenAnnouncement={handleOpenAnnouncementTrigger}
              onRefreshData={handleRefreshAllData}
              isRefreshingData={isDataRefreshing}
            />

            <main className="main-view">
              {view === 'library' && (
                <div className="view-panel view-panel-library">
                  {showLibraryLoading && pageLoadingFallback}
                  {!showLibraryLoading && musicLoadError && (
                    <StatePanel variant="error" title={musicLoadError} />
                  )}
                  {!showLibraryLoading && !musicLoadError && isLibraryReady && (
                    <>
                      <SearchHeader
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        title=""
                        subtitle=""
                        suggestions={songSuggestions}
                        onSelectSuggestion={(item) => {
                          playSongFromAlbum(item.album, item.song);
                          setSearchQuery(item.song.name);
                        }}
                        actions={announcementToolbarActions}
                      />
                      <AlbumGrid
                        musicAlbums={displayedAlbums}
                        panelAlbumOverride={panelAlbumOverride}
                        navigateToAlbum={handleSelectAlbum}
                        expandedAlbumId={selectedAlbum ? selectedAlbum.id : null}
                        currentTrack={currentTrack}
                        isPlaying={isPlaying}
                        playSongFromAlbum={playSongFromAlbum}
                        tempPlaylistSet={tempPlaylistSet}
                        onToggleTempSong={toggleTempSong}
                        onToggleAlbumFavorites={toggleAlbumFavorites}
                        onClearTempPlaylist={clearTempPlaylist}
                        onClearRecentlyPlayed={clearRecentlyPlayed}
                        onRefreshRandomMix={refreshRandomMix}
                        onPlayAllSiteShuffle={playAllSiteShuffle}
                        onPlayAllSiteSequential={playAllSiteSequential}
                      />
                    </>
                  )}
                  {!showLibraryLoading && !musicLoadError && !isLibraryReady && (
                    <StatePanel variant="empty" title="暂无曲库" />
                  )}
                </div>
              )}
              {view === 'video' && (
                <div className="view-panel view-panel-video">
                  <Suspense fallback={pageLoadingFallback}>
                    <VideoPage
                      requestVideoView={requestVideoView}
                      onShareVideo={handleShareVideo}
                      locationSearch={locationSearch}
                      onInitialReady={signalBootReady}
                      toolbarActions={announcementToolbarActions}
                    />
                  </Suspense>
                </div>
              )}
              {SHOW_DOWNLOAD_PAGE && view === 'download' && (
                <div className="view-panel view-panel-download">
                  <Suspense fallback={pageLoadingFallback}>
                    <DownloadPage
                      onInitialReady={signalBootReady}
                    />
                  </Suspense>
                </div>
              )}
              {SHOW_RESOURCES_PAGE && view === 'resources' && (
                <div className="view-panel view-panel-resources">
                  <Suspense fallback={pageLoadingFallback}>
                    <ResourcesPage
                      onInitialReady={signalBootReady}
                    />
                  </Suspense>
                </div>
              )}
              {view === 'archive' && (
                <div className="view-panel view-panel-archive">
                  <Suspense fallback={pageLoadingFallback}>
                    <NanjingLizhiArchivePage
                  />
                  </Suspense>
                </div>
              )}
              {view === 'gallery' && (
                <div className="view-panel view-panel-gallery">
                  <Suspense fallback={pageLoadingFallback}>
                    <GalleryDisplayPage
                  />
                  </Suspense>
                </div>
              )}
              {view === 'about' && (
                <div className="view-panel view-panel-about">
                  <Suspense fallback={pageLoadingFallback}>
                    <AboutPage
                    />
                  </Suspense>
                </div>
              )}
              {view === 'support' && (
                <div className="view-panel view-panel-support">
                  <Suspense fallback={pageLoadingFallback}>
                    <SupportPage
                    />
                  </Suspense>
                </div>
              )}
              {view === 'app' && (
                <div className="view-panel view-panel-about">
                  <Suspense fallback={pageLoadingFallback}>
                    <AppPage
                    />
                  </Suspense>
                </div>
              )}
              {(view === 'comment' || hasVisitedComment) && (
                <div
                  className={`view-panel view-panel-comment${view === 'comment' ? '' : ' is-hidden'}`}
                >
                  <Suspense fallback={pageLoadingFallback}>
                    <CommentPage serverURL={WALINE_SERVER_URL} />
                  </Suspense>
                </div>
              )}
              {view === 'admin' && (
                <div className="view-panel view-panel-admin">
                  <Suspense fallback={pageLoadingFallback}>
                    <AdminPage
                  />
                  </Suspense>
                </div>
              )}
            </main>
          </div>
        </div>

        {showBackToTop && (
          <button
            type="button"
            className={`back-to-top-btn ${hasPlayerChrome ? '' : 'is-no-player'}`}
            onClick={handleBackToTop}
            aria-label="返回顶部"
            title="返回顶部"
          >
            <ChevronUp size={18} strokeWidth={2.4} absoluteStrokeWidth />
          </button>
        )}

        <AnnouncementTrigger
          announcement={announcement}
          visible={shouldShowFloatingAnnouncementTrigger}
          unread={isAnnouncementUnread}
          onOpen={handleOpenAnnouncementTrigger}
        />

        {hasPlayerChrome && isLibraryReady && (
          <>
            <PlayerBar
              currentTrack={currentTrack}
              currentAlbum={currentAlbum}
              isPlaying={isPlaying}
              handlePlayPause={handlePlayPause}
              progress={progress}
              currentTime={currentTime}
              duration={duration}
              handleSeek={handleSeek}
              togglePlayMode={togglePlayMode}
              getPlayModeIcon={getPlayModeIcon}
              handlePrev={handlePrev}
              handleNext={handleNext}
              setIsLyricsOpen={setLyricsOverlayOpen}
              setIsAlbumListOpen={setAlbumListOverlayOpen}
              onToggleFavorite={toggleTempSong}
              isCurrentTrackFavorited={tempPlaylistSet.has(currentTrack?.src)}
              onOpenComments={openCurrentTrackComments}
              onShare={handleShareCurrentTrack}
              isTrackNameOverflowing={isTrackNameOverflowing}
              trackNameRef={trackNameRef}
              currentLyricText={currentLyricText}
              sleepTimerRemainingMs={sleepTimerRemainingMs}
              onStartSleepTimer={startSleepTimer}
              onCancelSleepTimer={cancelSleepTimer}
              volume={volume}
              isMuted={isMuted}
              onVolumeChange={handleVolumeChange}
              onToggleMuted={toggleMuted}
            />

            {hasLyricsOverlayLoaded && (
              <Suspense fallback={null}>
                <LyricsOverlay
                  isLyricsOpen={isLyricsOpen}
                  setIsLyricsOpen={setLyricsOverlayOpen}
                  setIsAlbumListOpen={setAlbumListOverlayOpen}
                  currentTrack={currentTrack}
                  currentAlbum={currentAlbum}
                  isPlaying={isPlaying}
                  handlePlayPause={handlePlayPause}
                  progress={progress}
                  currentTime={currentTime}
                  duration={duration}
                  lyrics={lyrics}
                  currentLyricIndex={currentLyricIndex}
                  handleSeek={handleSeek}
                  togglePlayMode={togglePlayMode}
                  getPlayModeIcon={getPlayModeIcon}
                  handlePrev={handlePrev}
                  handleNext={handleNext}
                  playSongFromAlbum={playSongFromAlbum}
                  audioRef={audioRef}
                  currentSongInfo={currentSongInfo}
                  commentServerURL={WALINE_SERVER_URL}
                  onAddToFavorites={addTempSong}
                  onToggleFavorite={toggleTempSong}
                  isCurrentTrackFavorited={tempPlaylistSet.has(currentTrack?.src)}
                  sleepTimerRemainingMs={sleepTimerRemainingMs}
                  onStartSleepTimer={startSleepTimer}
                  onCancelSleepTimer={cancelSleepTimer}
                  lyricsOverlaySessionId={lyricsOverlaySessionId}
                  playerOverlayContextId={playerOverlayContextId}
                  trackChangeId={trackChangeId}
                  openCommentRequestId={lyricsCommentRequest.id}
                  openCommentRequestTrackSrc={lyricsCommentRequest.trackSrc}
                  openCommentRequestMode={lyricsCommentRequest.mode}
                  openCommentRequestOverlaySessionId={lyricsCommentRequest.overlaySessionId}
                  openCommentRequestTrackChangeId={lyricsCommentRequest.trackChangeId}
                  openCommentRequestViewContextId={lyricsCommentRequest.viewContextId}
                  onShare={handleShareCurrentTrack}
                />
              </Suspense>
            )}

            {hasAlbumListOverlayLoaded && (
              <Suspense fallback={null}>
                <AlbumListOverlay
                  isOpen={isAlbumListOpen}
                  onClose={() => setAlbumListOverlayOpen(false)}
                  album={currentAlbum}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  playSongFromAlbum={playSongFromAlbum}
                  tempPlaylistSet={tempPlaylistSet}
                  tempPlaylistCount={tempPlaylistIds.length}
                  tempPlaylistItems={tempPlaylistItems}
                  onToggleTempSong={toggleTempSong}
                  onToggleAlbumFavorites={toggleAlbumFavorites}
                  onClearTempPlaylist={clearTempPlaylist}
                  onPlayFavorites={playFavorites}
                />
              </Suspense>
            )}
          </>
        )}

        <VideoAccessModal
          isOpen={isVideoAccessOpen}
          onClose={closeVideoAccessModal}
          promptLines={videoAccessConfig.promptLines}
          qrUrl={videoAccessConfig.qrUrl}
          qrAlt={videoAccessConfig.qrAlt}
          passwordNote={videoAccessConfig.passwordNote}
          videoPassword={videoPassword}
          onPasswordChange={handleVideoPasswordChange}
          videoPasswordError={videoPasswordError}
          onSubmit={handleVideoAccessSubmit}
        />

        {sharePanelData && (
          <div className="share-panel-backdrop" onClick={closeSharePanel}>
            <div
              className={`share-panel-card ${sharePanelData.type === 'video' ? 'is-video' : ''}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="share-panel-header">
                <div className="share-panel-title">{sharePanelData.panelTitle || '分享内容'}</div>
                <button
                  type="button"
                  className="share-panel-close-btn"
                  onClick={closeSharePanel}
                  aria-label="关闭分享面板"
                >
                  ×
                </button>
              </div>
              <div className={`share-panel-card-preview ${sharePanelData.type === 'video' ? 'is-video' : ''}`}>
                {isShareCardGenerating && (
                  <div className="share-card-loading">正在生成分享卡片...</div>
                )}
                {!isShareCardGenerating && shareCardDataUrl && (
                  <img loading="lazy" src={shareCardDataUrl} alt="分享卡片预览" />
                )}
                {!isShareCardGenerating && !shareCardDataUrl && (
                  <div className="share-card-loading">暂未生成分享卡片</div>
                )}
              </div>
              <div className="share-panel-url" title={sharePanelData.url}>
                {sharePanelData.url}
              </div>
              <div className="share-panel-actions">
                <button
                  type="button"
                  className="share-panel-btn ghost"
                  onClick={(event) => {
                    handleCopyShareLink({
                      placement: 'side',
                      anchorEvent: { currentTarget: event.currentTarget }
                    });
                  }}
                >
                  复制链接
                </button>
                <button
                  type="button"
                  className="share-panel-btn primary"
                  onClick={handleShareCardImage}
                  disabled={!shareCardDataUrl || isShareCardGenerating}
                >
                  分享卡片
                </button>
              </div>
            </div>
          </div>
        )}

        <AnnouncementModal
          announcement={displayedAnnouncement}
          history={announcementHistory}
          open={isAnnouncementOpen || isEmptyAnnouncementOpen}
          onConfirm={handleConfirmAnnouncement}
        />

      </div>

      <div
        className={`app-toast ${isToastVisible ? 'show' : ''} ${toastTone} ${toastPlacement !== 'anchor' ? `placement-${toastPlacement}` : ''}`}
        role="status"
        aria-live="polite"
      >
        <span className="toast-text">{toastMessage}</span>
      </div>
      {showViewportDebug && viewportDebug && (
        <div className="viewport-debug-panel" aria-live="polite">
          <div className="viewport-debug-title">Viewport Debug</div>
          <div>time: {viewportDebug.time}</div>
          <div>mode: {viewportDebug.mode} / navigator.standalone: {viewportDebug.navStandalone}</div>
          <div>meta viewport: {viewportDebug.viewportMeta}</div>
          <div>inner: {viewportDebug.inner} | client: {viewportDebug.client}</div>
          <div>visualViewport: {viewportDebug.visualViewport}</div>
          <div>scroll: {viewportDebug.scroll}</div>
          <div>safe probe: {viewportDebug.safeProbe}</div>
          <div>safe vars: {viewportDebug.safeVars}</div>
          <div>root class: {viewportDebug.rootClass}</div>
        </div>
      )}
    </>
  );
};

export default App;
