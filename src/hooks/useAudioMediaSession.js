import { useEffect, useRef } from 'react';

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

const isIOSDevice = () => {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1)
  );
};

const normalizeMetadataText = (value) => (
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
);

const LOCK_SCREEN_TRACK_ACTION_COOLDOWN_MS = 280;

export const useAudioMediaSession = ({
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
}) => {
  const lastTrackActionAtRef = useRef(0);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (typeof window === 'undefined' || !('MediaMetadata' in window)) return;

    const mediaSession = navigator.mediaSession;
    const trackTitle = normalizeMetadataText(currentTrack?.name) || '未知歌曲';
    const artistName = normalizeMetadataText(currentSongInfo?.album?.artist || currentAlbum?.artist);
    const albumName = normalizeMetadataText(currentSongInfo?.album?.name || currentAlbum?.name);
    const lyricText = normalizeMetadataText(currentLyricText);
    const secondaryLine = lyricText || artistName;
    const metadata = {
      title: trackTitle,
      artist: secondaryLine,
      album: albumName,
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
    currentLyricText,
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
  }, [audioRef, currentTime, currentTrack?.src, duration]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const mediaSession = navigator.mediaSession;
    const hasMultipleTracks = (currentAlbum?.songs?.length || 0) > 1;
    const preferTrackControlsOnLockScreen = isIOSDevice() && hasMultipleTracks;

    const setHandler = (action, handler) => {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {
        // ignore unsupported actions
      }
    };
    const runTrackAction = (handler) => {
      const now = Date.now();
      if ((now - lastTrackActionAtRef.current) < LOCK_SCREEN_TRACK_ACTION_COOLDOWN_MS) {
        return;
      }
      lastTrackActionAtRef.current = now;
      handler();
    };

    setHandler('play', () => setIsPlaying(true));
    setHandler('pause', () => setIsPlaying(false));

    if (hasMultipleTracks) {
      setHandler('previoustrack', () => runTrackAction(handlePrev));
      setHandler('nexttrack', () => runTrackAction(handleNext));
    } else {
      setHandler('previoustrack', null);
      setHandler('nexttrack', null);
    }

    if (preferTrackControlsOnLockScreen) {
      setHandler('seekbackward', null);
      setHandler('seekforward', null);
    } else {
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
    }
    setHandler('seekto', (details) => {
      if (typeof details?.seekTime !== 'number') return;
      const audio = audioRef.current;
      if (details.fastSeek && typeof audio.fastSeek === 'function') {
        audio.fastSeek(details.seekTime);
      } else {
        audio.currentTime = details.seekTime;
      }
    });
  }, [audioRef, currentAlbum?.id, currentAlbum?.songs?.length, currentTrack?.src, handleNext, handlePrev, isPlaying, setIsPlaying]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const mediaSession = navigator.mediaSession;
    const supportedActions = [
      'play',
      'pause',
      'previoustrack',
      'nexttrack',
      'seekbackward',
      'seekforward',
      'seekto'
    ];
    return () => {
      supportedActions.forEach((action) => {
        try {
          mediaSession.setActionHandler(action, null);
        } catch {
          // ignore unsupported actions
        }
      });
    };
  }, []);
};
