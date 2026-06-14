import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { shouldUseCompactMobileFullscreenLayout } from '../utils/mobileFullscreenLayout.js';

const MOBILE_CLOSE_EDGE_SWIPE_MAX_START_X = 64;

export const getDesktopLyricEdgeOpacity = ({ lineTop, lineBottom, scrollerTop, scrollerHeight, isActive = false }) => {
  if (
    !Number.isFinite(lineTop) ||
    !Number.isFinite(lineBottom) ||
    !Number.isFinite(scrollerTop) ||
    !Number.isFinite(scrollerHeight) ||
    scrollerHeight <= 0
  ) {
    return isActive ? 1 : 0.3;
  }

  const scrollerBottom = scrollerTop + scrollerHeight;
  const edgeGap = Math.min(lineTop - scrollerTop, scrollerBottom - lineBottom);
  const fadeDistance = Math.max(Math.min(scrollerHeight * 0.26, 180), 96);
  const normalizedGap = Math.min(Math.max(edgeGap / fadeDistance, 0), 1);
  const easedVisibility = normalizedGap * normalizedGap * (3 - 2 * normalizedGap);
  const minOpacity = isActive ? 0.86 : 0.04;
  const maxOpacity = isActive ? 1 : 0.66;

  return Number((minOpacity + (maxOpacity - minOpacity) * easedVisibility).toFixed(3));
};

export const useLyricsOverlayViewport = ({
  currentLyricIndex,
  currentTrackName,
  currentTrackSrc,
  isLyricsOpen,
  lyrics,
  setIsLyricsOpen
}) => {
  const mobileTitleRef = useRef(null);
  const [isMobileTitleMarquee, setIsMobileTitleMarquee] = useState(false);
  const [isCompactMobileViewport, setIsCompactMobileViewport] = useState(false);
  const desktopLyricsWrapRef = useRef(null);
  const desktopLyricsScrollerRef = useRef(null);
  const mobileLyricsWrapRef = useRef(null);
  const mobileLyricsScrollerRef = useRef(null);
  const lyricsManualScrollUntilRef = useRef(0);
  const desktopEdgeFadeRafRef = useRef(0);
  const mobileSwipeRef = useRef({
    active: false,
    ignore: false,
    fromLeftEdge: false,
    startX: 0,
    startY: 0,
    startAt: 0
  });

  const shouldReduceDesktopScrollEffects = useCallback(() => (
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('mac-desktop-webview-like')
  ), []);

  const isMobileViewport = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 1024;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateCompactViewport = () => {
      const viewportWidth = Math.round(window.visualViewport?.width ?? window.innerWidth ?? 0);
      const viewportHeight = Math.round(window.visualViewport?.height ?? window.innerHeight ?? 0);
      const compact = isMobileViewport() && shouldUseCompactMobileFullscreenLayout({
        width: viewportWidth,
        height: viewportHeight
      });
      setIsCompactMobileViewport(compact);
    };

    updateCompactViewport();
    window.addEventListener('resize', updateCompactViewport);
    window.addEventListener('orientationchange', updateCompactViewport);
    window.addEventListener('pageshow', updateCompactViewport);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateCompactViewport);
      window.visualViewport.addEventListener('scroll', updateCompactViewport);
    }

    return () => {
      window.removeEventListener('resize', updateCompactViewport);
      window.removeEventListener('orientationchange', updateCompactViewport);
      window.removeEventListener('pageshow', updateCompactViewport);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateCompactViewport);
        window.visualViewport.removeEventListener('scroll', updateCompactViewport);
      }
    };
  }, [isMobileViewport]);

  const resetMobileSwipeState = useCallback(() => {
    mobileSwipeRef.current.active = false;
    mobileSwipeRef.current.ignore = false;
    mobileSwipeRef.current.fromLeftEdge = false;
    mobileSwipeRef.current.startX = 0;
    mobileSwipeRef.current.startY = 0;
    mobileSwipeRef.current.startAt = 0;
  }, []);

  const handleOverlayTouchStart = useCallback((event) => {
    if (!isMobileViewport()) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    const target = event.target;
    const startedInControls = Boolean(
      target &&
      typeof target.closest === 'function' &&
      target.closest('.overlay-header, .mobile-player-controls, .mobile-lyrics-scroller, .song-comment-drawer, .overlay-comment-trigger, .overlay-favorite-trigger')
    );
    mobileSwipeRef.current.active = true;
    mobileSwipeRef.current.ignore = startedInControls;
    mobileSwipeRef.current.fromLeftEdge = touch.clientX <= MOBILE_CLOSE_EDGE_SWIPE_MAX_START_X;
    mobileSwipeRef.current.startX = touch.clientX;
    mobileSwipeRef.current.startY = touch.clientY;
    mobileSwipeRef.current.startAt = Date.now();
  }, [isMobileViewport]);

  const handleOverlayTouchEnd = useCallback((event) => {
    const state = mobileSwipeRef.current;
    if (!state.active) return;
    const touch = event.changedTouches?.[0];
    const ignore = state.ignore;
    const fromLeftEdge = state.fromLeftEdge;
    const startX = state.startX;
    const startY = state.startY;
    const startAt = state.startAt;
    resetMobileSwipeState();
    if (!touch || ignore || !isMobileViewport()) return;

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const elapsed = Math.max(Date.now() - startAt, 1);
    const velocityX = deltaX / elapsed;
    const velocityY = deltaY / elapsed;
    const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX) * 1.2;
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY) * 1.3;
    const shouldCloseByDown = deltaY > 90 || (deltaY > 45 && velocityY > 0.6);
    const shouldCloseByLeft = deltaX < -90 || (deltaX < -50 && velocityX < -0.6);
    const shouldCloseByRight = fromLeftEdge && (deltaX > 88 || (deltaX > 42 && velocityX > 0.58));

    if ((isVerticalSwipe && shouldCloseByDown) || (isHorizontalSwipe && (shouldCloseByLeft || shouldCloseByRight))) {
      setIsLyricsOpen(false);
    }
  }, [isMobileViewport, resetMobileSwipeState, setIsLyricsOpen]);

  const markLyricsManualScroll = useCallback(() => {
    lyricsManualScrollUntilRef.current = Date.now() + 2600;
  }, []);

  const getActiveLyricsNodes = useCallback(() => {
    const useMobile = isMobileViewport();
    return {
      scroller: useMobile ? mobileLyricsScrollerRef.current : desktopLyricsScrollerRef.current,
      wrap: useMobile ? mobileLyricsWrapRef.current : desktopLyricsWrapRef.current
    };
  }, [isMobileViewport]);

  const scrollActiveLyricIntoView = useCallback((behavior = 'smooth') => {
    if (!isLyricsOpen) return;
    if (Date.now() < lyricsManualScrollUntilRef.current) return;
    const { scroller, wrap } = getActiveLyricsNodes();
    if (!scroller || !wrap) return;
    const active = wrap.querySelector('.lyric-line.active');
    if (!active) return;
    const target = active.offsetTop + active.offsetHeight / 2 - scroller.clientHeight / 2;
    const maxScroll = Math.max(scroller.scrollHeight - scroller.clientHeight, 0);
    const top = Math.min(Math.max(target, 0), maxScroll);
    scroller.scrollTo({ top, behavior });
  }, [getActiveLyricsNodes, isLyricsOpen]);

  const applyDesktopLyricEdgeFade = useCallback(() => {
    if (!isLyricsOpen || isMobileViewport() || !shouldReduceDesktopScrollEffects()) return;

    const scroller = desktopLyricsScrollerRef.current;
    const wrap = desktopLyricsWrapRef.current;
    if (!scroller || !wrap) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const lineNodes = wrap.querySelectorAll('.lyric-line');

    lineNodes.forEach((node) => {
      const rect = node.getBoundingClientRect();
      const isActive = node.classList.contains('active');
      const opacity = getDesktopLyricEdgeOpacity({
        lineTop: rect.top,
        lineBottom: rect.bottom,
        scrollerTop: scrollerRect.top,
        scrollerHeight: scrollerRect.height,
        isActive
      });
      const blur = isActive
        ? Math.max(0, (1 - opacity) * 0.55)
        : Math.max(0, (0.6 - opacity) * 2.1);
      node.style.setProperty('--desktop-edge-opacity', String(opacity));
      node.style.setProperty('--desktop-edge-blur', `${blur.toFixed(2)}px`);
    });
  }, [isLyricsOpen, isMobileViewport, shouldReduceDesktopScrollEffects]);

  const scheduleDesktopLyricEdgeFade = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (desktopEdgeFadeRafRef.current) {
      window.cancelAnimationFrame(desktopEdgeFadeRafRef.current);
    }
    desktopEdgeFadeRafRef.current = window.requestAnimationFrame(() => {
      desktopEdgeFadeRafRef.current = 0;
      applyDesktopLyricEdgeFade();
    });
  }, [applyDesktopLyricEdgeFade]);

  useEffect(() => {
    if (!isLyricsOpen) {
      lyricsManualScrollUntilRef.current = 0;
      return;
    }
    scrollActiveLyricIntoView('auto');
  }, [currentTrackSrc, isLyricsOpen, lyrics.length, scrollActiveLyricIntoView]);

  useEffect(() => {
    if (!isLyricsOpen) return;
    const handleResize = () => scrollActiveLyricIntoView('auto');
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentLyricIndex, currentTrackSrc, isLyricsOpen, lyrics.length, scrollActiveLyricIntoView]);

  useLayoutEffect(() => {
    if (!isLyricsOpen) return;
    const behavior = isMobileViewport() || !shouldReduceDesktopScrollEffects() ? 'smooth' : 'auto';
    scrollActiveLyricIntoView(behavior);
    scheduleDesktopLyricEdgeFade();
  }, [
    currentLyricIndex,
    isLyricsOpen,
    isMobileViewport,
    lyrics.length,
    scheduleDesktopLyricEdgeFade,
    scrollActiveLyricIntoView,
    shouldReduceDesktopScrollEffects
  ]);

  useEffect(() => {
    if (!isLyricsOpen || isMobileViewport() || !shouldReduceDesktopScrollEffects()) return;

    const scroller = desktopLyricsScrollerRef.current;
    if (!scroller) return;

    const handleScroll = () => scheduleDesktopLyricEdgeFade();
    scheduleDesktopLyricEdgeFade();
    scroller.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      scroller.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (desktopEdgeFadeRafRef.current) {
        window.cancelAnimationFrame(desktopEdgeFadeRafRef.current);
        desktopEdgeFadeRafRef.current = 0;
      }
    };
  }, [
    currentTrackSrc,
    isLyricsOpen,
    isMobileViewport,
    lyrics.length,
    scheduleDesktopLyricEdgeFade,
    shouldReduceDesktopScrollEffects
  ]);

  useLayoutEffect(() => {
    if (!isLyricsOpen) return;
    const node = mobileTitleRef.current;
    if (!node) return;
    const update = () => {
      const isOverflow = node.scrollWidth > node.clientWidth + 2;
      setIsMobileTitleMarquee(isOverflow);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, [currentTrackName, isLyricsOpen]);

  return {
    mobileTitleRef,
    isMobileTitleMarquee,
    isCompactMobileViewport,
    desktopLyricsWrapRef,
    desktopLyricsScrollerRef,
    mobileLyricsWrapRef,
    mobileLyricsScrollerRef,
    markLyricsManualScroll,
    handleOverlayTouchStart,
    handleOverlayTouchEnd,
    resetMobileSwipeState,
    isMobileViewport
  };
};
