import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Repeat, Repeat1, Shuffle } from 'lucide-react';
import { parseLyrics } from '../utils/lyricUtils';

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

export const useAudioPlayer = ({ musicAlbums, songIndex }) => {
  const [currentTrack, setCurrentTrack] = useState(() => musicAlbums[0]?.songs?.[0]);
  const [currentAlbum, setCurrentAlbum] = useState(() => musicAlbums[0] || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState([]);
  const [playMode, setPlayMode] = useState('loop');
  const [isTrackNameOverflowing, setIsTrackNameOverflowing] = useState(false);

  const trackNameRef = useRef(null);
  const audioRef = useRef(new Audio());
  const lyricsRequestIdRef = useRef(0);
  const lastTimelineRef = useRef({ time: 0, progress: 0 });

  const currentSongInfo = useMemo(() => (
    currentTrack?.src ? songIndex.get(currentTrack.src) : null
  ), [currentTrack, songIndex]);

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
  }, [currentTrack?.src, musicAlbums]);

  const currentLyricIndex = useMemo(() => {
    const index = lyrics.findIndex((line, i) => (
      currentTime >= line.time && (!lyrics[i + 1] || currentTime < lyrics[i + 1].time)
    ));
    return index === -1 ? 0 : index;
  }, [currentTime, lyrics]);

  useEffect(() => {
    const audio = audioRef.current;
    audio.preload = 'metadata';
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
    };
    const onLoadedMetadata = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(nextDuration);
      lastTimelineRef.current = { time: audio.currentTime || 0, progress: 0 };
    };
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, []);

  useEffect(() => {
    if (!currentTrack?.src) return;
    const audio = audioRef.current;
    if (audio.src !== currentTrack.src) {
      audio.src = currentTrack.src;
    }
    if (isPlaying) audio.play().catch(() => { });

    let canceled = false;
    const requestId = ++lyricsRequestIdRef.current;
    const loadLyrics = async () => {
      const lrcUrl = currentTrack.lrc;
      if (!lrcUrl || !lrcUrl.startsWith('http')) {
        await Promise.resolve();
        if (canceled || lyricsRequestIdRef.current !== requestId) return;
        setLyrics([]);
        return;
      }

      try {
        const response = await fetch(lrcUrl);
        const text = await response.text();
        if (canceled || lyricsRequestIdRef.current !== requestId) return;
        setLyrics(parseLyrics(text));
      } catch {
        if (canceled || lyricsRequestIdRef.current !== requestId) return;
        setLyrics([]);
      }
    };

    loadLyrics();
    return () => {
      canceled = true;
    };
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (isPlaying) audioRef.current.play().catch(() => { });
    else audioRef.current.pause();
  }, [isPlaying]);

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

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

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

  useEffect(() => {
    if (!trackNameRef.current) return;
    const isOverflowing = trackNameRef.current.scrollWidth > trackNameRef.current.clientWidth;
    setIsTrackNameOverflowing(isOverflowing);
  }, [currentTrack, isPlaying]);

  const handleNext = useCallback(() => {
    if (!currentAlbum?.songs?.length || !currentTrack?.src) return;
    const idx = currentAlbum.songs.findIndex((song) => song.src === currentTrack.src);
    let nextIdx;

    if (playMode === 'shuffle') {
      if (currentAlbum.songs.length <= 1) {
        nextIdx = 0;
      } else {
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
    if (!currentAlbum?.songs?.length || !currentTrack?.src) return;
    const idx = currentAlbum.songs.findIndex((song) => song.src === currentTrack.src);
    let prevIdx;

    if (playMode === 'shuffle') {
      if (currentAlbum.songs.length <= 1) {
        prevIdx = 0;
      } else {
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
  }, [handleNext, handlePrev]);

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
  }, [currentAlbum, currentTrack]);

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
      case 'loop': return <Repeat size={size} color={color} strokeWidth={2.4} absoluteStrokeWidth />;
      case 'single': return <Repeat1 size={size} color={color} strokeWidth={2.4} absoluteStrokeWidth />;
      case 'shuffle': return <Shuffle size={size} color={color} strokeWidth={2.4} absoluteStrokeWidth />;
      default: return <Repeat size={size} color={color} strokeWidth={2.4} absoluteStrokeWidth />;
    }
  }, [playMode]);

  return {
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
