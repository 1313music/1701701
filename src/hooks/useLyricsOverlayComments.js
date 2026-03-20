import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildSongCommentPaths } from '../utils/commentPathUtils.js';

const COMMENT_DRAWER_EDGE_SWIPE_MAX_START_X = 64;

export const useLyricsOverlayComments = ({
  commentServerURL,
  currentAlbum,
  currentSongInfo,
  currentTrackSrc,
  isLyricsOpen,
  isMobileViewport,
  lyricsOverlaySessionId,
  openCommentRequestId,
  openCommentRequestMode,
  openCommentRequestOverlaySessionId,
  openCommentRequestTrackChangeId,
  openCommentRequestTrackSrc,
  openCommentRequestViewContextId,
  playerOverlayContextId,
  trackChangeId
}) => {
  const commentDrawerSwipeRef = useRef({
    active: false,
    fromLeftEdge: false,
    startX: 0,
    startY: 0,
    startAt: 0
  });
  const [manualCommentDrawerContextKey, setManualCommentDrawerContextKey] = useState('');
  const [dismissedCommentRequestId, setDismissedCommentRequestId] = useState(0);

  const latestCommentRequestId = Number.isFinite(openCommentRequestId) ? openCommentRequestId : 0;
  const commentAlbumId = currentSongInfo?.album?.id || currentAlbum?.id || 'library';
  const { primaryPath: currentSongCommentPath } = useMemo(() => (
    buildSongCommentPaths({
      albumId: commentAlbumId,
      songId: currentSongInfo?.song?.id,
      trackSrc: currentTrackSrc
    })
  ), [commentAlbumId, currentSongInfo?.song?.id, currentTrackSrc]);
  const canOpenCommentDrawer = Boolean(commentServerURL && currentSongCommentPath);
  const currentCommentDrawerContextKey = currentTrackSrc
    ? `${playerOverlayContextId}:${lyricsOverlaySessionId}:${trackChangeId}:${currentTrackSrc}`
    : '';
  const isMobileOverlay = isMobileViewport();
  const hasMatchingCommentRequest = (
    canOpenCommentDrawer &&
    latestCommentRequestId > dismissedCommentRequestId &&
    openCommentRequestTrackSrc === currentTrackSrc &&
    openCommentRequestTrackChangeId === trackChangeId &&
    openCommentRequestViewContextId === playerOverlayContextId
  );
  const hasManualCommentDrawerOpen = (
    manualCommentDrawerContextKey !== '' &&
    manualCommentDrawerContextKey === currentCommentDrawerContextKey &&
    (isLyricsOpen || !isMobileOverlay)
  );
  const hasOverlayCommentDrawerOpen = (
    hasMatchingCommentRequest &&
    openCommentRequestMode !== 'standalone' &&
    isLyricsOpen &&
    (
      isMobileOverlay ||
      openCommentRequestOverlaySessionId === lyricsOverlaySessionId
    )
  );
  const hasStandaloneCommentDrawerOpen = (
    hasMatchingCommentRequest &&
    openCommentRequestMode === 'standalone' &&
    !isMobileOverlay
  );
  const hasExternalCommentDrawerOpen = hasOverlayCommentDrawerOpen || hasStandaloneCommentDrawerOpen;
  const isCommentDrawerOpen = hasManualCommentDrawerOpen || hasExternalCommentDrawerOpen;
  const shouldRenderCommentDrawer = (
    isCommentDrawerOpen &&
    canOpenCommentDrawer &&
    (isLyricsOpen || !isMobileOverlay)
  );
  const shouldLockViewport = isLyricsOpen || (!isMobileOverlay && shouldRenderCommentDrawer);

  const resetCommentDrawerSwipeState = useCallback(() => {
    commentDrawerSwipeRef.current.active = false;
    commentDrawerSwipeRef.current.fromLeftEdge = false;
    commentDrawerSwipeRef.current.startX = 0;
    commentDrawerSwipeRef.current.startY = 0;
    commentDrawerSwipeRef.current.startAt = 0;
  }, []);

  const dismissActiveCommentRequest = useCallback(() => {
    setDismissedCommentRequestId((previous) => Math.max(previous, latestCommentRequestId));
  }, [latestCommentRequestId]);

  const openCommentDrawer = useCallback(() => {
    if (!canOpenCommentDrawer || !currentCommentDrawerContextKey) return;
    dismissActiveCommentRequest();
    setManualCommentDrawerContextKey(currentCommentDrawerContextKey);
  }, [canOpenCommentDrawer, currentCommentDrawerContextKey, dismissActiveCommentRequest]);

  const closeCommentDrawer = useCallback(() => {
    dismissActiveCommentRequest();
    setManualCommentDrawerContextKey('');
  }, [dismissActiveCommentRequest]);

  const toggleCommentDrawer = useCallback(() => {
    if (!canOpenCommentDrawer) return;
    if (isCommentDrawerOpen) {
      closeCommentDrawer();
      return;
    }
    openCommentDrawer();
  }, [canOpenCommentDrawer, closeCommentDrawer, isCommentDrawerOpen, openCommentDrawer]);

  const handleCommentDrawerTouchStart = useCallback((event) => {
    if (!isMobileViewport()) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    commentDrawerSwipeRef.current.active = true;
    commentDrawerSwipeRef.current.fromLeftEdge = touch.clientX <= COMMENT_DRAWER_EDGE_SWIPE_MAX_START_X;
    commentDrawerSwipeRef.current.startX = touch.clientX;
    commentDrawerSwipeRef.current.startY = touch.clientY;
    commentDrawerSwipeRef.current.startAt = Date.now();
  }, [isMobileViewport]);

  const handleCommentDrawerTouchEnd = useCallback((event) => {
    const state = commentDrawerSwipeRef.current;
    if (!state.active) return;
    const touch = event.changedTouches?.[0];
    const fromLeftEdge = state.fromLeftEdge;
    const startX = state.startX;
    const startY = state.startY;
    const startAt = state.startAt;
    resetCommentDrawerSwipeState();
    if (!touch || !isMobileViewport()) return;

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const elapsed = Math.max(Date.now() - startAt, 1);
    const velocityX = deltaX / elapsed;
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
    const shouldCloseByRight = fromLeftEdge && (deltaX > 88 || (deltaX > 42 && velocityX > 0.58));

    if (isHorizontalSwipe && shouldCloseByRight) {
      closeCommentDrawer();
    }
  }, [closeCommentDrawer, isMobileViewport, resetCommentDrawerSwipeState]);

  useEffect(() => {
    if (!shouldLockViewport || typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const { documentElement, body } = document;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const previousStyles = {
      htmlOverflow: documentElement.style.overflow,
      htmlOverscrollBehavior: documentElement.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width
    };

    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    return () => {
      documentElement.style.overflow = previousStyles.htmlOverflow;
      documentElement.style.overscrollBehavior = previousStyles.htmlOverscrollBehavior;
      body.style.overflow = previousStyles.bodyOverflow;
      body.style.overscrollBehavior = previousStyles.bodyOverscrollBehavior;
      body.style.position = previousStyles.bodyPosition;
      body.style.top = previousStyles.bodyTop;
      body.style.left = previousStyles.bodyLeft;
      body.style.right = previousStyles.bodyRight;
      body.style.width = previousStyles.bodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [shouldLockViewport]);

  return {
    currentSongCommentPath,
    canOpenCommentDrawer,
    isCommentDrawerOpen,
    shouldRenderCommentDrawer,
    toggleCommentDrawer,
    closeCommentDrawer,
    handleCommentDrawerTouchStart,
    handleCommentDrawerTouchEnd,
    resetCommentDrawerSwipeState,
    isMobileOverlay
  };
};
