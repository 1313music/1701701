import { useEffect } from 'react';

import {
  isPlayerInBrowserFullscreen,
  isVideoNativeFullscreen
} from '../utils/videoFullscreenUtils';

const fallbackThumb = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">' +
  '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0%" stop-color="#1f2937"/><stop offset="100%" stop-color="#111827"/>' +
  '</linearGradient></defs>' +
  '<rect width="640" height="360" fill="url(#g)"/>' +
  '<rect x="40" y="40" width="560" height="280" rx="28" ry="28" fill="rgba(255,255,255,0.08)"/>' +
  '<text x="50%" y="50%" font-family="Arial, sans-serif" font-size="44" fill="rgba(255,255,255,0.78)" text-anchor="middle">民谣俱乐部</text>' +
  '<text x="50%" y="64%" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.6)" text-anchor="middle">1701701.xyz</text>' +
  '</svg>'
)}`;

export const useDPlayerInstance = ({
  activeVideo,
  activeVideoKey,
  activeVideoKeyRef,
  canPlayInline,
  fallbackType,
  fallbackUrl,
  isResolving,
  markFullscreenSessionEnded,
  markFullscreenSessionPending,
  onPlaybackError,
  onPlayerLoadError,
  playerRef,
  dpRef,
  resolvedType,
  resolvedUrl,
  resolvedVideoKey
}) => {
  useEffect(() => {
    if (
      !activeVideo ||
      resolvedVideoKey !== activeVideoKey ||
      isResolving ||
      !resolvedUrl ||
      !canPlayInline(resolvedUrl, resolvedType)
    ) {
      return undefined;
    }
    const container = playerRef.current;
    if (!container) return undefined;
    let canceled = false;
    let player = null;
    let handlePlaybackFailure = null;
    let removeFullscreenExitGuard = null;
    let removeTouchToggleGuard = null;
    const effectVideoKey = activeVideoKey;
    const isStalePlayerEvent = () => canceled || activeVideoKeyRef.current !== effectVideoKey;
    const blockContextMenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    };

    const setupPlayer = async () => {
      try {
        const [{ default: DPlayer }, { default: Hls }] = await Promise.all([
          import('dplayer'),
          import('hls.js/dist/hls.light.mjs')
        ]);
        if (isStalePlayerEvent()) return;

        if (typeof window !== 'undefined' && !window.Hls) {
          window.Hls = Hls;
        }

        if (dpRef.current) {
          dpRef.current.destroy();
          dpRef.current = null;
        }

        container.innerHTML = '';
        container.classList.remove('dplayer-auto-hide');
        container.classList.remove('dplayer-controls-visible');
        player = new DPlayer({
          container,
          autoplay: true,
          preload: 'metadata',
          theme: '#1d1d1f',
          video: {
            url: resolvedUrl,
            pic: activeVideo.thumb || fallbackThumb,
            type: resolvedType
          },
          pluginOptions: {
            hls: {
              enableWorker: true,
              lowLatencyMode: true
            }
          }
        });

        if (isStalePlayerEvent()) {
          player.destroy();
          player = null;
          return;
        }

        dpRef.current = player;
        const bindFullscreenExitGuard = () => {
          const markEscapeHandled = () => markFullscreenSessionEnded();
          const handleDocumentFullscreenChange = () => {
            if (isPlayerInBrowserFullscreen(player)) {
              markFullscreenSessionPending();
            } else {
              markEscapeHandled();
            }
          };
          const handleVideoPresentationModeChange = () => {
            if (isVideoNativeFullscreen(player?.video)) {
              markFullscreenSessionPending();
            } else {
              markEscapeHandled();
            }
          };
          const markEnter = () => markFullscreenSessionPending();
          const browserFullButton = container.querySelector('.dplayer-full-icon');
          const webFullButton = container.querySelector('.dplayer-full-in-icon');

          document.addEventListener('fullscreenchange', handleDocumentFullscreenChange);
          document.addEventListener('webkitfullscreenchange', handleDocumentFullscreenChange);
          document.addEventListener('mozfullscreenchange', handleDocumentFullscreenChange);
          document.addEventListener('msfullscreenchange', handleDocumentFullscreenChange);
          document.addEventListener('MSFullscreenChange', handleDocumentFullscreenChange);
          if (typeof player.on === 'function') {
            player.on('fullscreen', markEnter);
            player.on('webfullscreen', markEnter);
            player.on('fullscreen_cancel', markEscapeHandled);
            player.on('webfullscreen_cancel', markEscapeHandled);
          }
          browserFullButton?.addEventListener('click', markEnter, true);
          webFullButton?.addEventListener('click', markEnter, true);
          player.video?.addEventListener('webkitbeginfullscreen', markEnter);
          player.video?.addEventListener('webkitendfullscreen', markEscapeHandled);
          player.video?.addEventListener('webkitpresentationmodechanged', handleVideoPresentationModeChange);

          return () => {
            document.removeEventListener('fullscreenchange', handleDocumentFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleDocumentFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleDocumentFullscreenChange);
            document.removeEventListener('msfullscreenchange', handleDocumentFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleDocumentFullscreenChange);
            if (typeof player?.off === 'function') {
              player.off('fullscreen', markEnter);
              player.off('webfullscreen', markEnter);
              player.off('fullscreen_cancel', markEscapeHandled);
              player.off('webfullscreen_cancel', markEscapeHandled);
            }
            browserFullButton?.removeEventListener('click', markEnter, true);
            webFullButton?.removeEventListener('click', markEnter, true);
            player?.video?.removeEventListener('webkitbeginfullscreen', markEnter);
            player?.video?.removeEventListener('webkitendfullscreen', markEscapeHandled);
            player?.video?.removeEventListener('webkitpresentationmodechanged', handleVideoPresentationModeChange);
          };
        };
        removeFullscreenExitGuard = bindFullscreenExitGuard();

        const isTouchDevice = typeof window !== 'undefined' && (
          'ontouchstart' in window ||
          navigator.maxTouchPoints > 0 ||
          window.matchMedia?.('(pointer: coarse)')?.matches
        );

        if (isTouchDevice && player.controller) {
          const videoWrap = container.querySelector('.dplayer-video-wrap');
          const controllerMask = container.querySelector('.dplayer-controller-mask');
          const controllerRoot = container.querySelector('.dplayer-controller');
          const webFullButton = container.querySelector('.dplayer-full-in-icon');
          let lastToggleAt = 0;
          let hideTimer = null;

          const clearAutoHide = () => {
            if (hideTimer) {
              clearTimeout(hideTimer);
              hideTimer = null;
            }
          };

          const scheduleAutoHide = () => {
            clearAutoHide();
            if (!player?.controller || !player?.video || player.video.paused) return;
            hideTimer = setTimeout(() => {
              if (canceled || !player?.controller || !player?.video || player.video.paused) return;
              if (typeof player.controller.hide === 'function') {
                player.controller.hide();
              }
            }, 2200);
          };

          const showControls = () => {
            if (typeof player.controller.show === 'function') {
              player.controller.show();
            }
            scheduleAutoHide();
          };

          const onPlay = () => scheduleAutoHide();
          const onPauseOrEnded = () => {
            clearAutoHide();
            if (typeof player.controller.show === 'function') {
              player.controller.show();
            }
          };
          const onControllerTouchStart = () => clearAutoHide();
          const onControllerTouchEnd = () => scheduleAutoHide();
          const blockWebFullscreen = (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
              event.stopImmediatePropagation();
            }
            if (player?.fullScreen?.isFullScreen?.('web')) {
              player.fullScreen.cancel('web');
            }
          };

          const toggleGuard = (event) => {
            if (!player?.controller) return;
            const now = Date.now();
            const delta = now - lastToggleAt;
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
              event.stopImmediatePropagation();
            }
            if (delta < 260) return;
            lastToggleAt = now;
            if (typeof player.controller.isShow === 'function' && player.controller.isShow()) {
              clearAutoHide();
              if (typeof player.controller.hide === 'function') {
                player.controller.hide();
              }
              return;
            }
            showControls();
          };

          videoWrap?.addEventListener('click', toggleGuard, true);
          controllerMask?.addEventListener('click', toggleGuard, true);
          controllerRoot?.addEventListener('touchstart', onControllerTouchStart, { passive: true });
          controllerRoot?.addEventListener('touchend', onControllerTouchEnd, { passive: true });
          webFullButton?.addEventListener('click', blockWebFullscreen, true);
          if (webFullButton) {
            webFullButton.style.display = 'none';
            webFullButton.setAttribute('aria-hidden', 'true');
          }
          if (typeof player.on === 'function') {
            player.on('play', onPlay);
            player.on('pause', onPauseOrEnded);
            player.on('ended', onPauseOrEnded);
          }

          removeTouchToggleGuard = () => {
            clearAutoHide();
            videoWrap?.removeEventListener('click', toggleGuard, true);
            controllerMask?.removeEventListener('click', toggleGuard, true);
            controllerRoot?.removeEventListener('touchstart', onControllerTouchStart);
            controllerRoot?.removeEventListener('touchend', onControllerTouchEnd);
            webFullButton?.removeEventListener('click', blockWebFullscreen, true);
            if (typeof player?.off === 'function') {
              player.off('play', onPlay);
              player.off('pause', onPauseOrEnded);
              player.off('ended', onPauseOrEnded);
            }
          };
        }

        handlePlaybackFailure = () => {
          if (isStalePlayerEvent()) {
            return;
          }
          onPlaybackError();
        };
        player.on('error', handlePlaybackFailure);
        if (player.video) {
          player.video.addEventListener('error', handlePlaybackFailure);
        }

        if (player.contextmenu && typeof player.contextmenu.destroy === 'function') {
          player.contextmenu.destroy();
        }
        container.addEventListener('contextmenu', blockContextMenu, true);
        if (player.video) {
          player.video.addEventListener('contextmenu', blockContextMenu, true);
        }
      } catch {
        if (!isStalePlayerEvent()) {
          onPlayerLoadError();
        }
      }
    };

    void setupPlayer();

    return () => {
      canceled = true;
      if (removeFullscreenExitGuard) {
        removeFullscreenExitGuard();
        removeFullscreenExitGuard = null;
      }
      if (removeTouchToggleGuard) {
        removeTouchToggleGuard();
        removeTouchToggleGuard = null;
      }
      container.removeEventListener('contextmenu', blockContextMenu, true);
      if (player && typeof player.off === 'function' && handlePlaybackFailure) {
        player.off('error', handlePlaybackFailure);
      }
      if (player?.video) {
        player.video.removeEventListener('contextmenu', blockContextMenu, true);
        if (handlePlaybackFailure) {
          player.video.removeEventListener('error', handlePlaybackFailure);
        }
      }
      if (player) {
        player.destroy();
      }
      if (dpRef.current === player) {
        dpRef.current = null;
      }
    };
  }, [
    activeVideo,
    activeVideoKey,
    activeVideoKeyRef,
    canPlayInline,
    fallbackType,
    fallbackUrl,
    isResolving,
    markFullscreenSessionEnded,
    markFullscreenSessionPending,
    onPlaybackError,
    onPlayerLoadError,
    playerRef,
    dpRef,
    resolvedType,
    resolvedUrl,
    resolvedVideoKey
  ]);

  useEffect(() => {
    if (activeVideo) return;
    if (dpRef.current) {
      dpRef.current.destroy();
      dpRef.current = null;
    }
  }, [activeVideo, dpRef]);
};
