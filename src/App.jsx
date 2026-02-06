import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Repeat, Repeat1, Shuffle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { musicAlbums } from './data/mp3list';
import { parseLyrics } from './utils/lyricUtils';
import { formatTime } from './utils/formatUtils';
import './index.css';

// Components
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import AlbumGrid from './components/AlbumGrid';
import LyricsOverlay from './components/LyricsOverlay';
import SearchHeader from './components/SearchHeader';
import AlbumListOverlay from './components/AlbumListOverlay';
import VideoPage from './components/VideoPage';
import DownloadPage from './components/DownloadPage';
import AboutPage from './components/AboutPage';

const VIDEO_PASSWORD = '1701701xyz';
const VIDEO_ACCESS_KEY = 'videoAccessGranted';
const VIDEO_ACCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TEMP_PLAYLIST_KEY = 'tempPlaylistIds';
const THEME_PREFERENCE_KEY = 'themePreference';

const persistVideoAccessGrant = () => {
  if (typeof window === 'undefined') return;
  const payload = {
    granted: true,
    expiresAt: Date.now() + VIDEO_ACCESS_TTL_MS
  };
  try {
    window.localStorage.setItem(VIDEO_ACCESS_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
};

const readVideoAccessGranted = () => {
  if (typeof window === 'undefined') return false;
  let raw = null;
  try {
    raw = window.localStorage.getItem(VIDEO_ACCESS_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;

  // 兼容旧版本的布尔值，迁移为带过期时间的结构
  if (raw === 'true') {
    persistVideoAccessGrant();
    return true;
  }

  try {
    const parsed = JSON.parse(raw);
    const expiresAt = Number(parsed?.expiresAt);
    if (parsed?.granted === true && Number.isFinite(expiresAt) && expiresAt > Date.now()) {
      return true;
    }
  } catch {
    // ignore parse errors and clear below
  }

  try {
    window.localStorage.removeItem(VIDEO_ACCESS_KEY);
  } catch {
    // ignore storage errors
  }
  return false;
};

const getSystemTheme = () => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const toAbsoluteUrl = (value) => {
  if (!value || typeof value !== 'string') return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (typeof window === 'undefined') return '';
  try {
    return new URL(value, window.location.href).href;
  } catch {
    return '';
  }
};

const buildMediaArtwork = (coverUrl) => {
  const absoluteCover = toAbsoluteUrl(coverUrl);
  if (!absoluteCover) return undefined;
  return [
    { src: absoluteCover, sizes: '96x96' },
    { src: absoluteCover, sizes: '128x128' },
    { src: absoluteCover, sizes: '192x192' },
    { src: absoluteCover, sizes: '256x256' },
    { src: absoluteCover, sizes: '384x384' },
    { src: absoluteCover, sizes: '512x512' }
  ];
};

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

const sanitizeTempPlaylist = (ids, validSet) => {
  if (!Array.isArray(ids)) return [];
  const next = [];
  const seen = new Set();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    if (validSet && !validSet.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
};

const ALL_SONG_SRCS = buildSongSrcSet(musicAlbums);
const SONG_INDEX = buildSongIndex(musicAlbums);

const App = () => {
  // 状态管理
  const [view, setView] = useState('library'); // 'library' | 'video' | 'download' | 'about'
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(musicAlbums[0].songs[0]);
  const [currentAlbum, setCurrentAlbum] = useState(musicAlbums[0]);
  const [tempPlaylistIds, setTempPlaylistIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(TEMP_PLAYLIST_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return sanitizeTempPlaylist(parsed, ALL_SONG_SRCS);
    } catch {
      return [];
    }
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isAlbumListOpen, setIsAlbumListOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [playMode, setPlayMode] = useState('loop');
  const [isTrackNameOverflowing, setIsTrackNameOverflowing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isVideoAccessOpen, setIsVideoAccessOpen] = useState(false);
  const [videoPassword, setVideoPassword] = useState('');
  const [videoPasswordError, setVideoPasswordError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [toastTone, setToastTone] = useState('tone-add');
  const [toastPlacement, setToastPlacement] = useState('anchor');
  const [themePreference, setThemePreference] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = window.localStorage.getItem(THEME_PREFERENCE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'dark';
  });
  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());
  const [isVideoAccessGranted, setIsVideoAccessGranted] = useState(() => {
    return readVideoAccessGranted();
  });

  const trackNameRef = useRef(null);
  const audioRef = useRef(new Audio());
  const toastTimerRef = useRef(null);
  const scrollLockRef = useRef({
    locked: false,
    scrollY: 0,
    bodyOverflow: '',
    bodyPosition: '',
    bodyTop: '',
    bodyLeft: '',
    bodyRight: '',
    bodyWidth: '',
    bodyPaddingRight: '',
    htmlOverflow: ''
  });
  const tempPlaylistSet = useMemo(() => new Set(tempPlaylistIds), [tempPlaylistIds]);
  const tempPlaylistItems = useMemo(
    () => tempPlaylistIds.map((id) => SONG_INDEX.get(id)).filter(Boolean),
    [tempPlaylistIds]
  );
  const currentSongInfo = useMemo(
    () => SONG_INDEX.get(currentTrack?.src),
    [currentTrack?.src]
  );
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
  const resolvedTheme = themePreference === 'system' ? systemTheme : themePreference;

  // 初始化音频监听
  useEffect(() => {
    const audio = audioRef.current;
    audio.preload = 'metadata';
    audio.playsInline = true;
    const updateProgress = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
    };
    const onLoadedMetadata = () => setDuration(audio.duration);
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, []);

  // 切换歌曲逻辑
  useEffect(() => {
    const audio = audioRef.current;
    if (audio.src !== currentTrack.src) {
      audio.src = currentTrack.src;
      if (isPlaying) audio.play().catch(e => console.log("Play interrupted"));
    } else {
      if (isPlaying) audio.play().catch(e => console.log("Play interrupted"));
    }

    // 加载歌词
    if (currentTrack.lrc) {
      if (currentTrack.lrc.startsWith('http')) {
        fetch(currentTrack.lrc)
          .then(res => res.text())
          .then(text => setLyrics(parseLyrics(text)))
          .catch(() => setLyrics([]));
      } else {
        // Handle local lrc or other cases if needed
        setLyrics([]);
      }
    } else {
      setLyrics([]);
    }
  }, [currentTrack]);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const setVhUnit = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVhUnit();
    window.addEventListener('resize', setVhUnit);
    window.addEventListener('orientationchange', setVhUnit);
    return () => {
      window.removeEventListener('resize', setVhUnit);
      window.removeEventListener('orientationchange', setVhUnit);
    };
  }, []);

  // 收藏列表缓存
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TEMP_PLAYLIST_KEY, JSON.stringify(tempPlaylistIds));
    } catch {
      // ignore storage errors
    }
  }, [tempPlaylistIds]);

  // 播放/暂停控制
  useEffect(() => {
    if (isPlaying) audioRef.current.play().catch(() => { });
    else audioRef.current.pause();
  }, [isPlaying]);

  // 锁屏媒体信息（歌名/歌手/专辑/封面）
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (typeof window === 'undefined' || !('MediaMetadata' in window)) return;

    const mediaSession = navigator.mediaSession;
    const metadata = {
      title: currentTrack?.name || '未知歌曲',
      artist: currentSongInfo?.album?.artist || currentAlbum?.artist || '',
      album: currentSongInfo?.album?.name || currentAlbum?.name || '',
      artwork: buildMediaArtwork(
        currentTrack?.cover || currentSongInfo?.album?.cover || currentAlbum?.cover
      )
    };

    try {
      mediaSession.metadata = new window.MediaMetadata(metadata);
    } catch {
      mediaSession.metadata = null;
    }
  }, [
    currentTrack?.name,
    currentTrack?.cover,
    currentSongInfo?.album?.artist,
    currentSongInfo?.album?.name,
    currentSongInfo?.album?.cover,
    currentAlbum?.artist,
    currentAlbum?.name,
    currentAlbum?.cover
  ]);

  // 同步锁屏播放状态
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // 同步锁屏进度（支持系统进度条）
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const mediaSession = navigator.mediaSession;
    if (typeof mediaSession.setPositionState !== 'function') return;
    if (!Number.isFinite(duration) || duration <= 0) return;

    const safePosition = Math.min(Math.max(currentTime, 0), duration);
    try {
      mediaSession.setPositionState({
        duration,
        playbackRate: audioRef.current.playbackRate || 1,
        position: safePosition
      });
    } catch {
      // ignore unsupported/broken implementations
    }
  }, [currentTime, duration, currentTrack?.src]);

  // 歌词同步
  useEffect(() => {
    const index = lyrics.findIndex((l, i) =>
      currentTime >= l.time && (!lyrics[i + 1] || currentTime < lyrics[i + 1].time)
    );
    if (index !== -1 && index !== currentLyricIndex) {
      setCurrentLyricIndex(index);
    }
  }, [currentTime, lyrics]);

  // 歌名溢出检测
  useEffect(() => {
    if (trackNameRef.current) {
      const isOverflowing = trackNameRef.current.scrollWidth > trackNameRef.current.clientWidth;
      setIsTrackNameOverflowing(isOverflowing);
    }
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(THEME_PREFERENCE_KEY, themePreference);
    } catch {
      // ignore storage errors
    }
  }, [themePreference]);

  // 修改主题色 meta 标签以适配刘海/状态栏，并同步 data-theme
  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.body.setAttribute('data-theme', resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;
    document.body.style.colorScheme = resolvedTheme;

    // 更新 meta theme-color
    let colorStr;
    if (isLyricsOpen) {
      // 全屏播放器打开时，强制状态栏黑色（或深色背景）
      colorStr = '#000000';
    } else {
      colorStr = resolvedTheme === 'dark' ? '#121214' : '#ffffff';
    }

    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', colorStr);
    });
  }, [isLyricsOpen, resolvedTheme]);

  // 打开浮层时锁定页面滚动，避免滚动条变化导致固定元素跳动
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const shouldLock = isLyricsOpen || isAlbumListOpen || isVideoAccessOpen;
    const body = document.body;
    const html = document.documentElement;

    const lockScroll = () => {
      if (scrollLockRef.current.locked) return;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const scrollbarWidth = window.innerWidth - html.clientWidth;

      scrollLockRef.current = {
        locked: true,
        scrollY,
        bodyOverflow: body.style.overflow,
        bodyPosition: body.style.position,
        bodyTop: body.style.top,
        bodyLeft: body.style.left,
        bodyRight: body.style.right,
        bodyWidth: body.style.width,
        bodyPaddingRight: body.style.paddingRight,
        htmlOverflow: html.style.overflow
      };

      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    };

    const unlockScroll = () => {
      if (!scrollLockRef.current.locked) return;
      const { scrollY } = scrollLockRef.current;
      body.style.overflow = scrollLockRef.current.bodyOverflow || '';
      body.style.position = scrollLockRef.current.bodyPosition || '';
      body.style.top = scrollLockRef.current.bodyTop || '';
      body.style.left = scrollLockRef.current.bodyLeft || '';
      body.style.right = scrollLockRef.current.bodyRight || '';
      body.style.width = scrollLockRef.current.bodyWidth || '';
      body.style.paddingRight = scrollLockRef.current.bodyPaddingRight || '';
      html.style.overflow = scrollLockRef.current.htmlOverflow || '';
      scrollLockRef.current.locked = false;
      scrollLockRef.current.scrollY = 0;
      window.scrollTo(0, scrollY || 0);
    };

    if (shouldLock) {
      lockScroll();
      return () => unlockScroll();
    }

    unlockScroll();
    return undefined;
  }, [isLyricsOpen, isAlbumListOpen, isVideoAccessOpen]);

  // 切换到视频库时停止音乐并隐藏播放器
  useEffect(() => {
    if (view === 'video') {
      setIsPlaying(false);
      audioRef.current.pause();
      setIsLyricsOpen(false);
      setIsAlbumListOpen(false);
    }
  }, [view]);

  const handleViewChange = (nextView) => {
    if (nextView === 'video') {
      const hasValidVideoAccess = readVideoAccessGranted();
      if (hasValidVideoAccess !== isVideoAccessGranted) {
        setIsVideoAccessGranted(hasValidVideoAccess);
      }
      if (!hasValidVideoAccess) {
        setVideoPassword('');
        setVideoPasswordError('');
        setIsVideoAccessOpen(true);
        return;
      }
    }
    setView(nextView);
  };

  const handleVideoAccessSubmit = () => {
    const input = videoPassword.trim();
    if (input === VIDEO_PASSWORD) {
      setIsVideoAccessGranted(true);
      persistVideoAccessGrant();
      setIsVideoAccessOpen(false);
      setVideoPassword('');
      setVideoPasswordError('');
      setView('video');
    } else {
      setVideoPasswordError('密码不正确');
    }
  };


  const handlePlayPause = () => setIsPlaying((prev) => !prev);
  const handleThemeToggle = (event) => {
    const nextPreference = themePreference === 'dark'
      ? 'light'
      : themePreference === 'light'
        ? 'system'
        : 'dark';
    const message = nextPreference === 'system'
      ? '跟随系统'
      : nextPreference === 'dark'
        ? '深色模式'
        : '浅色模式';
    setThemePreference(nextPreference);
    const anchorEvent = event?.currentTarget ? { currentTarget: event.currentTarget } : null;
    showToast(message, 'tone-add', { placement: 'side', anchorEvent });
  };

  const handleNext = useCallback((isAuto = false) => {
    if (!currentAlbum?.songs?.length) return;
    const idx = currentAlbum.songs.findIndex(s => s.src === currentTrack.src);
    let nextIdx;

    if (playMode === 'shuffle') {
      if (currentAlbum.songs.length <= 1) nextIdx = 0;
      else {
        do {
          nextIdx = Math.floor(Math.random() * currentAlbum.songs.length);
        } while (nextIdx === idx);
      }
    } else {
      nextIdx = (idx + 1) % currentAlbum.songs.length;
    }

    setCurrentTrack(currentAlbum.songs[nextIdx]);
    setIsPlaying(true);
  }, [currentAlbum, currentTrack, playMode]);

  const handlePrev = useCallback(() => {
    if (!currentAlbum?.songs?.length) return;
    const idx = currentAlbum.songs.findIndex(s => s.src === currentTrack.src);
    let prevIdx;

    if (playMode === 'shuffle') {
      if (currentAlbum.songs.length <= 1) prevIdx = 0;
      else {
        do {
          prevIdx = Math.floor(Math.random() * currentAlbum.songs.length);
        } while (prevIdx === idx);
      }
    } else {
      prevIdx = (idx - 1 + currentAlbum.songs.length) % currentAlbum.songs.length;
    }

    setCurrentTrack(currentAlbum.songs[prevIdx]);
    setIsPlaying(true);
  }, [currentAlbum, currentTrack, playMode]);

  // 锁屏控制按钮（播放/暂停/上一首/下一首/进度控制）
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const mediaSession = navigator.mediaSession;

    const setHandler = (action, handler) => {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {
        // ignore unsupported actions
      }
    };

    setHandler('play', () => setIsPlaying(true));
    setHandler('pause', () => setIsPlaying(false));
    setHandler('previoustrack', () => handlePrev());
    setHandler('nexttrack', () => handleNext());
    setHandler('seekbackward', (details) => {
      const offset = details?.seekOffset ?? 10;
      const audio = audioRef.current;
      audio.currentTime = Math.max(audio.currentTime - offset, 0);
    });
    setHandler('seekforward', (details) => {
      const offset = details?.seekOffset ?? 10;
      const audio = audioRef.current;
      const maxTime = Number.isFinite(audio.duration) ? audio.duration : Infinity;
      audio.currentTime = Math.min(audio.currentTime + offset, maxTime);
    });
    setHandler('seekto', (details) => {
      if (typeof details?.seekTime !== 'number') return;
      const audio = audioRef.current;
      if (details.fastSeek && typeof audio.fastSeek === 'function') {
        audio.fastSeek(details.seekTime);
      } else {
        audio.currentTime = details.seekTime;
      }
    });

    return () => {
      setHandler('play', null);
      setHandler('pause', null);
      setHandler('previoustrack', null);
      setHandler('nexttrack', null);
      setHandler('seekbackward', null);
      setHandler('seekforward', null);
      setHandler('seekto', null);
    };
  }, [handlePrev, handleNext]);

  const handleSongEnd = useCallback(() => {
    if (playMode === 'single') {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      handleNext(true);
    }
  }, [handleNext, playMode]);

  useEffect(() => {
    const audio = audioRef.current;
    const onEnded = () => handleSongEnd();
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('ended', onEnded);
    };
  }, [handleSongEnd]);

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = p * duration;
  };

  const playSongFromAlbum = (album, song) => {
    if (
      currentAlbum?.id === album?.id &&
      currentTrack?.src &&
      currentTrack.src === song?.src
    ) {
      setIsPlaying((prev) => !prev);
      return;
    }
    setCurrentAlbum(album);
    setCurrentTrack(song);
    setIsPlaying(true);
  };

  const showToast = (message, tone = 'tone-add', anchorOrOptions) => {
    if (!message) return;
    setToastMessage(message);
    setToastTone(tone);
    let anchorEvent = null;
    let placement = 'anchor';
    if (anchorOrOptions?.currentTarget) {
      anchorEvent = anchorOrOptions;
    } else if (anchorOrOptions && typeof anchorOrOptions === 'object') {
      placement = anchorOrOptions.placement || 'anchor';
      anchorEvent = anchorOrOptions.anchorEvent || null;
    }
    const padding = 12;
    if (anchorEvent?.currentTarget) {
      const rect = anchorEvent.currentTarget.getBoundingClientRect();
      if (placement === 'side') {
        const estimateWidth = 160;
        const shouldFlip = rect.right + estimateWidth + padding > window.innerWidth;
        placement = shouldFlip ? 'side-left' : 'side-right';
        const x = shouldFlip ? rect.left - 12 : rect.right + 12;
        const y = rect.top + rect.height / 2;
        document.documentElement.style.setProperty('--toast-x', `${x}px`);
        document.documentElement.style.setProperty('--toast-y', `${y}px`);
      } else {
        const x = Math.min(
          Math.max(rect.left + rect.width / 2, padding),
          window.innerWidth - padding
        );
        const y = Math.min(Math.max(rect.top, padding), window.innerHeight - padding);
        document.documentElement.style.setProperty('--toast-x', `${x}px`);
        document.documentElement.style.setProperty('--toast-y', `${y}px`);
      }
    } else if (placement === 'side') {
      const sidebar = document.querySelector('.sidebar');
      const sidebarRight = sidebar?.getBoundingClientRect().right || padding;
      const x = sidebarRight + 12;
      const y = window.innerHeight / 2;
      document.documentElement.style.setProperty('--toast-x', `${x}px`);
      document.documentElement.style.setProperty('--toast-y', `${y}px`);
      placement = 'side-right';
    } else {
      document.documentElement.style.setProperty('--toast-x', `${window.innerWidth / 2}px`);
      document.documentElement.style.setProperty('--toast-y', `${padding}px`);
    }
    setToastPlacement(placement);
    setIsToastVisible(true);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setIsToastVisible(false);
    }, 1500);
  };

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

  const togglePlayMode = () => {
    const modes = ['loop', 'single', 'shuffle'];
    const currentIdx = modes.indexOf(playMode);
    setPlayMode(modes[(currentIdx + 1) % modes.length]);
  };

  const getPlayModeIcon = (size = 20, color = "currentColor") => {
    switch (playMode) {
      case 'loop': return <Repeat size={size} color={color} strokeWidth={2.4} absoluteStrokeWidth />;
      case 'single': return <Repeat1 size={size} color={color} strokeWidth={2.4} absoluteStrokeWidth />;
      case 'shuffle': return <Shuffle size={size} color={color} strokeWidth={2.4} absoluteStrokeWidth />;
      default: return <Repeat size={size} color={color} strokeWidth={2.4} absoluteStrokeWidth />;
    }
  };

  // 搜索逻辑
  const filteredAlbums = musicAlbums.filter(album =>
    album.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    album.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
    album.songs.some(song => song.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const searchTerm = searchQuery.trim().toLowerCase();
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
  }, [searchTerm]);
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
            systemTheme={systemTheme}
            onThemeToggle={handleThemeToggle}
          />

          <main className="main-view">
            <AnimatePresence mode="wait">
              {view === 'library' && (
                <motion.div key="library" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                </motion.div>
              )}
              {view === 'video' && (
                <motion.div key="video" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <VideoPage />
                </motion.div>
              )}
              {view === 'download' && (
                <motion.div key="download" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <DownloadPage />
                </motion.div>
              )}
              {view === 'about' && (
                <motion.div key="about" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <AboutPage />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>

      {view !== 'video' && (
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
            setIsLyricsOpen={setIsLyricsOpen}
            setIsAlbumListOpen={setIsAlbumListOpen}
            isTrackNameOverflowing={isTrackNameOverflowing}
            trackNameRef={trackNameRef}
          />

          <LyricsOverlay
            isLyricsOpen={isLyricsOpen}
            setIsLyricsOpen={setIsLyricsOpen}
            setIsAlbumListOpen={setIsAlbumListOpen}
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
          />

          <AlbumListOverlay
            isOpen={isAlbumListOpen}
            onClose={() => setIsAlbumListOpen(false)}
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
        </>
      )}

      {isVideoAccessOpen && (
        <div className="video-access-modal" onClick={() => setIsVideoAccessOpen(false)}>
          <div className="video-access-card" onClick={(e) => e.stopPropagation()}>
            <div className="video-access-title">视频访问</div>
            <p className="video-access-tip">关注公众号，发送“视频”获取密码。</p>
            <div className="video-access-qr">
              <img loading="lazy" src="https://1701701.xyz/img/gzh.jpg" alt="公众号二维码" />
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
                onClick={() => {
                  setIsVideoAccessOpen(false);
                  setVideoPassword('');
                  setVideoPasswordError('');
                }}
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
    </>
  );
};

export default App;
