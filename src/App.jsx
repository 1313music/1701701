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

const SITE_URL = 'https://1701701.xyz';
const SITE_NAME = '1701701.xyz';
const DEFAULT_OG_IMAGE = `${SITE_URL}/logo.png`;

const upsertMetaTag = ({ name, property }, content) => {
  if (typeof document === 'undefined' || !content) return;
  const selector = name
    ? `meta[name="${name}"]`
    : `meta[property="${property}"]`;
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement('meta');
    if (name) tag.setAttribute('name', name);
    if (property) tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const upsertLinkTag = (rel, href) => {
  if (typeof document === 'undefined' || !rel || !href) return;
  let tag = document.head.querySelector(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
};

const upsertJsonLd = (id, payload) => {
  if (typeof document === 'undefined' || !id || !payload) return;
  let script = document.getElementById(id);
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
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

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const seoMap = {
      library: {
        title: '李志音乐 | 1701701.xyz',
        description: '1701701.xyz 收录李志专辑与歌曲，支持歌词查看、播放列表与收藏管理。',
        pageType: 'CollectionPage'
      },
      video: {
        title: '李志现场视频与纪录片 | 1701701.xyz',
        description: '整理李志相关现场视频、纪录片与演出影像内容。',
        pageType: 'VideoGallery'
      },
      download: {
        title: '李志音乐资源下载 | 1701701.xyz',
        description: '提供李志相关资源下载入口与内容汇总。',
        pageType: 'CollectionPage'
      },
      about: {
        title: '关于本站 | 1701701.xyz',
        description: '了解本站的内容范围、资源说明与使用说明。',
        pageType: 'AboutPage'
      }
    };

    const currentSeo = seoMap[view] || seoMap.library;
    const canonicalUrl = `${SITE_URL}/`;
    const albumListForSeo = Array.isArray(musicAlbums)
      ? musicAlbums.filter((album) => album?.name).slice(0, 30)
      : [];

    document.title = currentSeo.title;
    upsertMetaTag({ name: 'description' }, currentSeo.description);
    upsertMetaTag({ property: 'og:type' }, 'website');
    upsertMetaTag({ property: 'og:site_name' }, SITE_NAME);
    upsertMetaTag({ property: 'og:title' }, currentSeo.title);
    upsertMetaTag({ property: 'og:description' }, currentSeo.description);
    upsertMetaTag({ property: 'og:url' }, canonicalUrl);
    upsertMetaTag({ property: 'og:image' }, DEFAULT_OG_IMAGE);
    upsertMetaTag({ name: 'twitter:card' }, 'summary_large_image');
    upsertMetaTag({ name: 'twitter:title' }, currentSeo.title);
    upsertMetaTag({ name: 'twitter:description' }, currentSeo.description);
    upsertMetaTag({ name: 'twitter:image' }, DEFAULT_OG_IMAGE);
    upsertLinkTag('canonical', canonicalUrl);

    const jsonLdPayload = [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: 'zh-CN',
        description: '一个分享李志音乐与视频的网站'
      },
      {
        '@context': 'https://schema.org',
        '@type': currentSeo.pageType,
        name: currentSeo.title,
        url: canonicalUrl,
        inLanguage: 'zh-CN',
        isPartOf: {
          '@type': 'WebSite',
          name: SITE_NAME,
          url: SITE_URL
        },
        about: {
          '@type': 'Person',
          name: '李志'
        },
        description: currentSeo.description
      }
    ];

    if (albumListForSeo.length > 0) {
      jsonLdPayload.push({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: '李志音乐专辑列表',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: albumListForSeo.length,
        itemListElement: albumListForSeo.map((album, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'MusicAlbum',
            '@id': `${canonicalUrl}#album-${encodeURIComponent(String(album.id || index + 1))}`,
            name: album.name,
            byArtist: {
              '@type': 'MusicGroup',
              name: album.artist || '李志'
            },
            numTracks: Array.isArray(album.songs) ? album.songs.length : undefined,
            image: album.cover || undefined,
            url: canonicalUrl
          }
        }))
      });
    }
    upsertJsonLd('page-seo-jsonld', jsonLdPayload);
  }, [view, musicAlbums]);

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

  const toggleAlbumFavorites = useCallback((songs, anchorOrOptions = { placement: 'bottom' }) => {
    const safeSongs = Array.isArray(songs) ? songs : [];
    const candidateIds = Array.from(new Set(safeSongs
      .map((song) => song?.src)
      .filter(Boolean)));
    if (candidateIds.length === 0) return;

    const allFavorited = candidateIds.every((id) => tempPlaylistSet.has(id));
    if (allFavorited) {
      const removeSet = new Set(candidateIds);
      setTempPlaylistIds((prev) => prev.filter((id) => !removeSet.has(id)));
      showToast(
        candidateIds.length === 1 ? '已取消收藏 1 首' : `已取消收藏 ${candidateIds.length} 首`,
        'tone-remove',
        anchorOrOptions
      );
      return;
    }

    const additions = candidateIds.filter((id) => !tempPlaylistSet.has(id));
    if (additions.length === 0) {
      showToast('已全部在收藏', 'tone-add', anchorOrOptions);
      return;
    }

    setTempPlaylistIds((prev) => [...prev, ...additions]);
    showToast(
      additions.length === 1 ? '已收藏 1 首' : `已收藏 ${additions.length} 首`,
      'tone-add',
      anchorOrOptions
    );
  }, [showToast, tempPlaylistSet]);

  const clearTempPlaylist = useCallback((anchorOrOptions = { placement: 'bottom' }) => {
    setTempPlaylistIds((prev) => (prev.length === 0 ? prev : []));
    showToast('已清空收藏', 'tone-remove', anchorOrOptions);
  }, [showToast]);

  const playFavorites = useCallback((song) => {
    if (!favoriteAlbum || favoriteAlbum.songs.length === 0) return;

    const target = song
      ? favoriteAlbum.songs.find((item) => item.src === song.src)
      : favoriteAlbum.songs[0];
    const nextTrack = target || favoriteAlbum.songs[0];

    const isSameTrack = Boolean(currentTrack?.src) && currentTrack.src === nextTrack.src;
    const isInFavoritesAlbum = currentAlbum?.id === favoriteAlbum.id;

    // Keep same click behavior as album list rows: second click toggles play/pause.
    if (song && isInFavoritesAlbum && isSameTrack) {
      setIsPlaying((prev) => !prev);
      return;
    }

    setCurrentAlbum(favoriteAlbum);
    setCurrentTrack(nextTrack);
    setIsPlaying(true);
  }, [
    favoriteAlbum,
    currentTrack?.src,
    currentAlbum?.id,
    setCurrentAlbum,
    setCurrentTrack,
    setIsPlaying
  ]);

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
                  onToggleAlbumFavorites={toggleAlbumFavorites}
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
              <p className="video-access-tip">
                关注公众号【民谣俱乐部】
                <br />
                发送“视频”获取密码。
              </p>
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
