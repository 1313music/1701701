import React, { useMemo, useState, useEffect, useCallback, lazy, Suspense } from 'react';
import './index.css';

// Components
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import AlbumGrid from './components/AlbumGrid';
import SearchHeader from './components/SearchHeader';

// Hooks
import { useAudioPlayer } from './hooks/useAudioPlayer.jsx';
import { useTheme } from './hooks/useTheme.js';
import { useToast } from './hooks/useToast.js';
import { useVideoAccess } from './hooks/useVideoAccess.js';
import { sanitizeTempPlaylist } from './utils/playlistUtils.js';

const TEMP_PLAYLIST_KEY = 'tempPlaylistIds';
const LyricsOverlay = lazy(() => import('./components/LyricsOverlay.jsx'));
const AlbumListOverlay = lazy(() => import('./components/AlbumListOverlay.jsx'));
const VideoPage = lazy(() => import('./components/VideoPage.jsx'));
const DownloadPage = lazy(() => import('./components/DownloadPage.jsx'));
const AboutPage = lazy(() => import('./components/AboutPage.jsx'));

const buildSongSrcSet = (albums) => {
  const set = new Set();
  for (const album of albums) {
    for (const song of album.songs) {
      if (song?.src) set.add(song.src);
    }
  }
  return set;
};

const buildSongIndex = (albums) => {
  const map = new Map();
  for (const album of albums) {
    for (const song of album.songs) {
      if (song?.src && !map.has(song.src)) {
        map.set(song.src, { album, song });
      }
    }
  }
  return map;
};

const App = () => {
  const [view, setView] = useState('library'); // 'library' | 'video' | 'download' | 'about'
  const [musicAlbums, setMusicAlbums] = useState([]);
  const [isMusicLoading, setIsMusicLoading] = useState(true);
  const [musicLoadError, setMusicLoadError] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [tempPlaylistIds, setTempPlaylistIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(TEMP_PLAYLIST_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return sanitizeTempPlaylist(parsed);
    } catch {
      return [];
    }
  });
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isAlbumListOpen, setIsAlbumListOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasLyricsOverlayLoaded, setHasLyricsOverlayLoaded] = useState(false);
  const [hasAlbumListOverlayLoaded, setHasAlbumListOverlayLoaded] = useState(false);

  const allSongSrcs = useMemo(() => buildSongSrcSet(musicAlbums), [musicAlbums]);
  const songIndex = useMemo(() => buildSongIndex(musicAlbums), [musicAlbums]);

  const tempPlaylistSet = useMemo(() => new Set(tempPlaylistIds), [tempPlaylistIds]);
  const tempPlaylistItems = useMemo(
    () => tempPlaylistIds.map((id) => songIndex.get(id)).filter(Boolean),
    [songIndex, tempPlaylistIds]
  );

  const {
    toastMessage,
    isToastVisible,
    toastTone,
    toastPlacement,
    showToast
  } = useToast();

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

  useEffect(() => {
    let canceled = false;
    const loadMusicAlbums = async () => {
      try {
        const module = await import('./data/mp3list.js');
        if (canceled) return;
        setMusicAlbums(Array.isArray(module.musicAlbums) ? module.musicAlbums : []);
      } catch {
        if (canceled) return;
        setMusicLoadError('曲库加载失败，请刷新重试');
      } finally {
        if (!canceled) {
          setIsMusicLoading(false);
        }
      }
    };

    loadMusicAlbums();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (allSongSrcs.size === 0) return;
    setTempPlaylistIds((prev) => {
      const next = sanitizeTempPlaylist(prev, allSongSrcs);
      if (
        next.length === prev.length &&
        next.every((id, index) => id === prev[index])
      ) {
        return prev;
      }
      return next;
    });
  }, [allSongSrcs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TEMP_PLAYLIST_KEY, JSON.stringify(tempPlaylistIds));
    } catch {
      // ignore storage errors
    }
  }, [tempPlaylistIds]);

  const setLyricsOverlayOpen = useCallback((open) => {
    if (open) {
      setHasLyricsOverlayLoaded(true);
      setIsLyricsOpen(true);
      return;
    }
    setIsLyricsOpen(false);
  }, []);

  const setAlbumListOverlayOpen = useCallback((open) => {
    if (open) {
      setHasAlbumListOverlayLoaded(true);
      setIsAlbumListOpen(true);
      return;
    }
    setIsAlbumListOpen(false);
  }, []);

  const stopPlaybackForVideo = useCallback(() => {
    pausePlayback();
    setLyricsOverlayOpen(false);
    setAlbumListOverlayOpen(false);
  }, [pausePlayback, setLyricsOverlayOpen, setAlbumListOverlayOpen]);

  const handleViewChange = useCallback((nextView) => {
    if (nextView === 'video') {
      stopPlaybackForVideo();
      setView('video');
      return;
    }
    setView(nextView);
  }, [stopPlaybackForVideo]);

  const handleVideoAccessSubmit = useCallback(() => {
    submitVideoAccess();
  }, [submitVideoAccess]);

  const toggleTempSong = (song, event) => {
    const id = song?.src;
    if (!id) return;
    const isFavorited = tempPlaylistSet.has(id);
    setTempPlaylistIds((prev) => {
      if (isFavorited) return prev.filter((item) => item !== id);
      return [...prev, id];
    });
    showToast(
      isFavorited ? '已取消收藏' : '已收藏',
      isFavorited ? 'tone-remove' : 'tone-add',
      event
    );
  };

  const addTempSong = (song, anchorOrOptions = { placement: 'bottom' }) => {
    const id = song?.src;
    if (!id) return;
    const isFavorited = tempPlaylistSet.has(id);
    if (isFavorited) {
      showToast('已在收藏', 'tone-add', anchorOrOptions);
      return;
    }
    setTempPlaylistIds((prev) => [...prev, id]);
    showToast('已收藏', 'tone-add', anchorOrOptions);
  };

  const clearTempPlaylist = () => setTempPlaylistIds([]);

  const playFavorites = (song) => {
    if (!favoriteAlbum || favoriteAlbum.songs.length === 0) return;
    const target = song
      ? favoriteAlbum.songs.find((item) => item.src === song.src)
      : favoriteAlbum.songs[0];
    setCurrentAlbum(favoriteAlbum);
    setCurrentTrack(target || favoriteAlbum.songs[0]);
    setIsPlaying(true);
  };

  const navigateToAlbum = (album) => {
    setSelectedAlbum((prev) => (prev && prev.id === album.id ? null : album));
    setIsSidebarOpen(false);
  };

  const searchTerm = searchQuery.trim().toLowerCase();
  const filteredAlbums = useMemo(() => {
    if (!searchTerm) return musicAlbums;
    return musicAlbums.filter((album) => (
      album.name.toLowerCase().includes(searchTerm) ||
      album.artist.toLowerCase().includes(searchTerm) ||
      album.songs.some((song) => song.name.toLowerCase().includes(searchTerm))
    ));
  }, [musicAlbums, searchTerm]);

  const songSuggestions = useMemo(() => {
    if (!searchTerm) return [];
    const results = [];
    for (const album of musicAlbums) {
      const albumMatch = album.name.toLowerCase().includes(searchTerm) ||
        album.artist.toLowerCase().includes(searchTerm);
      for (const song of album.songs) {
        if (albumMatch || song.name.toLowerCase().includes(searchTerm)) {
          results.push({ album, song });
          if (results.length >= 8) return results;
        }
      }
    }
    return results;
  }, [musicAlbums, searchTerm]);
  const pageLoadingFallback = <div className="page-loading">加载中...</div>;
  const isLibraryReady = Boolean(currentTrack && currentAlbum && musicAlbums.length > 0);
  const showLibraryLoading = isMusicLoading || (!musicLoadError && musicAlbums.length > 0 && !isLibraryReady);

  return (
    <>
      <div className={`app-root ${view === 'video' ? 'no-player' : ''}`}>
        <div className={`app-container ${isSidebarOpen ? 'sidebar-open' : ''}`}>
          <div className="app-layout">
            <Sidebar
              view={view}
              setView={handleViewChange}
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
              themePreference={themePreference}
              onThemeToggle={handleThemeToggle}
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
                        navigateToAlbum={navigateToAlbum}
                        expandedAlbumId={selectedAlbum ? selectedAlbum.id : null}
                        currentTrack={currentTrack}
                        isPlaying={isPlaying}
                        playSongFromAlbum={playSongFromAlbum}
                        tempPlaylistSet={tempPlaylistSet}
                        onToggleTempSong={toggleTempSong}
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
                    <VideoPage requestVideoView={requestVideoView} />
                  </Suspense>
                </div>
              )}
              {view === 'download' && (
                <div className="view-panel view-panel-download">
                  <Suspense fallback={pageLoadingFallback}>
                    <DownloadPage />
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
            </main>
          </div>
        </div>

        {view !== 'video' && isLibraryReady && (
          <>
            <PlayerBar
              currentTrack={currentTrack}
              currentAlbum={currentAlbum}
              isPlaying={isPlaying}
              handlePlayPause={handlePlayPause}
              progress={progress}
              handleSeek={handleSeek}
              togglePlayMode={togglePlayMode}
              getPlayModeIcon={getPlayModeIcon}
              handlePrev={handlePrev}
              handleNext={handleNext}
              setIsLyricsOpen={setLyricsOverlayOpen}
              setIsAlbumListOpen={setAlbumListOverlayOpen}
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
                  onAddToFavorites={addTempSong}
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
                  onClearTempPlaylist={clearTempPlaylist}
                  onPlayFavorites={playFavorites}
                />
              </Suspense>
            )}
          </>
        )}

        {isVideoAccessOpen && (
          <div className="video-access-modal" onClick={closeVideoAccessModal}>
            <div className="video-access-card" onClick={(e) => e.stopPropagation()}>
              <div className="video-access-title">视频访问</div>
              <p className="video-access-tip">关注公众号【民谣俱乐部】发送“视频”获取密码。</p>
              <div className="video-access-qr">
                <img loading="lazy" src="https://r2.1701701.xyz/img/gzh.jpg" alt="公众号二维码" />
              </div>
              <input
                className="video-access-input"
                type="password"
                placeholder="请输入访问密码"
                value={videoPassword}
                onChange={(e) => {
                  setVideoPassword(e.target.value);
                  setVideoPasswordError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVideoAccessSubmit();
                }}
              />
              {videoPasswordError && <div className="video-access-error">{videoPasswordError}</div>}
              <div className="video-access-actions">
                <button
                  type="button"
                  className="video-access-btn ghost"
                  onClick={closeVideoAccessModal}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="video-access-btn"
                  onClick={handleVideoAccessSubmit}
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className={`app-toast ${isToastVisible ? 'show' : ''} ${toastTone} ${toastPlacement.startsWith('side') ? `placement-${toastPlacement}` : ''}`}
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
