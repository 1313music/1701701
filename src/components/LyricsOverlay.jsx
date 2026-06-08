import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, ListMusic, Heart, Share2, ChevronDown, MessageCircle, X } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import '../styles/lyrics-overlay.css';
import { formatTime } from '../utils/formatUtils';
import { buildCoverAtmosphereAssets } from '../utils/coverAtmosphere.js';
import CommentSection from './CommentSection.jsx';
import { useLyricsOverlayComments } from '../hooks/useLyricsOverlayComments.js';
import { useLyricsOverlayProgress } from '../hooks/useLyricsOverlayProgress.js';
import { useLyricsOverlayViewport } from '../hooks/useLyricsOverlayViewport.js';
import SleepTimerControl from './SleepTimerControl.jsx';

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
    sleepTimerRemainingMs = 0,
    onStartSleepTimer,
    onCancelSleepTimer,
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
    const burstIdRef = useRef(0);
    const burstTimerRef = useRef([]);
    const [mobileLikeBursts, setMobileLikeBursts] = useState([]);
    const [desktopLikeBursts, setDesktopLikeBursts] = useState([]);
    const [desktopProgressHover, setDesktopProgressHover] = useState(null);
    const [coverAtmosphereAssets, setCoverAtmosphereAssets] = useState(null);

    const {
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
    } = useLyricsOverlayViewport({
        currentLyricIndex,
        currentTrackName: currentTrack.name,
        currentTrackSrc: currentTrack?.src,
        isLyricsOpen,
        lyrics,
        setIsLyricsOpen
    });

    const {
        isDragActive,
        handlePointerDown,
        handleMouseDown,
        handleTouchStart
    } = useLyricsOverlayProgress({
        audioRef,
        duration
    });

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

    useEffect(() => {
        return () => {
            burstTimerRef.current.forEach((timerId) => window.clearTimeout(timerId));
            burstTimerRef.current = [];
        };
    }, []);

    const coverSrc = currentTrack.cover || currentAlbum.cover || '';

    useEffect(() => {
        let cancelled = false;

        if (!coverSrc) {
            return () => {
                cancelled = true;
            };
        }

        buildCoverAtmosphereAssets(coverSrc).then((assets) => {
            if (cancelled) return;
            setCoverAtmosphereAssets(assets);
        });

        return () => {
            cancelled = true;
        };
    }, [coverSrc]);

    const activeCoverAtmosphereAssets = coverSrc ? coverAtmosphereAssets : null;

    const currentTrackSrc = currentTrack?.src || '';
    const favoriteAriaLabel = isCurrentTrackFavorited ? '取消收藏当前歌曲' : '收藏当前歌曲';
    const canToggleFavorite = Boolean(currentTrackSrc);
    const canShowDesktopProgressPreview = Number.isFinite(duration) && duration > 0;
    const getDesktopProgressFromPointer = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (!rect.width) return null;
        return Math.min(Math.max(((event.clientX - rect.left) / rect.width) * 100, 0), 100);
    };
    const handleDesktopProgressMouseMove = (event) => {
        const nextProgress = getDesktopProgressFromPointer(event);
        if (nextProgress == null) return;
        setDesktopProgressHover(nextProgress);
    };
    const handleDesktopProgressMouseLeave = () => {
        setDesktopProgressHover(null);
    };
    const desktopPreviewProgress = desktopProgressHover ?? 0;
    const desktopPreviewTime = canShowDesktopProgressPreview
        ? (duration * desktopPreviewProgress) / 100
        : 0;
    const getLyricDistanceBucket = (index) => {
        if (currentLyricIndex < 0) return 6;
        return Math.min(Math.abs(index - currentLyricIndex), 6);
    };
    const {
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
    } = useLyricsOverlayComments({
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
    });

    const handleToggleFavorite = (event) => {
        event?.stopPropagation?.();
        if (!canToggleFavorite) return;
        onToggleFavorite?.(currentTrack, event);
    };

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
    const coverVisualStyle = useMemo(() => {
        const style = {
            '--cover-image': `url(${coverSrc})`
        };

        if (activeCoverAtmosphereAssets?.palette) {
            style['--cover-accent-rgb'] = activeCoverAtmosphereAssets.palette.accent;
            style['--cover-glow-rgb'] = activeCoverAtmosphereAssets.palette.glow;
            style['--cover-shadow-rgb'] = activeCoverAtmosphereAssets.palette.shadow;
        }

        if (activeCoverAtmosphereAssets?.topCover) {
            style['--cover-top-image'] = `url(${activeCoverAtmosphereAssets.topCover})`;
        }

        return style;
    }, [activeCoverAtmosphereAssets, coverSrc]);
    // 使用 Portal 渲染到 body，确保不受父级样式限制（如 overflow, transform 等），实现真正的全屏
    return createPortal(
        <>
            <AnimatePresence>
                {isLyricsOpen && (
                    <Motion.div
                        className={`lyrics-overlay mobile-fullscreen-player ${isCompactMobileViewport ? 'mobile-compact-layout' : ''} ${isCommentDrawerOpen ? 'comment-drawer-open' : ''} ${activeCoverAtmosphereAssets ? 'cover-assets-ready' : ''}`}
                        initial={overlayInitial}
                        animate={overlayAnimate}
                        exit={overlayExit}
                        transition={overlayTransition}
                        onTouchStart={handleOverlayTouchStart}
                        onTouchEnd={handleOverlayTouchEnd}
                        onTouchCancel={resetMobileSwipeState}
                        style={coverVisualStyle}
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
                                    <img loading="lazy" src={coverSrc} alt="cover" />
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
                                                    data-distance={getLyricDistanceBucket(i)}
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
                                <div className="mobile-player-actions">
                                    <button
                                        type="button"
                                        className={`overlay-favorite-trigger mobile-action-btn ${isCurrentTrackFavorited ? 'active' : ''}`}
                                        onClick={handleToggleFavorite}
                                        aria-label={favoriteAriaLabel}
                                        title={favoriteAriaLabel}
                                        disabled={!canToggleFavorite}
                                    >
                                        <Heart size={24} strokeWidth={2.2} absoluteStrokeWidth fill={isCurrentTrackFavorited ? 'currentColor' : 'none'} />
                                    </button>
                                    <SleepTimerControl
                                        className="mobile-sleep-timer-control"
                                        buttonClassName="mobile-action-btn"
                                        remainingMs={sleepTimerRemainingMs}
                                        onStartSleepTimer={onStartSleepTimer}
                                        onCancelSleepTimer={onCancelSleepTimer}
                                        showCountdown={false}
                                        iconSize={24}
                                    />
                                    <button
                                        type="button"
                                        className={`overlay-comment-trigger mobile-action-btn ${isCommentDrawerOpen ? 'active' : ''}`}
                                        onClick={toggleCommentDrawer}
                                        aria-label="歌曲评论"
                                        disabled={!canOpenCommentDrawer}
                                    >
                                        <MessageCircle size={24} strokeWidth={2.2} absoluteStrokeWidth />
                                    </button>
                                </div>
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

                        {/* 桌面端内容 */}
                        <div className="desktop-player-content">
                            <div className="album-view">
                                <div
                                    className="xl-cover"
                                    onDoubleClick={(e) => handleCoverDoubleClick(e, 'desktop')}
                                    title="双击添加收藏"
                                >
                                    <img loading="lazy" src={coverSrc} alt="cover" />
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
                                            onMouseEnter={handleDesktopProgressMouseMove}
                                            onMouseMove={handleDesktopProgressMouseMove}
                                            onMouseLeave={handleDesktopProgressMouseLeave}
                                            onTouchStart={handleTouchStart}
                                        >
                                            <div className="overlay-progress-fill" style={{ width: `${progress}%` }} />
                                            <div className={`overlay-progress-thumb ${isDragActive ? 'is-visible' : ''}`} style={{ left: `${progress}%` }} />
                                            {canShowDesktopProgressPreview && desktopProgressHover != null && (
                                                <div
                                                    className="overlay-progress-hover-time"
                                                    style={{ left: `clamp(44px, ${desktopProgressHover}%, calc(100% - 44px))` }}
                                                    aria-hidden="true"
                                                >
                                                    {formatTime(desktopPreviewTime)} / {formatTime(duration)}
                                                </div>
                                            )}
                                            <div className="overlay-time-info">
                                                <span>{formatTime(currentTime)}</span>
                                                <span>{formatTime(duration)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="overlay-buttons">
                                        <button
                                            type="button"
                                            className="icon-btn"
                                            onClick={togglePlayMode}
                                            aria-label="切换播放模式"
                                        >
                                            {getPlayModeIcon(24)}
                                        </button>
                                        <button
                                            type="button"
                                            className="icon-btn"
                                            onClick={handlePrev}
                                            aria-label="上一首"
                                        >
                                            <Play size={24} fill="currentColor" style={{ transform: 'rotate(180deg)', marginRight: '-8px' }} />
                                            <Play size={24} fill="currentColor" style={{ transform: 'rotate(180deg)' }} />
                                        </button>
                                        <button
                                            type="button"
                                            className="overlay-play-btn"
                                            onClick={handlePlayPause}
                                            aria-label={isPlaying ? '暂停' : '播放'}
                                        >
                                            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" style={{ marginLeft: '6px' }} />}
                                        </button>
                                        <button
                                            type="button"
                                            className="icon-btn"
                                            onClick={handleNext}
                                            aria-label="下一首"
                                        >
                                            <Play size={24} fill="currentColor" style={{ marginRight: '-8px' }} />
                                            <Play size={24} fill="currentColor" />
                                        </button>
                                        <button
                                            type="button"
                                            className="icon-btn"
                                            onClick={() => setIsAlbumListOpen(true)}
                                            aria-label="打开歌曲列表"
                                        >
                                            <ListMusic size={24} strokeWidth={2.4} absoluteStrokeWidth />
                                        </button>
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
                                                    data-distance={getLyricDistanceBucket(i)}
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
                            {isMobileOverlay && (
                                <div
                                    className="song-comment-edge-swipe-zone"
                                    onTouchStart={handleCommentDrawerTouchStart}
                                    onTouchEnd={handleCommentDrawerTouchEnd}
                                    onTouchCancel={resetCommentDrawerSwipeState}
                                    aria-hidden="true"
                                />
                            )}
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
