import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { ChevronUp } from 'lucide-react';

import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import AlbumGrid from './components/AlbumGrid';
import SearchHeader from './components/SearchHeader';
import AnnouncementModal from './components/AnnouncementModal.jsx';
import VideoAccessModal from './components/VideoAccessModal.jsx';
import { useAudioPlayer } from './hooks/useAudioPlayer.jsx';
import { useAnnouncement } from './hooks/useAnnouncement.js';
import { useAppShell } from './hooks/useAppShell.js';
import { useLibraryState } from './hooks/useLibraryState.js';
import { useSeoMeta } from './hooks/useSeoMeta.js';
import { useSharePanel } from './hooks/useSharePanel.js';
import { useTheme } from './hooks/useTheme.js';
import { useToast } from './hooks/useToast.js';
import { useVideoAccess } from './hooks/useVideoAccess.js';
import { getAlbumMiniProgram } from './data/miniProgramAlbums.js';
import { copyTextToClipboard } from './utils/appDomUtils.js';
import { resolveMusicShareTarget } from './utils/musicShareUtils.js';
import {
  APP_READY_EVENT,
  getPathForView,
  SITE_URL,
  WALINE_SERVER_URL,
  WECHAT_OFFICIAL_ACCOUNT_NAME,
  WECHAT_VIDEO_PASSWORD_KEYWORD,
  WECHAT_OFFICIAL_ACCOUNT_QR_URL
} from './utils/appShellConfig.js';

const LyricsOverlay = lazy(() => import('./components/LyricsOverlay.jsx'));
const AlbumListOverlay = lazy(() => import('./components/AlbumListOverlay.jsx'));
const VideoPage = lazy(() => import('./components/VideoPage.jsx'));
const DownloadPage = lazy(() => import('./components/DownloadPage.jsx'));
const GalleryDisplayPage = lazy(() => import('./components/GalleryDisplayPage.jsx'));
const AboutPage = lazy(() => import('./components/AboutPage.jsx'));
const AppPage = lazy(() => import('./components/AppPage.jsx'));
const AdminPage = lazy(() => import('./components/AdminPage.jsx'));
const CommentPage = lazy(() => import('./components/CommentPage.jsx'));

const App = () => {
  const hasSignaledBootReadyRef = useRef(false);
  const sharedTargetRef = useRef(null);
  const [shareMiniProgramVisibleUrl, setShareMiniProgramVisibleUrl] = useState('');

  const {
    toastMessage,
    isToastVisible,
    toastTone,
    toastPlacement,
    showToast
  } = useToast();
  const {
    announcement,
    hasActiveAnnouncement,
    isAnnouncementOpen,
    isAnnouncementUnread,
    dismissAnnouncement,
    openAnnouncement
  } = useAnnouncement();

  const {
    themePreference,
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
    closeVideoAccessModal,
    requestVideoView,
    submitVideoAccess
  } = useVideoAccess();

  const {
    musicAlbums,
    isMusicLoading,
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
    progress,
    currentTime,
    duration,
    lyrics,
    currentLyricIndex,
    isTrackNameOverflowing,
    trackNameRef,
    audioRef,
    currentSongInfo,
    trackChangeId,
    handlePlayPause,
    handleSeek,
    handlePrev,
    handleNext,
    playSongFromAlbum,
    pausePlayback,
    togglePlayMode,
    getPlayModeIcon
  } = useAudioPlayer({
    musicAlbums,
    songIndex
  });

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
    isWeChatBrowserHintOpen,
    closeWeChatBrowserHint,
    showBackToTop,
    handleBackToTop
  } = useAppShell({
    currentTrackSrc: currentTrack?.src,
    pausePlayback,
    trackChangeId
  });

  useSeoMeta({ view, musicAlbums });

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
    setSelectedAlbum
  ]);

  useEffect(() => {
    if (view !== 'library') return;
    const sharedTarget = sharedTargetRef.current;
    if (!sharedTarget) return;
    if (!currentTrack?.src || !currentAlbum?.id) return;
    const hasShareParams = Boolean(locationSearch && locationSearch.includes('albumId='));
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

  const listAlbum = currentAlbum?.id === 'favorites' && currentSongInfo?.album
    ? currentSongInfo.album
    : currentAlbum;

  const favoriteAlbum = useMemo(() => {
    if (tempPlaylistItems.length === 0) return null;
    const cover = tempPlaylistItems[0]?.album?.cover || currentAlbum?.cover;
    const songs = tempPlaylistItems.map((item) => ({
      ...item.song,
      cover: item.album?.cover
    }));
    return {
      id: 'favorites',
      name: '我的收藏',
      artist: '我的收藏',
      cover,
      songs
    };
  }, [tempPlaylistItems, currentAlbum?.cover]);

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

  const handleCopyOfficialAccountName = useCallback(async (eventOrOptions) => {
    const anchorOrOptions = eventOrOptions?.currentTarget
      ? {
        placement: 'bottom',
        anchorEvent: { currentTarget: eventOrOptions.currentTarget },
        duration: 6000
      }
      : {
        placement: 'bottom',
        duration: 6000,
        ...(eventOrOptions || {})
      };
    const copied = await copyTextToClipboard(WECHAT_OFFICIAL_ACCOUNT_NAME);
    showToast(
      copied
        ? `公众号名已复制，去微信搜索“${WECHAT_OFFICIAL_ACCOUNT_NAME}”`
        : `复制失败，请手动搜索“${WECHAT_OFFICIAL_ACCOUNT_NAME}”`,
      copied ? 'tone-add' : 'tone-remove',
      anchorOrOptions
    );
  }, [showToast]);

  const buildCurrentSharePayload = useCallback(() => {
    if (!currentTrack?.src || typeof window === 'undefined') return null;
    const resolvedAlbum = currentAlbum?.id === 'favorites' && currentSongInfo?.album
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
    const url = new URL(getPathForView('library'), window.location.origin);
    url.searchParams.set('albumId', String(resolvedAlbum.id));
    url.searchParams.set('songId', String(shareTrack.id || ''));
    url.searchParams.set('song', String(matchedIndex + 1));
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
    handleCopySpecificPageUrl,
    handleShareCardImage,
    handleShareCurrentTrack,
    handleShareVideo
  } = useSharePanel({
    getCurrentTrackSharePayload: buildCurrentSharePayload,
    showToast
  });
  const activeShareUrl = sharePanelData?.url || '';
  const isShareMiniProgramVisible = Boolean(activeShareUrl) && shareMiniProgramVisibleUrl === activeShareUrl;

  const handleCopyCurrentPageUrl = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const copied = await copyTextToClipboard(window.location.href);
    showToast(
      copied ? '链接已复制，请在默认浏览器中打开' : '复制失败，请手动复制当前链接',
      copied ? 'tone-add' : 'tone-remove',
      { placement: 'bottom' }
    );
    if (copied) {
      closeWeChatBrowserHint();
    }
  }, [closeWeChatBrowserHint, showToast]);

  const handleSelectAlbum = useCallback((album) => {
    setSelectedAlbum((prev) => (prev && prev.id === album.id ? null : album));
    setIsSidebarOpen(false);
  }, [setSelectedAlbum, setIsSidebarOpen]);

  const pageLoadingFallback = (
    <div className="page-loading page-loading-spinner" role="status" aria-live="polite">
      <span className="page-loading-ring" aria-hidden="true" />
      <span>加载中...</span>
    </div>
  );

  const isLibraryReady = Boolean(currentTrack && currentAlbum && musicAlbums.length > 0);
  const showLibraryLoading = isMusicLoading || (!musicLoadError && musicAlbums.length > 0 && !isLibraryReady);
  const hasPlayerChrome = view !== 'video' && view !== 'admin';
  const shouldShowAnnouncementNav = view !== 'admin' && hasActiveAnnouncement;

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
    if (view === 'download' || view === 'video') {
      return;
    }
    signalBootReady();
  }, [signalBootReady, showLibraryLoading, view]);

  return (
    <>
      <div className={`app-root ${hasPlayerChrome ? '' : 'no-player'}`}>
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
              onThemeToggle={handleThemeToggle}
              announcement={announcement}
              hasActiveAnnouncement={shouldShowAnnouncementNav}
              isAnnouncementUnread={isAnnouncementUnread}
              onOpenAnnouncement={openAnnouncement}
            />

            <main className="main-view">
              {view === 'library' && (
                <div className="view-panel view-panel-library">
                  {showLibraryLoading && pageLoadingFallback}
                  {!showLibraryLoading && musicLoadError && (
                    <div className="page-loading">{musicLoadError}</div>
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
                      />
                      <AlbumGrid
                        musicAlbums={filteredAlbums}
                        navigateToAlbum={handleSelectAlbum}
                        expandedAlbumId={selectedAlbum ? selectedAlbum.id : null}
                        currentTrack={currentTrack}
                        isPlaying={isPlaying}
                        playSongFromAlbum={playSongFromAlbum}
                        tempPlaylistSet={tempPlaylistSet}
                        onToggleTempSong={toggleTempSong}
                        onToggleAlbumFavorites={toggleAlbumFavorites}
                      />
                    </>
                  )}
                  {!showLibraryLoading && !musicLoadError && !isLibraryReady && (
                    <div className="page-loading">暂无曲库</div>
                  )}
                </div>
              )}
              {view === 'video' && (
                <div className="view-panel view-panel-video">
                  <Suspense fallback={pageLoadingFallback}>
                    <VideoPage
                      requestVideoView={requestVideoView}
                      onShareVideo={handleShareVideo}
                      commentServerURL={WALINE_SERVER_URL}
                      locationSearch={locationSearch}
                      onInitialReady={signalBootReady}
                    />
                  </Suspense>
                </div>
              )}
              {view === 'download' && (
                <div className="view-panel view-panel-download">
                  <Suspense fallback={pageLoadingFallback}>
                    <DownloadPage
                      onInitialReady={signalBootReady}
                      onCopyPageLink={(anchorOrOptions) => handleCopySpecificPageUrl(
                        new URL(getPathForView('download'), SITE_URL).toString(),
                        '下载页链接已复制',
                        anchorOrOptions
                      )}
                    />
                  </Suspense>
                </div>
              )}
              {view === 'gallery' && (
                <div className="view-panel view-panel-gallery">
                  <Suspense fallback={pageLoadingFallback}>
                    <GalleryDisplayPage />
                  </Suspense>
                </div>
              )}
              {view === 'about' && (
                <div className="view-panel view-panel-about">
                  <Suspense fallback={pageLoadingFallback}>
                    <AboutPage />
                  </Suspense>
                </div>
              )}
              {view === 'app' && (
                <div className="view-panel view-panel-about">
                  <Suspense fallback={pageLoadingFallback}>
                    <AppPage
                      onCopyPageLink={(anchorOrOptions) => handleCopySpecificPageUrl(
                        new URL(getPathForView('app'), SITE_URL).toString(),
                        'APP 页链接已复制',
                        anchorOrOptions
                      )}
                    />
                  </Suspense>
                </div>
              )}
              {view === 'comment' && (
                <div className="view-panel view-panel-comment">
                  <Suspense fallback={pageLoadingFallback}>
                    <CommentPage serverURL={WALINE_SERVER_URL} />
                  </Suspense>
                </div>
              )}
              {view === 'admin' && (
                <div className="view-panel view-panel-admin">
                  <Suspense fallback={pageLoadingFallback}>
                    <AdminPage />
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
                  audioRef={audioRef}
                  currentSongInfo={currentSongInfo}
                  commentServerURL={WALINE_SERVER_URL}
                  onAddToFavorites={addTempSong}
                  onToggleFavorite={toggleTempSong}
                  isCurrentTrackFavorited={tempPlaylistSet.has(currentTrack?.src)}
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
                  album={listAlbum}
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
          officialAccountName={WECHAT_OFFICIAL_ACCOUNT_NAME}
          keyword={WECHAT_VIDEO_PASSWORD_KEYWORD}
          qrUrl={WECHAT_OFFICIAL_ACCOUNT_QR_URL}
          videoPassword={videoPassword}
          onPasswordChange={handleVideoPasswordChange}
          videoPasswordError={videoPasswordError}
          onSubmit={handleVideoAccessSubmit}
          onCopyOfficialAccountName={handleCopyOfficialAccountName}
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
                {sharePanelData.miniProgram && (
                  <button
                    type="button"
                    className="share-panel-btn ghost"
                    onClick={() => {
                      setShareMiniProgramVisibleUrl((previous) => (
                        previous === activeShareUrl ? '' : activeShareUrl
                      ));
                    }}
                  >
                    {isShareMiniProgramVisible ? '隐藏上传云盘' : '上传云盘'}
                  </button>
                )}
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
              {sharePanelData.miniProgram && isShareMiniProgramVisible && (
                <div className="share-panel-mini-program">
                  <img
                    loading="lazy"
                    src={sharePanelData.miniProgram.codeUrl}
                    alt={`${sharePanelData.albumName || sharePanelData.title || '专辑'} 小程序码`}
                  />
                  <div className="share-panel-mini-program-text">
                    <p>{sharePanelData.miniProgram.title}</p>
                    <p>{sharePanelData.miniProgram.hint}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <AnnouncementModal
          announcement={announcement}
          open={isAnnouncementOpen}
          onConfirm={dismissAnnouncement}
        />

        {isWeChatBrowserHintOpen && (
          <div className="wechat-browser-modal" onClick={closeWeChatBrowserHint}>
            <div
              className="wechat-browser-card"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="wechat-browser-title"
            >
              <div className="wechat-browser-title" id="wechat-browser-title">
                建议使用默认浏览器打开
              </div>
              <p className="wechat-browser-desc">
                当前检测到你正在微信内置浏览器访问，部分功能可能受限。
              </p>
              <ol className="wechat-browser-steps">
                <li>点击右上角“···”菜单。</li>
                <li>选择“用默认浏览器打开”。</li>
                <li>或者复制当前链接到您常用浏览器粘贴打开。</li>
              </ol>
              <div className="wechat-browser-actions">
                <button
                  type="button"
                  className="wechat-browser-btn ghost"
                  onClick={closeWeChatBrowserHint}
                >
                  我知道了
                </button>
                <button
                  type="button"
                  className="wechat-browser-btn primary"
                  onClick={handleCopyCurrentPageUrl}
                >
                  复制当前链接
                </button>
              </div>
            </div>
          </div>
        )}

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
