import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Repeat, Repeat1, Shuffle } from 'lucide-react';

import { useAudioLyricsState } from './useAudioLyricsState.js';
import { useAudioMediaSession } from './useAudioMediaSession.js';

const PLAYBACK_STATE_STORAGE_KEY = 'w1701701:audio-playback-state:v1';
const PLAYBACK_RECOVERY_DELAYS_MS = [1000, 2000, 5000];
const PLAYBACK_POSITION_PERSIST_THRESHOLD = 5;
const PLAYBACK_STATE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const PLAYBACK_HEALTHY_READY_STATE = 2;
const FOREGROUND_RECOVERY_DEDUP_WINDOW_MS = 320;

const toAbsoluteUrl = (value) => {
  if (!value || typeof value !== 'string') return '';
  try {
    if (typeof window !== 'undefined') {
      return new URL(value, window.location.href).href;
    }
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return new URL(value).href;
    }
    return '';
  } catch {
    return '';
  }
};

const readStoredPlaybackState = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PLAYBACK_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.trackSrc !== 'string' || !parsed.trackSrc) return null;
    const savedAt = Number(parsed.savedAt);
    if (Number.isFinite(savedAt) && (Date.now() - savedAt) > PLAYBACK_STATE_MAX_AGE_MS) {
      window.localStorage.removeItem(PLAYBACK_STATE_STORAGE_KEY);
      return null;
    }
    return {
      albumId: typeof parsed.albumId === 'string' ? parsed.albumId : '',
      currentTime: Number.isFinite(parsed.currentTime) ? parsed.currentTime : 0,
      isPlaying: Boolean(parsed.isPlaying),
      playMode: typeof parsed.playMode === 'string' ? parsed.playMode : 'loop',
      playbackRate: Number.isFinite(parsed.playbackRate) ? parsed.playbackRate : 1,
      trackSrc: parsed.trackSrc
    };
  } catch {
    return null;
  }
};

const writeStoredPlaybackState = (snapshot) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PLAYBACK_STATE_STORAGE_KEY, JSON.stringify({
      ...snapshot,
      savedAt: Date.now()
    }));
  } catch {
    // ignore storage failures
  }
};

export const useAudioPlayer = ({ musicAlbums, songIndex }) => {
  const [currentTrack, setCurrentTrackState] = useState(() => musicAlbums[0]?.songs?.[0]);
  const [currentAlbum, setCurrentAlbum] = useState(() => musicAlbums[0] || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playMode, setPlayMode] = useState('loop');
  const [isTrackNameOverflowing, setIsTrackNameOverflowing] = useState(false);
  const [trackChangeId, setTrackChangeId] = useState(0);

  const trackNameRef = useRef(null);
  const audioRef = useRef(new Audio());
  const lastTimelineRef = useRef({ time: 0, progress: 0 });
  const lastPersistedRef = useRef({ currentTime: -1, isPlaying: false, trackSrc: '' });
  const pendingRestoreRef = useRef(null);
  const recoveryTimerRef = useRef(null);
  const recoveryAttemptRef = useRef(0);
  const lastForegroundRecoveryRef = useRef({ at: 0, source: '' });
  const playbackStateRef = useRef({
    currentAlbum: null,
    currentTrack: null,
    currentTrackSrc: '',
    isPlaying: false,
    playMode: 'loop'
  });
  const storedPlaybackStateRef = useRef(readStoredPlaybackState());
  const hasRestoredStoredPlaybackRef = useRef(false);
  const playbackContextRef = useRef({
    currentAlbum: null,
    currentTrack: null,
    playMode: 'loop'
  });

  const currentSongInfo = useMemo(() => (
    currentTrack?.src ? songIndex.get(currentTrack.src) : null
  ), [currentTrack, songIndex]);
  const currentTrackSrc = currentTrack?.src || '';
  const currentLyricsUrl = useMemo(
    () => toAbsoluteUrl(currentTrack?.lrc),
    [currentTrack?.lrc]
  );

  const clearRecoveryTimer = useCallback(() => {
    if (typeof window === 'undefined' || recoveryTimerRef.current == null) return;
    window.clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = null;
  }, []);

  const persistPlaybackState = useCallback((force = false) => {
    const {
      currentAlbum: activeAlbum,
      currentTrack: activeTrack,
      isPlaying: intendedPlaying,
      playMode: activePlayMode
    } = playbackStateRef.current;
    if (!activeTrack?.src) return;

    const audio = audioRef.current;
    const nextSnapshot = {
      albumId: activeAlbum?.id || '',
      currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      isPlaying: intendedPlaying,
      playMode: activePlayMode,
      playbackRate: Number.isFinite(audio.playbackRate) ? audio.playbackRate : 1,
      trackSrc: activeTrack.src
    };
    const previousSnapshot = lastPersistedRef.current;
    const isSameTrack = previousSnapshot.trackSrc === nextSnapshot.trackSrc;
    const isSameIntent = previousSnapshot.isPlaying === nextSnapshot.isPlaying;
    const movedEnough = Math.abs(previousSnapshot.currentTime - nextSnapshot.currentTime) >= PLAYBACK_POSITION_PERSIST_THRESHOLD;
    if (!force && isSameTrack && isSameIntent && !movedEnough) {
      return;
    }

    lastPersistedRef.current = nextSnapshot;
    writeStoredPlaybackState(nextSnapshot);
  }, []);

  const applyPendingRestore = useCallback((audio) => {
    const pendingRestore = pendingRestoreRef.current;
    const activeTrackSrc = playbackStateRef.current.currentTrackSrc;
    if (!pendingRestore || !activeTrackSrc || pendingRestore.trackSrc !== activeTrackSrc) return;

    if (Number.isFinite(pendingRestore.playbackRate) && pendingRestore.playbackRate > 0) {
      audio.playbackRate = pendingRestore.playbackRate;
    }

    const nextTime = Math.max(pendingRestore.currentTime || 0, 0);
    if (nextTime > 0) {
      const maxTime = Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : nextTime;
      try {
        audio.currentTime = Math.min(nextTime, maxTime);
      } catch {
        return;
      }
      lastTimelineRef.current = {
        time: audio.currentTime || 0,
        progress: (audio.currentTime / audio.duration) * 100 || 0
      };
      setCurrentTime(audio.currentTime || 0);
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
    }

    pendingRestoreRef.current = null;
  }, []);

  const attemptPlaybackRecovery = useCallback(({ forceReload = false, onlyWhenPaused = true } = {}) => {
    const { currentTrackSrc: activeTrackSrc, isPlaying: intendedPlaying } = playbackStateRef.current;
    if (!activeTrackSrc || !intendedPlaying) return;

    const audio = audioRef.current;
    const isPaused = audio.paused === true;
    const readyState = Number.isFinite(audio.readyState) ? audio.readyState : 0;
    const canContinueWithoutRecovery = !isPaused && readyState >= PLAYBACK_HEALTHY_READY_STATE;
    if (onlyWhenPaused && !forceReload && canContinueWithoutRecovery) {
      return;
    }

    const previousTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const normalizedTrackSrc = toAbsoluteUrl(activeTrackSrc);
    if (normalizedTrackSrc && audio.src !== normalizedTrackSrc) {
      audio.src = normalizedTrackSrc;
    }
    if (previousTime > 0) {
      pendingRestoreRef.current = {
        currentTime: previousTime,
        playbackRate: Number.isFinite(audio.playbackRate) ? audio.playbackRate : 1,
        trackSrc: activeTrackSrc
      };
    }
    if (forceReload && typeof audio.load === 'function') {
      audio.load();
    }
    applyPendingRestore(audio);
    audio.play().catch(() => { });
  }, [applyPendingRestore]);

  const schedulePlaybackRecovery = useCallback(({ forceReload = false } = {}) => {
    if (typeof window === 'undefined') return;
    const { currentTrackSrc: activeTrackSrc, isPlaying: intendedPlaying } = playbackStateRef.current;
    if (!activeTrackSrc || !intendedPlaying) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    clearRecoveryTimer();
    const retryIndex = Math.min(recoveryAttemptRef.current, PLAYBACK_RECOVERY_DELAYS_MS.length - 1);
    recoveryTimerRef.current = window.setTimeout(() => {
      recoveryTimerRef.current = null;
      recoveryAttemptRef.current += 1;
      attemptPlaybackRecovery({ forceReload, onlyWhenPaused: false });
    }, PLAYBACK_RECOVERY_DELAYS_MS[retryIndex]);
  }, [attemptPlaybackRecovery, clearRecoveryTimer]);

  const attemptForegroundRecovery = useCallback((source) => {
    const now = Date.now();
    const previous = lastForegroundRecoveryRef.current;
    const isForegroundSource = source === 'visibilitychange' || source === 'pageshow';
    const wasForegroundSource = previous.source === 'visibilitychange' || previous.source === 'pageshow';
    if (
      isForegroundSource &&
      wasForegroundSource &&
      (now - previous.at) < FOREGROUND_RECOVERY_DEDUP_WINDOW_MS
    ) {
      return;
    }
    lastForegroundRecoveryRef.current = { at: now, source };
    attemptPlaybackRecovery({ onlyWhenPaused: true });
  }, [attemptPlaybackRecovery]);

  const setCurrentTrack = useCallback((nextTrackOrUpdater) => {
    setCurrentTrackState((previousTrack) => {
      const nextTrack = typeof nextTrackOrUpdater === 'function'
        ? nextTrackOrUpdater(previousTrack)
        : nextTrackOrUpdater;

      if (nextTrack?.src !== previousTrack?.src) {
        setTrackChangeId((previousId) => previousId + 1);
      }

      return nextTrack;
    });
  }, []);

  useEffect(() => {
    if (currentTrack?.src) return;
    const firstAlbum = musicAlbums[0];
    const firstSong = firstAlbum?.songs?.[0];
    if (!firstAlbum || !firstSong) return;
    const timerId = setTimeout(() => {
      setCurrentAlbum((prev) => (prev?.id ? prev : firstAlbum));
      setCurrentTrack((prev) => (prev?.src ? prev : firstSong));
    }, 0);
    return () => clearTimeout(timerId);
  }, [currentTrack?.src, musicAlbums, setCurrentTrack]);

  const { lyrics, currentLyricIndex } = useAudioLyricsState({
    currentLyricsUrl,
    currentTime,
    currentTrackSrc
  });
  const currentLyricText = useMemo(() => {
    const activeLyric = lyrics[currentLyricIndex];
    if (!activeLyric?.text) return '';
    if (currentTime + 0.05 < activeLyric.time) return '';
    return activeLyric.text.trim();
  }, [currentLyricIndex, currentTime, lyrics]);

  useEffect(() => {
    const audio = audioRef.current;
    audio.preload = 'auto';
    audio.playsInline = true;
    const updateProgress = () => {
      const nextTime = audio.currentTime || 0;
      const nextProgress = (nextTime / audio.duration) * 100 || 0;
      const prev = lastTimelineRef.current;
      if (
        Math.abs(nextTime - prev.time) < 0.2 &&
        Math.abs(nextProgress - prev.progress) < 0.25
      ) {
        return;
      }
      lastTimelineRef.current = { time: nextTime, progress: nextProgress };
      setCurrentTime(nextTime);
      setProgress(nextProgress);
      persistPlaybackState();
    };
    const onLoadedMetadata = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(nextDuration);
      applyPendingRestore(audio);
      const nextTime = audio.currentTime || 0;
      const nextProgress = (nextTime / nextDuration) * 100 || 0;
      setCurrentTime(nextTime);
      setProgress(nextProgress);
      lastTimelineRef.current = {
        time: nextTime,
        progress: nextProgress
      };
      persistPlaybackState(true);
    };
    const onCanPlay = () => {
      applyPendingRestore(audio);
    };
    const onPlaybackHealthy = () => {
      recoveryAttemptRef.current = 0;
      clearRecoveryTimer();
      persistPlaybackState(true);
    };
    const onPause = () => {
      persistPlaybackState(true);
      if (playbackStateRef.current.isPlaying) {
        schedulePlaybackRecovery();
      }
    };
    const onWaiting = () => schedulePlaybackRecovery();
    const onStalled = () => schedulePlaybackRecovery({ forceReload: true });
    const onError = () => schedulePlaybackRecovery({ forceReload: true });
    const onSuspend = () => persistPlaybackState(true);
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('playing', onPlaybackHealthy);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('error', onError);
    audio.addEventListener('suspend', onSuspend);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('playing', onPlaybackHealthy);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('suspend', onSuspend);
    };
  }, [applyPendingRestore, clearRecoveryTimer, persistPlaybackState, schedulePlaybackRecovery, setCurrentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!currentTrackSrc) {
      audio.pause();
      return;
    }
    if (isPlaying) {
      const normalizedTrackSrc = toAbsoluteUrl(currentTrackSrc);
      if (normalizedTrackSrc && audio.src !== normalizedTrackSrc) {
        audio.src = normalizedTrackSrc;
      }
      applyPendingRestore(audio);
      audio.play().catch(() => { });
      return;
    }
    audio.pause();
  }, [applyPendingRestore, currentTrackSrc, isPlaying]);

  useEffect(() => {
    playbackContextRef.current = {
      currentAlbum,
      currentTrack,
      playMode
    };
    playbackStateRef.current = {
      currentAlbum,
      currentTrack,
      currentTrackSrc,
      isPlaying,
      playMode
    };
  }, [currentAlbum, currentTrack, currentTrackSrc, isPlaying, playMode]);

  useEffect(() => {
    const storedPlaybackState = storedPlaybackStateRef.current;
    if (hasRestoredStoredPlaybackRef.current || !storedPlaybackState?.trackSrc) return;
    if (musicAlbums.length === 0 || songIndex.size === 0) return;

    const resolvedSongInfo = songIndex.get(storedPlaybackState.trackSrc);
    if (!resolvedSongInfo?.album || !resolvedSongInfo?.song) {
      hasRestoredStoredPlaybackRef.current = true;
      return;
    }

    hasRestoredStoredPlaybackRef.current = true;
    pendingRestoreRef.current = {
      currentTime: Math.max(storedPlaybackState.currentTime || 0, 0),
      playbackRate: storedPlaybackState.playbackRate || 1,
      trackSrc: storedPlaybackState.trackSrc
    };
    setCurrentAlbum(resolvedSongInfo.album);
    setCurrentTrack(resolvedSongInfo.song);
    if (['loop', 'single', 'shuffle'].includes(storedPlaybackState.playMode)) {
      setPlayMode(storedPlaybackState.playMode);
    }
    setCurrentTime(Math.max(storedPlaybackState.currentTime || 0, 0));
    if (storedPlaybackState.isPlaying) {
      setIsPlaying(true);
    }
  }, [musicAlbums.length, setCurrentTrack, songIndex]);

  useEffect(() => {
    persistPlaybackState(true);
  }, [currentAlbum?.id, currentTrack?.src, isPlaying, persistPlaybackState, playMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearRecoveryTimer();
        persistPlaybackState(true);
        return;
      }
      attemptForegroundRecovery('visibilitychange');
    };
    const onPageHide = () => {
      clearRecoveryTimer();
      persistPlaybackState(true);
    };
    const onPageShow = () => {
      attemptForegroundRecovery('pageshow');
    };
    const onOnline = () => {
      attemptPlaybackRecovery({ forceReload: true, onlyWhenPaused: true });
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', onOnline);
    };
  }, [attemptForegroundRecovery, attemptPlaybackRecovery, clearRecoveryTimer, persistPlaybackState]);

  useEffect(() => () => {
    clearRecoveryTimer();
    persistPlaybackState(true);
  }, [clearRecoveryTimer, persistPlaybackState]);

  useEffect(() => {
    if (!trackNameRef.current) return;
    const isOverflowing = trackNameRef.current.scrollWidth > trackNameRef.current.clientWidth;
    setIsTrackNameOverflowing(isOverflowing);
  }, [currentTrack, isPlaying]);

  const handleNext = useCallback(() => {
    const { currentAlbum: activeAlbum, currentTrack: activeTrack, playMode: activePlayMode } = playbackContextRef.current;
    if (!activeAlbum?.songs?.length || !activeTrack?.src) return;
    const idx = activeAlbum.songs.findIndex((song) => song.src === activeTrack.src);
    let nextIdx;

    if (activePlayMode === 'shuffle') {
      if (activeAlbum.songs.length <= 1) {
        nextIdx = 0;
      } else {
        do {
          nextIdx = Math.floor(Math.random() * activeAlbum.songs.length);
        } while (nextIdx === idx);
      }
    } else {
      nextIdx = (idx + 1) % activeAlbum.songs.length;
    }

    setCurrentTrack(activeAlbum.songs[nextIdx]);
    setIsPlaying(true);
  }, [setCurrentTrack]);

  const handlePrev = useCallback(() => {
    const { currentAlbum: activeAlbum, currentTrack: activeTrack, playMode: activePlayMode } = playbackContextRef.current;
    if (!activeAlbum?.songs?.length || !activeTrack?.src) return;
    const idx = activeAlbum.songs.findIndex((song) => song.src === activeTrack.src);
    let prevIdx;

    if (activePlayMode === 'shuffle') {
      if (activeAlbum.songs.length <= 1) {
        prevIdx = 0;
      } else {
        do {
          prevIdx = Math.floor(Math.random() * activeAlbum.songs.length);
        } while (prevIdx === idx);
      }
    } else {
      prevIdx = (idx - 1 + activeAlbum.songs.length) % activeAlbum.songs.length;
    }

    setCurrentTrack(activeAlbum.songs[prevIdx]);
    setIsPlaying(true);
  }, [setCurrentTrack]);

  useAudioMediaSession({
    audioRef,
    currentAlbum,
    currentLyricText,
    currentSongInfo,
    currentTime,
    currentTrack,
    duration,
    handleNext,
    handlePrev,
    isPlaying,
    setIsPlaying
  });

  const handleSongEnd = useCallback(() => {
    if (playMode === 'single') {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => { });
    } else {
      handleNext();
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

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleSeek = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    audioRef.current.currentTime = ratio * duration;
  }, [duration]);

  const playSongFromAlbum = useCallback((album, song) => {
    if (!album || !song) return;
    if (
      currentAlbum?.id === album.id &&
      currentTrack?.src &&
      currentTrack.src === song.src
    ) {
      setIsPlaying((prev) => !prev);
      return;
    }
    setCurrentAlbum(album);
    setCurrentTrack(song);
    setIsPlaying(true);
  }, [currentAlbum, currentTrack, setCurrentTrack]);

  const pausePlayback = useCallback(() => {
    setIsPlaying(false);
    audioRef.current.pause();
  }, []);

  const togglePlayMode = useCallback(() => {
    const modes = ['loop', 'single', 'shuffle'];
    const currentIdx = modes.indexOf(playMode);
    setPlayMode(modes[(currentIdx + 1) % modes.length]);
  }, [playMode]);

  const getPlayModeIcon = useCallback((size = 20, color = 'currentColor') => {
    switch (playMode) {
      case 'loop':
        return createElement(Repeat, { size, color, strokeWidth: 2.4, absoluteStrokeWidth: true });
      case 'single':
        return createElement(Repeat1, { size, color, strokeWidth: 2.4, absoluteStrokeWidth: true });
      case 'shuffle':
        return createElement(Shuffle, { size, color, strokeWidth: 2.4, absoluteStrokeWidth: true });
      default:
        return createElement(Repeat, { size, color, strokeWidth: 2.4, absoluteStrokeWidth: true });
    }
  }, [playMode]);

  return {
    currentTrack,
    setCurrentTrack,
    trackChangeId,
    currentAlbum,
    setCurrentAlbum,
    isPlaying,
    setIsPlaying,
    progress,
    currentTime,
    duration,
    lyrics,
    currentLyricIndex,
    playMode,
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
  };
};
