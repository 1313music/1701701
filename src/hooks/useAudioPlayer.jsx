import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Repeat, Repeat1, Shuffle } from 'lucide-react';

import { useAudioLyricsState } from './useAudioLyricsState.js';
import { useAudioMediaSession } from './useAudioMediaSession.js';

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
  }, [setCurrentTrack]);

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
      audio.play().catch(() => { });
      return;
    }
    audio.pause();
  }, [currentTrackSrc, isPlaying]);

  useEffect(() => {
    playbackContextRef.current = {
      currentAlbum,
      currentTrack,
      playMode
    };
  }, [currentAlbum, currentTrack, playMode]);

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
