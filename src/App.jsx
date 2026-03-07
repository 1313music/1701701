import React, { useMemo, useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import './index.css';

// Components
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import AlbumGrid from './components/AlbumGrid';
import SearchHeader from './components/SearchHeader';
import VideoAccessModal from './components/VideoAccessModal.jsx';

// Hooks
import { useAudioPlayer } from './hooks/useAudioPlayer.jsx';
import { useTheme } from './hooks/useTheme.js';
import { useToast } from './hooks/useToast.js';
import { useVideoAccess } from './hooks/useVideoAccess.js';
import {
  addFavoriteId,
  clearFavoriteIds,
  toggleAlbumFavoritesBySongs,
  toggleFavoriteId
} from './utils/favoritesUtils.js';
import {
  copyTextToClipboard,
  dataUrlToFile,
  downloadDataUrl,
  isIOSDevice,
  isWeChatBrowser,
  openImagePreviewWindow,
  upsertJsonLd,
  upsertLinkTag,
  upsertMetaTag
} from './utils/appDomUtils.js';
import { sanitizeTempPlaylist } from './utils/playlistUtils.js';

const TEMP_PLAYLIST_KEY = 'tempPlaylistIds';
const LyricsOverlay = lazy(() => import('./components/LyricsOverlay.jsx'));
const AlbumListOverlay = lazy(() => import('./components/AlbumListOverlay.jsx'));
const VideoPage = lazy(() => import('./components/VideoPage.jsx'));
const DownloadPage = lazy(() => import('./components/DownloadPage.jsx'));
const AboutPage = lazy(() => import('./components/AboutPage.jsx'));
const AppPage = lazy(() => import('./components/AppPage.jsx'));

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
const LI_ZHI_ENTITY_LINKS = [
  'https://musicbrainz.org/artist/e54bc357-19aa-4e1f-9795-3346e486d5db',
  'https://en.wikipedia.org/wiki/Li_Zhi_(singer)'
];
const RESEARCHED_KEY_RELEASES = [
  { name: '被禁忌的游戏', year: '2004' },
  { name: '梵高先生', year: '2005' },
  { name: '这个世界会好吗', year: '2006' },
  { name: '我爱南京', year: '2009' },
  { name: '你好，郑州', year: '2010' },
  { name: 'F', year: '2011' },
  { name: '1701', year: '2014' },
  { name: '8', year: '2016' },
  { name: '在每一条伤心的应天大街上', year: '2016' },
  { name: '看见', year: '2020' }
];
const KL_EVENT_DATES = [
  '2025-11-11T20:30:00+08:00',
  '2025-11-12T20:30:00+08:00',
  '2025-11-13T20:30:00+08:00'
];
const KL_EVENT_URL = 'https://idealivearena.com/event/three-missing-one/';
const WECHAT_OFFICIAL_ACCOUNT_NAME = '民谣俱乐部';
const WECHAT_VIDEO_PASSWORD_KEYWORD = '视频';
const WECHAT_OFFICIAL_ACCOUNT_QR_URL = 'https://r2.1701701.xyz/img/gzh.jpg';

const App = () => {
  const [view, setView] = useState('library'); // 'library' | 'video' | 'download' | 'app' | 'about'
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
  const [sharePanelData, setSharePanelData] = useState(null);
  const [shareCardDataUrl, setShareCardDataUrl] = useState('');
  const [isShareCardGenerating, setIsShareCardGenerating] = useState(false);
  const [isWeChatBrowserHintOpen, setIsWeChatBrowserHintOpen] = useState(false);
  const shareQueryAppliedRef = useRef(false);
  const viewQueryAppliedRef = useRef(false);
  const shareCardRequestIdRef = useRef(0);
  const tempPlaylistIdsRef = useRef(tempPlaylistIds);

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
    tempPlaylistIdsRef.current = tempPlaylistIds;
  }, [tempPlaylistIds]);

  useEffect(() => {
    if (allSongSrcs.size === 0) return;
    setTempPlaylistIds((prev) => {
      const next = sanitizeTempPlaylist(prev, allSongSrcs);
      tempPlaylistIdsRef.current = next;
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
    if (typeof window === 'undefined') return;
    if (!isWeChatBrowser()) return;
    setIsWeChatBrowserHintOpen(true);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const researchedReleaseNames = RESEARCHED_KEY_RELEASES.map((item) => item.name);
    const releaseYearMap = new Map(
      RESEARCHED_KEY_RELEASES.map((item) => [item.name, item.year])
    );

    const seoMap = {
      library: {
        title: '李志音乐 | 1701701.xyz',
        description: '收录李志代表作与现场内容，包含《被禁忌的游戏》《梵高先生》《1701》及叁缺壹吉隆坡站等，支持歌词查看、播放列表与收藏管理。',
        pageType: 'CollectionPage',
        keywords: [
          '李志',
          '李志音乐',
          '李志专辑',
          '李志现场',
          '李志1701',
          '李志8',
          '334计划',
          '我们的叁叁肆',
          '叁缺壹吉隆坡站',
          '叁缺壹东京站',
          'Three Missing One',
          'IDEA LIVE ARENA',
          '被禁忌的游戏',
          '梵高先生',
          '这个世界会好吗',
          '我爱南京',
          '你好郑州',
          '在每一条伤心的应天大街上'
        ]
      },
      video: {
        title: '李志现场视频与纪录片 | 1701701.xyz',
        description: '整理李志相关现场视频、纪录片与演出影像，覆盖“我们的叁叁肆”、叁叁肆计划巡演、跨年与采访内容。',
        pageType: 'VideoGallery',
        keywords: [
          '李志视频',
          '李志纪录片',
          '我们的叁叁肆',
          '334计划',
          '334城巡演',
          '李志巡演',
          '李志跨年',
          '叁缺壹现场',
          '叁缺壹吉隆坡站'
        ]
      },
      download: {
        title: '李志音乐资源下载 | 1701701.xyz',
        description: '提供李志相关资源下载入口与内容汇总，覆盖叁缺壹吉隆坡站、东京站以及代表专辑相关资源。',
        pageType: 'CollectionPage',
        keywords: [
          '李志下载',
          '李志资源',
          '叁缺壹吉隆坡站下载',
          '叁缺壹东京站下载',
          '李志现场音频',
          '李志1701下载',
          '李志梵高先生'
        ]
      },
      app: {
        title: 'APP 下载 | 1701701.xyz',
        description: '下载 1701701 的 macOS、Windows 与 Android 客户端，并查看 iOS 添加到主屏幕使用教程。',
        pageType: 'CollectionPage',
        keywords: [
          '1701701 app',
          '1701701 mac',
          '1701701 windows',
          '1701701 android',
          '1701701 apk',
          'iOS PWA',
          '添加到主屏幕'
        ]
      },
      about: {
        title: '关于本站 | 1701701.xyz',
        description: '了解本站的内容范围、资源说明与使用说明。',
        pageType: 'AboutPage',
        keywords: ['1701701.xyz', '李志音乐站', '李志资料整理']
      }
    };

    const currentSeo = seoMap[view] || seoMap.library;
    const canonicalUrl = `${SITE_URL}/`;
    const keywordsContent = Array.isArray(currentSeo.keywords)
      ? currentSeo.keywords.join(',')
      : '';
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
    upsertMetaTag({ name: 'keywords' }, keywordsContent);
    upsertLinkTag('canonical', canonicalUrl);

    const jsonLdPayload = [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: 'zh-CN',
        description: '一个分享李志音乐与视频的网站',
        about: {
          '@type': 'Person',
          name: '李志'
        },
        keywords: [
          '李志音乐',
          '李志现场视频',
          '叁缺壹吉隆坡站',
          '1701701.xyz'
        ]
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
        description: currentSeo.description,
        keywords: currentSeo.keywords,
        mentions: researchedReleaseNames.slice(0, 8).map((name) => ({
          '@type': 'MusicAlbum',
          name,
          byArtist: {
            '@type': 'MusicGroup',
            name: '李志'
          }
        }))
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: '李志',
        birthDate: '1978-11-13',
        birthPlace: {
          '@type': 'Place',
          name: '江苏金坛'
        },
        jobTitle: 'Singer-Songwriter',
        genre: ['contemporary folk', 'singer-songwriter'],
        description: '民谣音乐人，代表作包括《梵高先生》《这个世界会好吗》《1701》等。',
        sameAs: LI_ZHI_ENTITY_LINKS,
        knowsAbout: ['李志音乐', 'contemporary folk', 'singer-songwriter', ...researchedReleaseNames.slice(0, 6)]
      },
      {
        '@context': 'https://schema.org',
        '@type': 'MusicEvent',
        name: '叁缺壹·吉隆坡站',
        startDate: KL_EVENT_DATES[0],
        endDate: KL_EVENT_DATES[2],
        eventStatus: 'https://schema.org/EventCompleted',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: 'IDEA LIVE ARENA',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Petaling Jaya',
            addressCountry: 'MY'
          }
        },
        performer: {
          '@type': 'Person',
          name: '李志'
        },
        offers: {
          '@type': 'Offer',
          availabilityStarts: '2025-08-26T12:30:00+08:00',
          url: KL_EVENT_URL
        },
        description: '2025年11月11日至11月13日，叁缺壹吉隆坡站在 IDEA LIVE ARENA 演出（官方开售时间为 2025-08-26）。',
        subEvent: KL_EVENT_DATES.map((startDate, index) => ({
          '@type': 'MusicEvent',
          name: `叁缺壹·吉隆坡站 第${index + 1}场`,
          startDate,
          eventStatus: 'https://schema.org/EventCompleted',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          location: {
            '@type': 'Place',
            name: 'IDEA LIVE ARENA'
          },
          performer: {
            '@type': 'Person',
            name: '李志'
          }
        })),
        url: KL_EVENT_URL
      },
      {
        '@context': 'https://schema.org',
        '@type': 'CreativeWorkSeries',
        name: '我们的叁叁肆',
        description: '围绕叁叁肆计划巡演的影像记录内容。',
        keywords: ['我们的叁叁肆', '叁叁肆计划', '334城巡演'],
        about: {
          '@type': 'Person',
          name: '李志'
        }
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
            datePublished: releaseYearMap.get(album.name) || undefined,
            numTracks: Array.isArray(album.songs) ? album.songs.length : undefined,
            image: album.cover || undefined,
            url: canonicalUrl
          }
        }))
      });
    }
    upsertJsonLd('page-seo-jsonld', jsonLdPayload);
  }, [view, musicAlbums]);

  useEffect(() => {
    if (shareQueryAppliedRef.current) return;
    if (musicAlbums.length === 0 || typeof window === 'undefined') return;
    shareQueryAppliedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const albumId = params.get('albumId');
    if (!albumId) return;
    const targetAlbum = musicAlbums.find((album) => String(album.id) === albumId);
    if (!targetAlbum?.songs?.length) return;
    let songIndex = Number.parseInt(params.get('song') || '1', 10);
    if (!Number.isInteger(songIndex) || songIndex < 1 || songIndex > targetAlbum.songs.length) {
      songIndex = 1;
    }
    const timerId = window.setTimeout(() => {
      setView('library');
      setSelectedAlbum(targetAlbum);
      setCurrentAlbum(targetAlbum);
      setCurrentTrack(targetAlbum.songs[songIndex - 1]);
      setIsPlaying(false);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [musicAlbums, setCurrentAlbum, setCurrentTrack, setIsPlaying, setSelectedAlbum, setView]);

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

  useEffect(() => {
    if (viewQueryAppliedRef.current || typeof window === 'undefined') return;
    viewQueryAppliedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const queryView = String(params.get('view') || '').trim();
    if (!queryView) return;
    const availableViews = new Set(['library', 'video', 'download', 'about', 'app']);
    if (!availableViews.has(queryView)) return;
    handleViewChange(queryView);
  }, [handleViewChange]);

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
        duration: 3200
      }
      : {
        placement: 'bottom',
        duration: 3200,
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
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('albumId', String(resolvedAlbum.id));
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
      cover: shareTrack.cover || resolvedAlbum.cover || ''
    };
  }, [currentAlbum, currentSongInfo, currentTrack]);

  const startShareCardGeneration = useCallback((payload) => {
    if (!payload?.url) return;
    const requestId = ++shareCardRequestIdRef.current;
    setIsShareCardGenerating(true);
    setShareCardDataUrl('');
    void (async () => {
      try {
        const { createShareCardDataUrl } = await import('./utils/shareCardGenerator.js');
        if (shareCardRequestIdRef.current !== requestId) return;
        const dataUrl = await createShareCardDataUrl(payload);
        if (shareCardRequestIdRef.current !== requestId) return;
        setShareCardDataUrl(dataUrl);
      } catch {
        if (shareCardRequestIdRef.current !== requestId) return;
        setShareCardDataUrl('');
        showToast('分享卡片生成失败', 'tone-remove', { placement: 'bottom' });
      } finally {
        if (shareCardRequestIdRef.current === requestId) {
          setIsShareCardGenerating(false);
        }
      }
    })();
  }, [showToast]);

  const closeSharePanel = useCallback(() => {
    shareCardRequestIdRef.current += 1;
    setSharePanelData(null);
    setShareCardDataUrl('');
    setIsShareCardGenerating(false);
  }, []);

  const openSharePanel = useCallback((payload) => {
    if (!payload?.url) return false;
    setSharePanelData(payload);
    startShareCardGeneration(payload);
    return true;
  }, [startShareCardGeneration]);

  const closeWeChatBrowserHint = useCallback(() => {
    setIsWeChatBrowserHintOpen(false);
  }, []);

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

  const handleShareCurrentTrack = useCallback(async (anchorOrOptions) => {
    const payload = buildCurrentSharePayload();
    if (!openSharePanel(payload)) {
      showToast('当前歌曲暂不可分享', 'tone-remove', anchorOrOptions || { placement: 'bottom' });
      return;
    }
  }, [buildCurrentSharePayload, openSharePanel, showToast]);

  const handleShareVideo = useCallback((payload, anchorOrOptions) => {
    if (!openSharePanel(payload)) {
      showToast('当前视频暂不可分享', 'tone-remove', anchorOrOptions || { placement: 'bottom' });
    }
  }, [openSharePanel, showToast]);

  const handleCopyShareLink = useCallback(async (anchorOrOptions = { placement: 'side' }) => {
    if (!sharePanelData?.url) return;
    const copied = await copyTextToClipboard(sharePanelData.url);
    showToast(
      copied ? '分享链接已复制' : '复制失败，请手动复制',
      copied ? 'tone-add' : 'tone-remove',
      anchorOrOptions
    );
  }, [sharePanelData?.url, showToast]);

  const handleDownloadShareCard = useCallback((anchorOrOptions = { placement: 'side' }) => {
    if (!shareCardDataUrl) return;
    downloadDataUrl(shareCardDataUrl, '1701701-share-card.png');
    showToast('分享卡片已下载', 'tone-add', anchorOrOptions);
  }, [shareCardDataUrl, showToast]);

  const handleShareCardImage = useCallback(async () => {
    if (!shareCardDataUrl) return;
    const file = dataUrlToFile(shareCardDataUrl, `1701701-share-card-${Date.now()}.png`);
    const canUseSystemShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    if (isIOSDevice() && canUseSystemShare) {
      showToast('在系统菜单选择“保存图像”即可保存到相册', 'tone-add', {
        placement: 'top',
        duration: 3800
      });
    }

    if (canUseSystemShare) {
      try {
        await navigator.share({
          files: [file],
          title: sharePanelData?.title || '1701701 分享卡片',
          text: sharePanelData?.text || ''
        });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    if (isIOSDevice()) {
      const opened = openImagePreviewWindow(shareCardDataUrl);
      if (opened) {
        showToast('已打开图片，长按可保存到相册', 'tone-add', { placement: 'side' });
        return;
      }
    }

    handleDownloadShareCard({ placement: 'side' });
  }, [handleDownloadShareCard, shareCardDataUrl, sharePanelData?.text, sharePanelData?.title, showToast]);

  const applyTempPlaylistMutation = useCallback((mutator) => {
    if (typeof mutator !== 'function') return null;
    const result = mutator(tempPlaylistIdsRef.current);
    if (!result || !Array.isArray(result.nextIds)) return null;
    tempPlaylistIdsRef.current = result.nextIds;
    setTempPlaylistIds(result.nextIds);
    return result;
  }, []);

  const toggleTempSong = useCallback((song, event) => {
    const id = song?.src;
    if (!id) return;
    const result = applyTempPlaylistMutation((prev) => toggleFavoriteId(prev, id));
    if (!result || result.action === 'noop') return;
    showToast(
      result.action === 'removed' ? '已取消收藏' : '已收藏',
      result.action === 'removed' ? 'tone-remove' : 'tone-add',
      event
    );
  }, [applyTempPlaylistMutation, showToast]);

  const addTempSong = useCallback((song, anchorOrOptions = { placement: 'bottom' }) => {
    const id = song?.src;
    if (!id) return;
    const result = applyTempPlaylistMutation((prev) => addFavoriteId(prev, id));
    if (!result || result.action !== 'added') {
      showToast('已在收藏', 'tone-add', anchorOrOptions);
      return;
    }
    showToast('已收藏', 'tone-add', anchorOrOptions);
  }, [applyTempPlaylistMutation, showToast]);

  const toggleAlbumFavorites = useCallback((songs, anchorOrOptions = { placement: 'bottom' }) => {
    const result = applyTempPlaylistMutation((prev) => toggleAlbumFavoritesBySongs(prev, songs));
    if (!result || result.action === 'noop') return;
    if (result.action === 'removed') {
      showToast(
        result.count === 1 ? '已取消收藏 1 首' : `已取消收藏 ${result.count} 首`,
        'tone-remove',
        anchorOrOptions
      );
      return;
    }

    showToast(
      result.count === 1 ? '已收藏 1 首' : `已收藏 ${result.count} 首`,
      'tone-add',
      anchorOrOptions
    );
  }, [applyTempPlaylistMutation, showToast]);

  const clearTempPlaylist = useCallback((anchorOrOptions = { placement: 'bottom' }) => {
    applyTempPlaylistMutation((prev) => clearFavoriteIds(prev));
    showToast('已清空收藏', 'tone-remove', anchorOrOptions);
  }, [applyTempPlaylistMutation, showToast]);

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
                    <VideoPage requestVideoView={requestVideoView} onShareVideo={handleShareVideo} />
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
              {view === 'app' && (
                <div className="view-panel view-panel-about">
                  <Suspense fallback={pageLoadingFallback}>
                    <AppPage />
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
                  onAddToFavorites={addTempSong}
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
