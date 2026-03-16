import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

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
  const desktopLyricsWrapRef = useRef(null);
  const desktopLyricsScrollerRef = useRef(null);
  const mobileLyricsWrapRef = useRef(null);
  const mobileLyricsScrollerRef = useRef(null);
  const lyricsManualScrollUntilRef = useRef(0);
  const mobileSwipeRef = useRef({
    active: false,
    ignore: false,
    startX: 0,
    startY: 0,
    startAt: 0
  });

  const isMobileViewport = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 1024;
  }, []);

  const resetMobileSwipeState = useCallback(() => {
    mobileSwipeRef.current.active = false;
    mobileSwipeRef.current.ignore = false;
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
    mobileSwipeRef.current.startX = touch.clientX;
    mobileSwipeRef.current.startY = touch.clientY;
    mobileSwipeRef.current.startAt = Date.now();
  }, [isMobileViewport]);

  const handleOverlayTouchEnd = useCallback((event) => {
    const state = mobileSwipeRef.current;
    if (!state.active) return;
    const touch = event.changedTouches?.[0];
    const ignore = state.ignore;
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

    if ((isVerticalSwipe && shouldCloseByDown) || (isHorizontalSwipe && shouldCloseByLeft)) {
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
    scrollActiveLyricIntoView('smooth');
  }, [currentLyricIndex, isLyricsOpen, lyrics.length, scrollActiveLyricIntoView]);

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
