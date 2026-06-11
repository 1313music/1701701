import { useCallback, useLayoutEffect, useRef } from 'react';

import { useDPlayerInstance } from './useDPlayerInstance.js';
import { useVideoFullscreenGuards } from './useVideoFullscreenGuards.js';
import { useVideoPlaybackShortcuts } from './useVideoPlaybackShortcuts.js';
import { useVideoSourceResolver } from './useVideoSourceResolver.js';

export const useVideoPlayback = ({
  activeVideo,
  activeVideoKey,
  nextWatchEpisode,
  prevWatchEpisode,
  setActiveVideo
}) => {
  const playerRef = useRef(null);
  const dpRef = useRef(null);
  const activeVideoKeyRef = useRef('');

  useLayoutEffect(() => {
    activeVideoKeyRef.current = activeVideoKey;
  }, [activeVideoKey]);

  const {
    resolvedUrl,
    fallbackUrl,
    fallbackType,
    isResolving,
    resolveError,
    resolvedType,
    resolvedVideoKey,
    canPlayInline,
    canSwitchToBackup,
    backupActionLabel,
    playerContainerKey,
    handleSwitchToBackup,
    handleReloadVideo,
    trySwitchToFallback,
    setPlaybackError
  } = useVideoSourceResolver({
    activeVideo,
    activeVideoKey
  });

  const {
    markFullscreenSessionPending,
    markFullscreenSessionEnded
  } = useVideoFullscreenGuards({
    activeVideo,
    dpRef,
    setActiveVideo
  });

  useVideoPlaybackShortcuts({
    activeVideo,
    dpRef,
    nextWatchEpisode,
    prevWatchEpisode,
    setActiveVideo
  });

  const handlePlaybackError = useCallback(() => {
    if (trySwitchToFallback()) {
      return;
    }
    setPlaybackError('视频播放失败，请稍后重试');
  }, [setPlaybackError, trySwitchToFallback]);

  const handlePlayerLoadError = useCallback(() => {
    setPlaybackError('播放器加载失败');
  }, [setPlaybackError]);

  useDPlayerInstance({
    activeVideo,
    activeVideoKey,
    activeVideoKeyRef,
    canPlayInline,
    fallbackType,
    fallbackUrl,
    isResolving,
    markFullscreenSessionEnded,
    markFullscreenSessionPending,
    onPlaybackError: handlePlaybackError,
    onPlayerLoadError: handlePlayerLoadError,
    playerRef,
    dpRef,
    resolvedType,
    resolvedUrl,
    resolvedVideoKey
  });

  return {
    playerRef,
    isResolving,
    resolveError,
    resolvedUrl,
    resolvedType,
    canPlayInline,
    canSwitchToBackup,
    backupActionLabel,
    playerContainerKey,
    handleSwitchToBackup,
    handleReloadVideo
  };
};
