import { useCallback, useEffect, useRef } from 'react';

import { isPlayerInBrowserFullscreen, isPlayerInWebFullscreen } from '../utils/videoFullscreenUtils';

export const useVideoFullscreenGuards = ({ activeVideo, dpRef, setActiveVideo }) => {
  const escapeCloseBlockedUntilRef = useRef(0);
  const fullscreenSessionPendingRef = useRef(false);

  const blockEscapeClose = useCallback((durationMs = 500) => {
    escapeCloseBlockedUntilRef.current = Date.now() + durationMs;
  }, []);

  const markFullscreenSessionPending = useCallback(() => {
    fullscreenSessionPendingRef.current = true;
  }, []);

  const markFullscreenSessionEnded = useCallback((durationMs = 700) => {
    if (fullscreenSessionPendingRef.current) {
      blockEscapeClose(durationMs);
    }
    fullscreenSessionPendingRef.current = false;
  }, [blockEscapeClose]);

  useEffect(() => {
    if (!activeVideo) {
      escapeCloseBlockedUntilRef.current = 0;
      fullscreenSessionPendingRef.current = false;
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const safeInvoke = (callback) => {
        try {
          callback?.();
        } catch {
          // Some WebKit fullscreen APIs throw in embedded WebViews.
        }
      };

      const player = dpRef.current;
      const isWebFullscreen = isPlayerInWebFullscreen(player);
      const isBrowserFullscreen = isPlayerInBrowserFullscreen(player);
      if (isWebFullscreen || isBrowserFullscreen || fullscreenSessionPendingRef.current) {
        blockEscapeClose(850);
        fullscreenSessionPendingRef.current = false;
        player?.fullScreen?.cancel?.('browser');
        player?.fullScreen?.cancel?.('web');
        const video = player?.video;
        safeInvoke(() => video?.webkitSetPresentationMode?.('inline'));
        safeInvoke(() => video?.webkitExitFullscreen?.());
        event.preventDefault();
        return;
      }

      if (
        isPlayerInBrowserFullscreen(player) ||
        Date.now() < escapeCloseBlockedUntilRef.current
      ) {
        return;
      }

      setActiveVideo(null);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeVideo, blockEscapeClose, dpRef, setActiveVideo]);

  return {
    markFullscreenSessionPending,
    markFullscreenSessionEnded
  };
};
