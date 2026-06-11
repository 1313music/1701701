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
  danmakuOptions,
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
        const playerOptions = {
          container,
          autoplay: true,
          lang: 'zh-cn',
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
        };
        if (danmakuOptions) {
          playerOptions.danmaku = danmakuOptions;
        }

        player = new DPlayer(playerOptions);

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
          const commentInput = container.querySelector('.dplayer-comment-input');
          const commentSendButton = container.querySelector('.dplayer-send-icon');
          let lastToggleAt = 0;
          let hideTimer = null;
          let lastCommentSendAt = 0;

          const isCommentControlTarget = (target) => Boolean(
            target?.closest?.(
              '.dplayer-comment-box, .dplayer-comment-input, .dplayer-comment-setting-box, .dplayer-comment-setting-icon, .dplayer-send-icon',
            ),
          );

          const isCommentInputActive = () => Boolean(
            player?.controller?.disableAutoHide ||
              container.classList.contains('dplayer-show-controller') ||
              controllerRoot?.classList.contains('dplayer-controller-comment') ||
              document.activeElement?.closest?.('.dplayer-comment-box'),
          );

          const clearAutoHide = () => {
            if (hideTimer) {
              clearTimeout(hideTimer);
              hideTimer = null;
            }
          };

          const stopHandledEvent = (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
              event.stopImmediatePropagation();
            }
          };

          const focusCommentInput = () => {
            if (!commentInput) return;
            try {
              commentInput.focus({ preventScroll: true });
            } catch {
              commentInput.focus();
            }
          };

          const parseDanmakuColor = (value) => {
            const raw = String(value || '#fff').trim().replace(/^#/, '');
            const hex = raw.length === 3
              ? raw.split('').map((character) => `${character}${character}`).join('')
              : raw;
            return /^[0-9a-f]{6}$/i.test(hex) ? Number.parseInt(hex, 16) : 0xffffff;
          };

          const getSelectedDanmakuType = () => {
            const raw = container.querySelector('.dplayer-comment-setting-type input:checked')?.value;
            const parsed = Number.parseInt(raw, 10);
            return Number.isFinite(parsed) ? parsed : 0;
          };

          const getSelectedDanmakuColor = () => {
            const raw = container.querySelector('.dplayer-comment-setting-color input:checked')?.value;
            return parseDanmakuColor(raw);
          };

          const sendComment = (event) => {
            stopHandledEvent(event);
            const now = Date.now();
            if (now - lastCommentSendAt < 350) {
              return;
            }
            lastCommentSendAt = now;
            clearAutoHide();
            container.classList.add('dplayer-comment-input-active');
            if (typeof player.controller.show === 'function') {
              player.controller.show();
            }

            const text = String(commentInput?.value || '').trim();
            if (!text) {
              if (typeof player.notice === 'function') {
                player.notice('要输入弹幕内容啊喂！');
              }
              requestAnimationFrame(focusCommentInput);
              return;
            }

            if (!player?.danmaku || typeof player.danmaku.send !== 'function') {
              if (typeof player.notice === 'function') {
                player.notice('弹幕暂时不可用');
              }
              requestAnimationFrame(focusCommentInput);
              return;
            }

            player.danmaku.send({
              text,
              color: getSelectedDanmakuColor(),
              type: getSelectedDanmakuType()
            }, () => {
              if (commentInput) {
                commentInput.value = '';
              }
              requestAnimationFrame(() => {
                if (canceled) return;
                if (typeof player.comment?.show === 'function') {
                  player.comment.show();
                  return;
                }
                focusCommentInput();
              });
            });
          };

          const onCommentSendClick = (event) => {
            if (Date.now() - lastCommentSendAt < 500) {
              stopHandledEvent(event);
              return;
            }
            sendComment(event);
          };

          const onCommentInputKeyDown = (event) => {
            if (event.key === 'Enter' || event.keyCode === 13) {
              sendComment(event);
            }
          };

          const scheduleAutoHide = () => {
            clearAutoHide();
            if (!player?.controller || !player?.video || player.video.paused || isCommentInputActive()) return;
            hideTimer = setTimeout(() => {
              if (canceled || !player?.controller || !player?.video || player.video.paused || isCommentInputActive()) return;
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
          const onControllerTouchEnd = (event) => {
            if (isCommentControlTarget(event.target) || isCommentInputActive()) {
              clearAutoHide();
              return;
            }
            scheduleAutoHide();
          };
          const onCommentInputFocus = () => {
            clearAutoHide();
            container.classList.add('dplayer-comment-input-active');
            if (typeof player.controller.show === 'function') {
              player.controller.show();
            }
          };
          const onCommentInputBlur = () => {
            container.classList.remove('dplayer-comment-input-active');
            scheduleAutoHide();
          };
          const blockWebFullscreen = (event) => {
            stopHandledEvent(event);
            if (player?.fullScreen?.isFullScreen?.('web')) {
              player.fullScreen.cancel('web');
            }
          };

          const toggleGuard = (event) => {
            if (!player?.controller) return;
            if (isCommentControlTarget(event.target) || isCommentInputActive()) {
              clearAutoHide();
              return;
            }
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
          commentInput?.addEventListener('focus', onCommentInputFocus);
          commentInput?.addEventListener('blur', onCommentInputBlur);
          commentInput?.addEventListener('keydown', onCommentInputKeyDown, true);
          commentSendButton?.addEventListener('pointerdown', sendComment, true);
          commentSendButton?.addEventListener('touchstart', sendComment, { capture: true, passive: false });
          commentSendButton?.addEventListener('click', onCommentSendClick, true);
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
            container.classList.remove('dplayer-comment-input-active');
            videoWrap?.removeEventListener('click', toggleGuard, true);
            controllerMask?.removeEventListener('click', toggleGuard, true);
            controllerRoot?.removeEventListener('touchstart', onControllerTouchStart);
            controllerRoot?.removeEventListener('touchend', onControllerTouchEnd);
            commentInput?.removeEventListener('focus', onCommentInputFocus);
            commentInput?.removeEventListener('blur', onCommentInputBlur);
            commentInput?.removeEventListener('keydown', onCommentInputKeyDown, true);
            commentSendButton?.removeEventListener('pointerdown', sendComment, true);
            commentSendButton?.removeEventListener('touchstart', sendComment, true);
            commentSendButton?.removeEventListener('click', onCommentSendClick, true);
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
    danmakuOptions,
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
