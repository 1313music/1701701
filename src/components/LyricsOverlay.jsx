import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, ListMusic, Heart, Share2, ChevronDown, MessageCircle, X } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import '../styles/lyrics-overlay.css';
import { formatTime } from '../utils/formatUtils';
import CommentSection from './CommentSection.jsx';

const LyricsOverlay = ({
    isLyricsOpen,
    setIsLyricsOpen,
    currentTrack,
    currentAlbum,
    currentSongInfo,
    isPlaying,
    handlePlayPause,
    progress,
    currentTime,
    duration,
    lyrics,
    currentLyricIndex,
    handleSeek,
    togglePlayMode,
    getPlayModeIcon,
    handlePrev,
    handleNext,
    audioRef,
    setIsAlbumListOpen,
    commentServerURL,
    onAddToFavorites,
    onShare,
    isCurrentTrackFavorited,
    onToggleFavorite,
    lyricsOverlaySessionId,
    playerOverlayContextId,
    trackChangeId,
    openCommentRequestId,
    openCommentRequestTrackSrc,
    openCommentRequestMode,
    openCommentRequestOverlaySessionId,
    openCommentRequestTrackChangeId,
    openCommentRequestViewContextId
}) => {
    const isDraggingRef = useRef(false);
    const lastTouchRef = useRef(0);
    const [isDragActive, setIsDragActive] = useState(false);
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
    const commentDrawerSwipeRef = useRef({
        active: false,
        startX: 0,
        startY: 0,
        startAt: 0
    });
    const burstIdRef = useRef(0);
    const burstTimerRef = useRef([]);
    const [mobileLikeBursts, setMobileLikeBursts] = useState([]);
    const [desktopLikeBursts, setDesktopLikeBursts] = useState([]);
    const [manualCommentDrawerContextKey, setManualCommentDrawerContextKey] = useState('');
    const [dismissedCommentRequestId, setDismissedCommentRequestId] = useState(0);

    const spawnCoverLikeBurst = (event, setter) => {
        if (!event?.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = Number.isFinite(event.clientX) ? event.clientX - rect.left : rect.width / 2;
        const y = Number.isFinite(event.clientY) ? event.clientY - rect.top : rect.height / 2;
        const id = ++burstIdRef.current;
        setter((prev) => [...prev, { id, x, y }]);
        const timerId = window.setTimeout(() => {
            setter((prev) => prev.filter((item) => item.id !== id));
            burstTimerRef.current = burstTimerRef.current.filter((item) => item !== timerId);
        }, 780);
        burstTimerRef.current.push(timerId);
    };

    const handleCoverDoubleClick = (event, mode) => {
        onAddToFavorites?.(currentTrack, { placement: 'bottom' });
        if (mode === 'mobile') {
            spawnCoverLikeBurst(event, setMobileLikeBursts);
            return;
        }
        spawnCoverLikeBurst(event, setDesktopLikeBursts);
    };

    const isMobileViewport = () => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth <= 1024;
    };

    const resetMobileSwipeState = () => {
        mobileSwipeRef.current.active = false;
        mobileSwipeRef.current.ignore = false;
        mobileSwipeRef.current.startX = 0;
        mobileSwipeRef.current.startY = 0;
        mobileSwipeRef.current.startAt = 0;
    };

    const resetCommentDrawerSwipeState = () => {
        commentDrawerSwipeRef.current.active = false;
        commentDrawerSwipeRef.current.startX = 0;
        commentDrawerSwipeRef.current.startY = 0;
        commentDrawerSwipeRef.current.startAt = 0;
    };

    const handleOverlayTouchStart = (e) => {
        if (!isMobileViewport()) return;
        const touch = e.touches?.[0];
        if (!touch) return;
        const target = e.target;
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
    };

    const handleOverlayTouchEnd = (e) => {
        const state = mobileSwipeRef.current;
        if (!state.active) return;
        const touch = e.changedTouches?.[0];
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
    };

    const seekByClientX = (clientX, target) => {
        if (!target || !audioRef.current) return;
        const rect = target.getBoundingClientRect();
        const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
        audioRef.current.currentTime = ratio * duration;
    };

    const startDrag = (clientX, target, moveEvent, upEvent, getClientX, options) => {
        if (isDraggingRef.current) return;
        isDraggingRef.current = true;
        seekByClientX(clientX, target);
        setIsDragActive(true);

        const onMove = (moveEventObj) => {
            if (!isDraggingRef.current) return;
            if (moveEventObj.cancelable) moveEventObj.preventDefault();
            const nextX = getClientX(moveEventObj);
            if (typeof nextX === 'number') seekByClientX(nextX, target);
        };
        const onUp = (upEventObj) => {
            const endX = getClientX(upEventObj);
            if (typeof endX === 'number') seekByClientX(endX, target);
            isDraggingRef.current = false;
            setIsDragActive(false);
            window.removeEventListener(moveEvent, onMove, options);
            window.removeEventListener(upEvent, onUp, options);
        };

        window.addEventListener(moveEvent, onMove, options);
        window.addEventListener(upEvent, onUp, options);
    };

    const handlePointerDown = (e) => {
        if (isDraggingRef.current) return;
        e.preventDefault();
        startDrag(
            e.clientX,
            e.currentTarget,
            'pointermove',
            'pointerup',
            (ev) => ev.clientX
        );
    };

    const handleMouseDown = (e) => {
        if (Date.now() - lastTouchRef.current < 500) return;
        if (isDraggingRef.current) return;
        e.preventDefault();
        startDrag(
            e.clientX,
            e.currentTarget,
            'mousemove',
            'mouseup',
            (ev) => ev.clientX
        );
    };

    const handleTouchStart = (e) => {
        if (isDraggingRef.current) return;
        const touch = e.touches[0];
        if (!touch) return;
        lastTouchRef.current = Date.now();
        const options = { passive: false };
        startDrag(
            touch.clientX,
            e.currentTarget,
            'touchmove',
            'touchend',
            (ev) => {
                const t = ev.touches && ev.touches[0] ? ev.touches[0] : ev.changedTouches && ev.changedTouches[0];
                return t ? t.clientX : undefined;
            },
            options
        );
    };

    const markLyricsManualScroll = () => {
        lyricsManualScrollUntilRef.current = Date.now() + 2600;
    };

    const getActiveLyricsNodes = useCallback(() => {
        const useMobile = typeof window !== 'undefined' && window.innerWidth <= 1024;
        return {
            scroller: useMobile ? mobileLyricsScrollerRef.current : desktopLyricsScrollerRef.current,
            wrap: useMobile ? mobileLyricsWrapRef.current : desktopLyricsWrapRef.current
        };
    }, []);

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
    }, [isLyricsOpen, lyrics.length, currentTrack?.src, scrollActiveLyricIntoView]);

    useEffect(() => {
        if (!isLyricsOpen) return;
        const handleResize = () => scrollActiveLyricIntoView('auto');
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isLyricsOpen, currentLyricIndex, lyrics.length, currentTrack?.src, scrollActiveLyricIntoView]);

    useLayoutEffect(() => {
        if (!isLyricsOpen) return;
        scrollActiveLyricIntoView('smooth');
    }, [isLyricsOpen, currentLyricIndex, lyrics.length, scrollActiveLyricIntoView]);

    useLayoutEffect(() => {
        if (!isLyricsOpen) return;
        const node = mobileTitleRef.current;
        if (!node) return;
        const update = () => {
            const isOverflow = node.scrollWidth > node.clientWidth + 2;
            setIsMobileTitleMarquee(isOverflow);
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(node);
        return () => ro.disconnect();
    }, [isLyricsOpen, currentTrack.name]);

    useEffect(() => {
        return () => {
            burstTimerRef.current.forEach((timerId) => window.clearTimeout(timerId));
            burstTimerRef.current = [];
        };
    }, []);

    const isMobileOverlay = isMobileViewport();
    const currentTrackSrc = currentTrack?.src || '';
    const latestCommentRequestId = Number.isFinite(openCommentRequestId) ? openCommentRequestId : 0;
    const commentAlbumId = currentSongInfo?.album?.id || currentAlbum?.id || 'library';
    const currentSongCommentPath = currentTrackSrc
        ? `song:${commentAlbumId}:${encodeURIComponent(currentTrackSrc)}`
        : '';
    const canOpenCommentDrawer = Boolean(commentServerURL && currentSongCommentPath);
    const favoriteAriaLabel = isCurrentTrackFavorited ? '取消收藏当前歌曲' : '收藏当前歌曲';
    const canToggleFavorite = Boolean(currentTrackSrc);
    const currentCommentDrawerContextKey = currentTrackSrc
        ? `${playerOverlayContextId}:${lyricsOverlaySessionId}:${trackChangeId}:${currentTrackSrc}`
        : '';
    const hasMatchingCommentRequest = (
        canOpenCommentDrawer
        && latestCommentRequestId > dismissedCommentRequestId
        && openCommentRequestTrackSrc === currentTrackSrc
    );
    const hasManualCommentDrawerOpen = (
        manualCommentDrawerContextKey !== ''
        && manualCommentDrawerContextKey === currentCommentDrawerContextKey
        && (isLyricsOpen || !isMobileOverlay)
    );
    const hasOverlayCommentDrawerOpen = (
        hasMatchingCommentRequest
        && openCommentRequestMode !== 'standalone'
        && isLyricsOpen
        && (
            isMobileOverlay
            || (
                openCommentRequestTrackChangeId === trackChangeId
                && openCommentRequestViewContextId === playerOverlayContextId
                && openCommentRequestOverlaySessionId === lyricsOverlaySessionId
            )
        )
    );
    const hasStandaloneCommentDrawerOpen = (
        hasMatchingCommentRequest
        && openCommentRequestMode === 'standalone'
        && !isMobileOverlay
    );
    const hasExternalCommentDrawerOpen = hasOverlayCommentDrawerOpen || hasStandaloneCommentDrawerOpen;
    const isCommentDrawerOpen = hasManualCommentDrawerOpen || hasExternalCommentDrawerOpen;

    const handleToggleFavorite = (event) => {
        event?.stopPropagation?.();
        if (!canToggleFavorite) return;
        onToggleFavorite?.(currentTrack, event);
    };

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

    const shouldRenderCommentDrawer = (
        isCommentDrawerOpen
        && canOpenCommentDrawer
        && (isLyricsOpen || !isMobileOverlay)
    );
    const shouldLockViewport = isLyricsOpen || (!isMobileOverlay && shouldRenderCommentDrawer);

    const handleCommentDrawerTouchStart = useCallback((event) => {
        if (!isMobileViewport()) return;
        const touch = event.touches?.[0];
        if (!touch) return;
        commentDrawerSwipeRef.current.active = true;
        commentDrawerSwipeRef.current.startX = touch.clientX;
        commentDrawerSwipeRef.current.startY = touch.clientY;
        commentDrawerSwipeRef.current.startAt = Date.now();
    }, []);

    const handleCommentDrawerTouchEnd = useCallback((event) => {
        const state = commentDrawerSwipeRef.current;
        if (!state.active) return;
        const touch = event.changedTouches?.[0];
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
        const shouldCloseByRight = deltaX > 88 || (deltaX > 42 && velocityX > 0.58);

        if (isHorizontalSwipe && shouldCloseByRight) {
            closeCommentDrawer();
        }
    }, [closeCommentDrawer]);

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

    const overlayInitial = isMobileOverlay
        ? { y: '100%' }
        : { opacity: 0, y: '100%' };
    const overlayAnimate = isMobileOverlay
        ? { y: 0 }
        : { opacity: 1, y: 0 };
    const overlayExit = isMobileOverlay
        ? {
            y: '100%',
            pointerEvents: 'none',
            transition: { type: 'tween', duration: 0.24, ease: [0.4, 0, 1, 1] }
        }
        : { opacity: 0, y: '100%' };
    const overlayTransition = isMobileOverlay
        ? { type: 'tween', duration: 0.3, ease: [0.22, 1, 0.36, 1] }
        : { type: 'tween', duration: 0.35, ease: [0.22, 1, 0.36, 1] };
    const commentDrawerInitial = { x: '100%' };
    const commentDrawerAnimate = { x: 0 };
    const commentDrawerExit = { x: '100%' };
    const commentDrawerTransition = { type: 'tween', duration: 0.24, ease: [0.22, 1, 0.36, 1] };
    // 使用 Portal 渲染到 body，确保不受父级样式限制（如 overflow, transform 等），实现真正的全屏
    return createPortal(
        <>
            <AnimatePresence>
                {isLyricsOpen && (
                    <Motion.div
                        className={`lyrics-overlay mobile-fullscreen-player ${isCommentDrawerOpen ? 'comment-drawer-open' : ''}`}
                        initial={overlayInitial}
                        animate={overlayAnimate}
                        exit={overlayExit}
                        transition={overlayTransition}
                        onTouchStart={handleOverlayTouchStart}
                        onTouchEnd={handleOverlayTouchEnd}
                        onTouchCancel={resetMobileSwipeState}
                        style={{
                            '--cover-image': `url(${currentTrack.cover || currentAlbum.cover})`
                        }}
                    >
                        <div className="noise-overlay"></div>

                        <div className="overlay-header">
                            <button
                                className="close-btn"
                                onClick={() => setIsLyricsOpen(false)}
                                aria-label="收起"
                            >
                                <ChevronDown size={24} strokeWidth={2.2} absoluteStrokeWidth aria-hidden="true" />
                            </button>
                            <div className="overlay-header-actions">
                                <button
                                    type="button"
                                    className="overlay-share-btn"
                                    onClick={(e) => onShare?.(e)}
                                    aria-label="分享当前歌曲"
                                >
                                    <Share2 size={20} strokeWidth={2.2} absoluteStrokeWidth />
                                </button>
                            </div>
                        </div>

                        <div className="mobile-player-content">
                            <div className="mobile-cover-section">
                                <Motion.div
                                    className="mobile-xl-cover"
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.4 }}
                                    onDoubleClick={(e) => handleCoverDoubleClick(e, 'mobile')}
                                    title="双击添加收藏"
                                >
                                    <img loading="lazy" src={currentTrack.cover || currentAlbum.cover} alt="cover" />
                                    <div className="cover-like-burst-layer" aria-hidden="true">
                                        {mobileLikeBursts.map((burst) => (
                                            <span
                                                key={burst.id}
                                                className="cover-like-heart"
                                                style={{ left: `${burst.x}px`, top: `${burst.y}px` }}
                                            >
                                                <Heart size={38} strokeWidth={1.8} fill="currentColor" />
                                            </span>
                                        ))}
                                    </div>
                                </Motion.div>
                            </div>

                            <div className="mobile-track-info">
                                <h1
                                    className={`mobile-track-name ${isMobileTitleMarquee ? 'is-marquee' : ''}`}
                                    ref={mobileTitleRef}
                                >
                                    <span data-text={currentTrack.name}>{currentTrack.name}</span>
                                </h1>
                            </div>

                            <div className="mobile-lyrics-section">
                                {lyrics.length > 0 ? (
                                    <div
                                        className="mobile-lyrics-scroller"
                                        ref={mobileLyricsScrollerRef}
                                        onWheel={markLyricsManualScroll}
                                        onPointerDown={markLyricsManualScroll}
                                        onTouchStart={markLyricsManualScroll}
                                    >
                                        <div className="mobile-lyrics-wrap" ref={mobileLyricsWrapRef}>
                                            {lyrics.map((l, i) => {
                                            return (
                                                <div
                                                    key={i}
                                                    className={`mobile-lyric-line lyric-line ${i === currentLyricIndex ? 'active' : ''}`}
                                                    onClick={(e) => { e.stopPropagation(); audioRef.current.currentTime = l.time; }}
                                                >
                                                    {l.text}
                                                </div>
                                            );
                                        })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mobile-no-lyrics">暂无歌词</div>
                                )}
                            </div>

                            <div className="mobile-player-controls">
                                <div className="mobile-progress-row">
                                    <div className="mobile-progress-section">
                                        <div
                                            className={`mobile-progress-bar ${isDragActive ? 'is-dragging' : ''}`}
                                            onClick={handleSeek}
                                            onPointerDown={handlePointerDown}
                                            onMouseDown={handleMouseDown}
                                            onTouchStart={handleTouchStart}
                                        >
                                            <div className="mobile-progress-fill" style={{ width: `${progress}%` }} />
                                            <div className={`mobile-progress-thumb ${isDragActive ? 'is-visible' : ''}`} style={{ left: `${progress}%` }} />
                                        </div>
                                        <div className="mobile-time-display">
                                            <span>{formatTime(currentTime)}</span>
                                            <span>{formatTime(duration)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mobile-control-buttons">
                                    <button className="mobile-mode-btn" onClick={togglePlayMode}>
                                        {getPlayModeIcon(24)}
                                    </button>
                                    <button className="mobile-control-btn" onClick={handlePrev}>
                                        <Play size={24} fill="currentColor" style={{ transform: 'rotate(180deg)', marginRight: '-8px' }} />
                                        <Play size={24} fill="currentColor" style={{ transform: 'rotate(180deg)' }} />
                                    </button>
                                    <button className="mobile-play-btn" onClick={handlePlayPause}>
                                        {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" style={{ marginLeft: '4px' }} />}
                                    </button>
                                    <button className="mobile-control-btn" onClick={handleNext}>
                                        <Play size={24} fill="currentColor" style={{ marginRight: '-8px' }} />
                                        <Play size={24} fill="currentColor" />
                                    </button>
                                    <button className="mobile-playlist-btn" onClick={() => setIsAlbumListOpen(true)}>
                                        <ListMusic size={24} strokeWidth={2.4} absoluteStrokeWidth />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {isMobileOverlay && (
                            <>
                                <button
                                    type="button"
                                    className={`overlay-favorite-trigger mobile-fab ${isCurrentTrackFavorited ? 'active' : ''}`}
                                    onClick={handleToggleFavorite}
                                    aria-label={favoriteAriaLabel}
                                    title={favoriteAriaLabel}
                                    disabled={!canToggleFavorite}
                                >
                                    <Heart size={22} strokeWidth={2.2} absoluteStrokeWidth fill={isCurrentTrackFavorited ? 'currentColor' : 'none'} />
                                </button>
                                <button
                                    type="button"
                                    className={`overlay-comment-trigger mobile-fab ${isCommentDrawerOpen ? 'active' : ''}`}
                                    onClick={toggleCommentDrawer}
                                    aria-label="歌曲评论"
                                    disabled={!canOpenCommentDrawer}
                                >
                                    <MessageCircle size={22} strokeWidth={2.2} absoluteStrokeWidth />
                                </button>
                            </>
                        )}

                        {/* 桌面端内容 */}
                        <div className="desktop-player-content">
                            <div className="album-view">
                                <div
                                    className="xl-cover"
                                    onDoubleClick={(e) => handleCoverDoubleClick(e, 'desktop')}
                                    title="双击添加收藏"
                                >
                                    <img loading="lazy" src={currentTrack.cover || currentAlbum.cover} alt="cover" />
                                    <div className="cover-like-burst-layer" aria-hidden="true">
                                        {desktopLikeBursts.map((burst) => (
                                            <span
                                                key={burst.id}
                                                className="cover-like-heart"
                                                style={{ left: `${burst.x}px`, top: `${burst.y}px` }}
                                            >
                                                <Heart size={42} strokeWidth={1.8} fill="currentColor" />
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="track-meta" style={{ textAlign: 'center', marginTop: 20 }}>
                                    <h2>{currentTrack.name}</h2>
                                    <p>{currentAlbum.artist} - {currentAlbum.name}</p>
                                </div>

                                <div className="overlay-controls">
                                    <div className="overlay-comment-row">
                                        <button
                                            type="button"
                                            className={`overlay-favorite-trigger desktop-floating ${isCurrentTrackFavorited ? 'active' : ''}`}
                                            onClick={handleToggleFavorite}
                                            aria-label={favoriteAriaLabel}
                                            title={favoriteAriaLabel}
                                            disabled={!canToggleFavorite}
                                        >
                                            <Heart size={24} strokeWidth={2.2} absoluteStrokeWidth fill={isCurrentTrackFavorited ? 'currentColor' : 'none'} />
                                        </button>
                                        <button
                                            type="button"
                                            className={`overlay-comment-trigger desktop-floating ${isCommentDrawerOpen ? 'active' : ''}`}
                                            onClick={toggleCommentDrawer}
                                            aria-label="歌曲评论"
                                            disabled={!canOpenCommentDrawer}
                                        >
                                            <MessageCircle size={24} strokeWidth={2.2} absoluteStrokeWidth />
                                        </button>
                                    </div>
                                    <div className="overlay-progress-row">
                                        <div
                                            className={`overlay-progress-container ${isDragActive ? 'is-dragging' : ''}`}
                                            onClick={handleSeek}
                                            onPointerDown={handlePointerDown}
                                            onMouseDown={handleMouseDown}
                                            onTouchStart={handleTouchStart}
                                        >
                                            <div className="overlay-progress-fill" style={{ width: `${progress}%` }} />
                                            <div className={`overlay-progress-thumb ${isDragActive ? 'is-visible' : ''}`} style={{ left: `${progress}%` }} />
                                            <div className="overlay-time-info">
                                                <span>{formatTime(currentTime)}</span>
                                                <span>{formatTime(duration)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="overlay-buttons">
                                        <div className="icon-btn" onClick={togglePlayMode}>
                                            {getPlayModeIcon(24)}
                                        </div>
                                        <div className="icon-btn" onClick={handlePrev}>
                                            <Play size={24} fill="currentColor" style={{ transform: 'rotate(180deg)', marginRight: '-8px' }} />
                                            <Play size={24} fill="currentColor" style={{ transform: 'rotate(180deg)' }} />
                                        </div>
                                        <div className="overlay-play-btn" onClick={handlePlayPause}>
                                            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" style={{ marginLeft: '6px' }} />}
                                        </div>
                                        <div className="icon-btn" onClick={handleNext}>
                                            <Play size={24} fill="currentColor" style={{ marginRight: '-8px' }} />
                                            <Play size={24} fill="currentColor" />
                                        </div>
                                        <div className="icon-btn" onClick={() => setIsAlbumListOpen(true)}>
                                            <ListMusic size={24} strokeWidth={2.4} absoluteStrokeWidth />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="lyrics-view desktop-lyrics">
                                <div
                                    className={`lyrics-scroller ${lyrics.length > 0 ? '' : 'is-empty'}`}
                                    ref={desktopLyricsScrollerRef}
                                    onWheel={markLyricsManualScroll}
                                    onPointerDown={markLyricsManualScroll}
                                    onTouchStart={markLyricsManualScroll}
                                >
                                    {lyrics.length > 0 ? (
                                        <div ref={desktopLyricsWrapRef}>
                                            {lyrics.map((l, i) => (
                                                <div
                                                    key={i}
                                                    className={`lyric-line ${i === currentLyricIndex ? 'active' : ''}`}
                                                    onClick={() => { audioRef.current.currentTime = l.time; }}
                                                >
                                                    {l.text}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="no-lyrics">暂无歌词</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {shouldRenderCommentDrawer ? (
                    <>
                        {!isMobileOverlay && (
                            <Motion.button
                                key="song-comment-backdrop"
                                type="button"
                                className="song-comment-backdrop"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                onClick={closeCommentDrawer}
                                aria-label="关闭评论抽屉"
                            />
                        )}
                        <Motion.aside
                            key={`song-comment-drawer-${currentSongCommentPath || 'empty'}`}
                            className="song-comment-drawer"
                            initial={commentDrawerInitial}
                            animate={commentDrawerAnimate}
                            exit={commentDrawerExit}
                            transition={commentDrawerTransition}
                            onClick={(event) => event.stopPropagation()}
                            onTouchStart={handleCommentDrawerTouchStart}
                            onTouchEnd={handleCommentDrawerTouchEnd}
                            onTouchCancel={resetCommentDrawerSwipeState}
                        >
                            <div className="song-comment-drawer-header">
                                <div className="song-comment-drawer-texts">
                                    <h3>单曲评论</h3>
                                    <p>{currentTrack.name}</p>
                                </div>
                                <button
                                    type="button"
                                    className="song-comment-close"
                                    onClick={closeCommentDrawer}
                                    aria-label="关闭评论抽屉"
                                >
                                    <X size={18} strokeWidth={2.2} absoluteStrokeWidth />
                                </button>
                            </div>
                            <div className="song-comment-drawer-body">
                                <CommentSection
                                    serverURL={commentServerURL}
                                    path={currentSongCommentPath}
                                    title=""
                                    subtitle=""
                                />
                            </div>
                        </Motion.aside>
                    </>
                ) : null}
            </AnimatePresence>
        </>,
        document.body
    );
};

export default LyricsOverlay;
